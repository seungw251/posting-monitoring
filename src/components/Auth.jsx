import { useState } from "react";
import { signInWithMagicLink } from "../lib/auth.js";

/**
 * 로그인 화면 — 비밀번호 없는 매직 링크 방식.
 * 이메일 입력 → 메일로 온 링크 클릭 → 현재 origin으로 돌아와 App의 onAuthChange가 세션을 감지.
 * 가입도 이 흐름으로 통합되며, 승인 전까지는 "승인 대기" 화면이 표시된다.
 */
export default function Auth() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await signInWithMagicLink(email.trim());
      setSent(true);
    } catch (e2) {
      setErr(translate(e2?.message || "요청을 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-bg">
        <div className="auth-card">
          <div className="auth-logo">P</div>
          <h1>메일을 확인하세요</h1>
          <p className="auth-sub">
            <b>{email}</b> 으로 로그인 링크를 보냈습니다.<br />
            메일함에서 링크를 클릭하면 바로 입장합니다.
          </p>
          <div className="auth-gate-mail">링크가 안 보이면 스팸함도 확인해 주세요</div>
          <button className="btn auth-submit" onClick={() => { setSent(false); setEmail(""); }}>
            다른 이메일로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">P</div>
        <h1>Posting Monitor</h1>
        <p className="auth-sub">이메일을 입력하면 로그인 링크를 보내드립니다. 비밀번호는 필요 없습니다.</p>

        <label className="auth-f">
          <span>이메일</span>
          <input type="email" required autoFocus autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        {err && <div className="auth-err">{err}</div>}

        <button className="btn acc auth-submit" type="submit" disabled={busy}>
          {busy ? "전송 중…" : "로그인 링크 받기"}
        </button>

        <p className="note" style={{ textAlign: "center" }}>
          처음이면 이 과정으로 가입됩니다. 관리자가 승인한 계정만 입장할 수 있습니다.
        </p>
      </form>
    </div>
  );
}

function translate(m) {
  const s = String(m).toLowerCase();
  if (s.includes("rate") || s.includes("limit")) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (s.includes("email")) return "이메일 형식을 확인해 주세요.";
  return m;
}
