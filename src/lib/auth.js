/**
 * 인증 헬퍼 (이메일 + 비밀번호).
 * 가입/로그인/로그아웃 + 비밀번호 재설정(이메일 링크).
 * 접근 제어의 실제 강제는 Supabase RLS(로그인 사용자만)가 한다 — 아래는 UX용.
 */
import { supabase } from "./supabase.js";

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 세션·이벤트 변화 구독 → 해제 함수 반환. cb(event, session) */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}

/** 비밀번호 재설정 메일 발송(클릭 시 현재 origin으로 복귀해 재설정) */
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

/** 새 비밀번호로 변경(재설정 링크로 복귀한 세션에서 호출) */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
