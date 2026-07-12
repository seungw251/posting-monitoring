import { useState } from "react";
import { signIn, signUp } from "../lib/auth.js";

/**
 * 로그인 / 가입 화면 (미인증 사용자).
 * 성공 시 App의 onAuthChange 구독이 세션을 감지해 자동으로 다음 화면으로 넘어간다.
 * 가입 후에도 관리자의 승인 전까지는 "승인 대기" 화면이 표시된다.
 */
export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), pw);
      } else {
        const { session } = await signUp(email.trim(), pw);
        if (!session) setMsg("가입 완료. 이메일 확인이 필요하다면 메일을 확인한 뒤 로그인해 주세요.");
      }
    } catch (e2) {
      setErr(translate(e2?.message || "요청을 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">P</div>
        <h1>Posting Monitor</h1>
        <p className="auth-sub">
          {mode === "login" ? "등록된 계정으로 로그인하세요." : "계정을 만들면 관리자 승인 후 입장할 수 있습니다."}
        </p>

        <label className="auth-f">
          <span>이메일</span>
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label className="auth-f">
          <span>비밀번호</span>
          <input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6자 이상" />
        </label>

        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}

        <button className="btn acc auth-submit" type="submit" disabled={busy}>
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
        </button>

        <div className="auth-switch">
          {mode === "login" ? (
            <>계정이 없나요? <button type="button" onClick={() => { setMode("signup"); setErr(""); setMsg(""); }}>가입하기</button></>
          ) : (
            <>이미 계정이 있나요? <button type="button" onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>로그인</button></>
          )}
        </div>
      </form>
    </div>
  );
}

function translate(m) {
  const s = String(m).toLowerCase();
  if (s.includes("invalid login")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (s.includes("already registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (s.includes("password")) return "비밀번호는 6자 이상이어야 합니다.";
  if (s.includes("email")) return "이메일 형식을 확인해 주세요.";
  return m;
}
