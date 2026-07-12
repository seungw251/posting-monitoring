/**
 * 인증 · 프로필 헬퍼.
 * 로그인/가입/로그아웃과 현재 사용자의 프로필(role/status) 조회를 담당한다.
 * 접근 제어의 실제 강제는 프론트가 아니라 Supabase RLS가 한다 — 여기 함수들은 UX용이다.
 */
import { supabase } from "./supabase.js";

/** 마스터(최고 관리자) 이메일 — DB 트리거의 값과 반드시 일치시킬 것 (supabase/schema.sql). */
export const MASTER_EMAIL = "rengo@kakao.com";

/**
 * 매직 링크 로그인(비밀번호 없음).
 * 이메일로 로그인 링크를 보내고, 링크를 클릭하면 현재 origin으로 돌아와 세션이 생성된다.
 * 처음 요청하는 이메일이면 계정도 함께 생성된다(가입=로그인 통합). 승인 여부는 RLS/게이트가 판단.
 */
export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 세션 변화 구독 → 해제 함수 반환 */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** 현재 로그인 사용자의 profiles 행 (role/status). 없으면 null. */
export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, status")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
