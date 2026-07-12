/**
 * Supabase 클라이언트.
 * 자격 증명은 빌드 타임 환경변수로 주입한다 (Vercel: Project Settings → Environment Variables).
 *   VITE_SUPABASE_URL      = https://<ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY = <anon public key>  (공개돼도 안전한 값 — 실제 접근 제어는 RLS가 강제)
 * 서버 전용 service_role 키는 절대 프론트에 넣지 않는다.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL;
const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY;

/** 환경변수가 없으면 앱은 "설정 필요" 화면을 띄운다. */
export const isConfigured = Boolean(url && anon);

export const supabase = isConfigured
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
