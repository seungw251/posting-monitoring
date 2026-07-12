/**
 * 저장소 어댑터 — Supabase 백엔드(팀 공유).
 * App.jsx는 예전 localStorage 시절과 동일한 loadState/saveState 시그니처를 쓴다.
 * 상태 형태: { rows, projects, rates, lastSync }
 *   - projects: [{ id, name, color }]
 *   - rows:     [{ id, projectId, ...computeRow 출력 }]   → postings 테이블(data jsonb)
 *   - rates:    { ig:[], youtube:[], blog:[] }             → app_settings.rates
 *   - lastSync: { [projectId]: isoString }                 → app_settings.last_sync
 *
 * 접근 제어는 RLS가 강제한다: 미승인 사용자는 조회 시 빈 결과, 쓰기 시 거부된다.
 * (v1) saveState는 현재 클라이언트 상태로 전체 조정(upsert + 누락분 삭제)한다.
 *      소규모 팀 기준으로 충분하나, 여러 명이 동시에 편집하면 마지막 저장이 우선한다.
 */
import { supabase } from "./supabase.js";

const rowToRecord = ({ id, projectId, ...data }) => ({ id, project_id: projectId, data });

/** 테이블에서 keep 목록에 없는 행을 삭제한다 (상태 반영용). */
async function deleteMissing(table, keepIds) {
  const { data, error } = await supabase.from(table).select("id");
  if (error) throw error;
  const keep = new Set(keepIds);
  const toDelete = (data || []).map((r) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error: de } = await supabase.from(table).delete().in("id", toDelete);
    if (de) throw de;
  }
}

export async function loadState() {
  if (!supabase) return null;
  const [{ data: projects, error: pe }, { data: postings, error: se }, { data: settings, error: ge }] =
    await Promise.all([
      supabase.from("projects").select("id, name, color").order("created_at", { ascending: true }),
      supabase.from("postings").select("id, project_id, data"),
      supabase.from("app_settings").select("rates, last_sync").eq("id", 1).maybeSingle(),
    ]);
  if (pe) throw pe;
  if (se) throw se;
  if (ge) throw ge;

  return {
    projects: projects || [],
    rows: (postings || []).map((p) => ({ ...p.data, id: p.id, projectId: p.project_id })),
    rates: settings?.rates ?? null,
    lastSync: settings?.last_sync ?? {},
  };
}

export async function saveState(state) {
  if (!supabase) throw new Error("Supabase 미설정");
  const projects = state.projects || [];
  const rows = state.rows || [];

  // 1) 프로젝트 upsert + 상태에 없는 프로젝트 삭제(하위 포스팅은 cascade)
  if (projects.length) {
    const { error } = await supabase
      .from("projects")
      .upsert(projects.map((p) => ({ id: p.id, name: p.name, color: p.color })));
    if (error) throw error;
  }
  await deleteMissing("projects", projects.map((p) => p.id));

  // 2) 포스팅 upsert + 상태에 없는 포스팅 삭제
  if (rows.length) {
    const { error } = await supabase.from("postings").upsert(rows.map(rowToRecord));
    if (error) throw error;
  }
  await deleteMissing("postings", rows.map((r) => r.id));

  // 3) 공유 기준표 + 동기화 시각
  const { error: ue } = await supabase
    .from("app_settings")
    .upsert({ id: 1, rates: state.rates, last_sync: state.lastSync || {} });
  if (ue) throw ue;
}

export async function clearState() {
  if (!supabase) return;
  await supabase.from("postings").delete().neq("id", "__none__");
  await supabase.from("projects").delete().neq("id", "__none__");
}
