import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/**
 * 관리자 전용 사용자 관리 (모달).
 * profiles 목록을 불러와 승인/거부/관리자 승격을 처리한다.
 * RLS: 관리자만 다른 사용자의 profiles를 조회·수정할 수 있다.
 */
export default function AdminUsers({ meId, onClose, onToast }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, status, created_at")
      .order("created_at", { ascending: true });
    if (error) { onToast?.(`불러오기 실패: ${error.message}`); return; }
    setList(data || []);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id, fields, label) => {
    setBusy(id);
    const { error } = await supabase.from("profiles").update(fields).eq("id", id);
    setBusy(null);
    if (error) { onToast?.(`${label} 실패: ${error.message}`); return; }
    onToast?.(`${label} 완료`);
    load();
  };

  const badge = (s) =>
    s === "approved" ? <span className="ub ok">승인됨</span>
    : s === "rejected" ? <span className="ub err">거부됨</span>
    : <span className="ub warn">대기중</span>;

  const pending = (list || []).filter((u) => u.status === "pending").length;

  return (
    <div className="mbg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
        <h3>사용자 관리</h3>
        <p className="lead">
          가입한 사용자를 승인해야 입장할 수 있습니다.
          {pending > 0 && <> 현재 <b>{pending}명</b>이 승인 대기 중입니다.</>}
        </p>

        {list === null ? (
          <div className="empty">불러오는 중…</div>
        ) : list.length === 0 ? (
          <div className="empty">사용자가 없습니다.</div>
        ) : (
          <div className="ulist">
            {list.map((u) => (
              <div className="urow" key={u.id}>
                <div className="uinfo">
                  <b>{u.email || u.id.slice(0, 8)}{u.id === meId && <em> (나)</em>}</b>
                  <span>
                    {badge(u.status)}
                    {u.role === "admin" && <span className="ub acc">관리자</span>}
                  </span>
                </div>
                <div className="uacts">
                  {u.status !== "approved" && (
                    <button className="btn acc" disabled={busy === u.id}
                      onClick={() => patch(u.id, { status: "approved" }, "승인")}>승인</button>
                  )}
                  {u.status !== "rejected" && u.id !== meId && (
                    <button className="btn del" disabled={busy === u.id}
                      onClick={() => patch(u.id, { status: "rejected" }, "거부")}>거부</button>
                  )}
                  {u.role !== "admin" && u.status === "approved" && (
                    <button className="btn" disabled={busy === u.id}
                      onClick={() => patch(u.id, { role: "admin" }, "관리자 지정")}>관리자로</button>
                  )}
                  {u.role === "admin" && u.id !== meId && (
                    <button className="btn" disabled={busy === u.id}
                      onClick={() => patch(u.id, { role: "member" }, "관리자 해제")}>일반으로</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="note">
          거부된 사용자는 로그인은 되지만 데이터에 접근할 수 없습니다. 접근 제어는 서버(RLS)에서 강제됩니다.
        </p>
        <div className="mft">
          <button className="btn acc" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
