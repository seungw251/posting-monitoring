import { useState } from "react";
import { signIn, signUp, sendPasswordReset, updatePassword } from "../lib/auth.js";

const META = {
  login:  { title: "로그인",          sub: "등록된 계정으로 로그인하세요.",              cta: "로그인" },
  signup: { title: "회원가입",         sub: "이메일과 비밀번호로 계정을 만드세요.",        cta: "가입하기" },
  forgot: { title: "비밀번호 찾기",     sub: "가입한 이메일로 재설정 링크를 보내드립니다.", cta: "재설정 메일 보내기" },
  reset:  { title: "새 비밀번호 설정",  sub: "새로 사용할 비밀번호를 입력하세요.",          cta: "비밀번호 변경" },
};

/**
 * 인증 화면. mode: login | signup | forgot | reset
 * recovery=true 이면 비밀번호 재설정(새 비밀번호 입력) 화면으로 시작.
 */
export default function Auth({ recovery = false, onRecoveryDone }) {
  const [mode, setMode] = useState(recovery ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const go = (m) => { setMode(m); setErr(""); setMsg(""); setPw(""); setPw2(""); };

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), pw);
      } else if (mode === "signup") {
        const { session } = await signUp(email.trim(), pw);
        if (!session) setMsg("가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증한 뒤 로그인해 주세요.");
      } else if (mode === "forgot") {
        await sendPasswordReset(email.trim());
        setMsg("비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.");
      } else if (mode === "reset") {
        if (pw.length < 6) throw new Error("password too short");
        if (pw !== pw2) throw new Error("mismatch");
        await updatePassword(pw);
        onRecoveryDone?.();
      }
    } catch (e2) {
      setErr(translate(e2?.message || "요청을 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const meta = META[mode];
  const pwType = showPw ? "text" : "password";

  return (
    <div className="pm auth-bg">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">P</div>
          <span className="auth-wordmark">Posting Monitor</span>
        </div>
        <h1 className="auth-title">{meta.title}</h1>
        <p className="auth-sub">{meta.sub}</p>

        <form className="auth-form" onSubmit={submit}>
          {mode !== "reset" && (
            <label className="auth-f">
              <span>이메일</span>
              <input className="auth-in" type="email" required autoFocus autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
          )}

          {mode !== "forgot" && (
            <label className="auth-f">
              <span>{mode === "reset" ? "새 비밀번호" : "비밀번호"}</span>
              <div className="auth-pw">
                <input className="auth-in" type={pwType} required minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6자 이상" />
                <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}>
                  {showPw ? "숨기기" : "보기"}
                </button>
              </div>
            </label>
          )}

          {mode === "reset" && (
            <label className="auth-f">
              <span>새 비밀번호 확인</span>
              <div className="auth-pw">
                <input className="auth-in" type={pwType} required minLength={6} autoComplete="new-password"
                  value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="다시 입력" />
              </div>
            </label>
          )}

          {mode === "login" && (
            <button type="button" className="auth-forgot" onClick={() => go("forgot")}>비밀번호를 잊으셨나요?</button>
          )}

          {err && <div className="auth-msg err">⚠ {err}</div>}
          {msg && <div className="auth-msg ok">✓ {msg}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "처리 중…" : meta.cta}
          </button>
        </form>

        <div className="auth-foot">
          {mode === "login" && <>계정이 없나요? <button type="button" onClick={() => go("signup")}>회원가입</button></>}
          {(mode === "signup" || mode === "forgot") && (
            <button type="button" onClick={() => go("login")}>← 로그인으로 돌아가기</button>
          )}
        </div>
      </div>
    </div>
  );
}

function translate(m) {
  const s = String(m).toLowerCase();
  if (s.includes("mismatch")) return "새 비밀번호가 서로 일치하지 않습니다.";
  if (s.includes("too short") || s.includes("password")) return "비밀번호는 6자 이상이어야 합니다.";
  if (s.includes("invalid login")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (s.includes("already registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (s.includes("email")) return "이메일 형식을 확인해 주세요.";
  return m;
}
