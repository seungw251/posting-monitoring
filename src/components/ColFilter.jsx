import { useState } from "react";

/** 컬럼 헤더 필터 팝오버 — 정렬 + 검색 + 체크박스 다중 선택 */
export default function ColFilter({ col, values, applied, sort, onApply, onSort, onClose }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(() => new Set(applied?.length ? applied : values));

  const shown = values.filter((v) => String(v).toLowerCase().includes(q.toLowerCase()));

  const toggle = (v) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });

  const apply = () => onApply(picked.size === values.length ? [] : [...picked]);

  return (
    <div className="cfilter" onClick={(e) => e.stopPropagation()} role="dialog">
      <div className="cf-t">{col.label}</div>
      <button
        className={`cf-sort ${sort.key === col.key && sort.dir === "asc" ? "on" : ""}`}
        onClick={() => onSort(col.key, "asc")}
      >
        ▲ 오름차순 정렬
      </button>
      <button
        className={`cf-sort ${sort.key === col.key && sort.dir === "desc" ? "on" : ""}`}
        onClick={() => onSort(col.key, "desc")}
      >
        ▼ 내림차순 정렬
      </button>

      {col.kind === "value" && (
        <>
          <input
            className="cf-s"
            placeholder="검색"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            aria-label={`${col.label} 검색`}
          />
          <div className="cf-bar">
            <button onClick={() => setPicked(new Set(values))}>전체 선택</button>
            <button onClick={() => setPicked(new Set())}>해제</button>
            <em>
              {picked.size}/{values.length}
            </em>
          </div>
          <div className="cf-l">
            {shown.length === 0 && <div className="cf-e">검색 결과 없음</div>}
            {shown.map((v) => (
              <label key={String(v)} className="cf-i">
                <input type="checkbox" checked={picked.has(v)} onChange={() => toggle(v)} />
                <span>{String(v) || "(없음)"}</span>
              </label>
            ))}
          </div>
          <div className="cf-f">
            <button className="btn" onClick={onClose}>취소</button>
            <button className="btn acc" onClick={apply}>적용</button>
          </div>
        </>
      )}
    </div>
  );
}
