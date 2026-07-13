/** 숫자·날짜 포맷 유틸 */

export const num = (v) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[,\s₩]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const fmt = (n) => (n || 0).toLocaleString("ko-KR");

// digits 지정 시 해당 소수 자릿수로 고정(예: fmtShort(191000, 1) → "19.1만").
// 미지정 시 기존 동작(만은 반올림 정수, 억은 나머지 있을 때만 1자리).
export const fmtShort = (n, digits) => {
  n = n || 0;
  const unit = (v, u, d) => {
    const [int, dec] = v.toFixed(d).split(".");
    return Number(int).toLocaleString("ko-KR") + (dec ? "." + dec : "") + u;
  };
  if (n >= 100000000) return unit(n / 100000000, "억", digits ?? (n % 100000000 ? 1 : 0));
  if (n >= 10000) return unit(n / 10000, "만", digits ?? 0);
  return n.toLocaleString("ko-KR");
};

/** 엑셀 시리얼 → ISO(YYYY-MM-DD) */
export const serialToISO = (s) =>
  new Date(Math.round((s - 25569) * 86400 * 1000)).toISOString().slice(0, 10);

export const toISO = (v) => {
  if (v == null || v === "") return "";
  if (v instanceof Date)
    return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (typeof v === "number") return serialToISO(v);
  const d = new Date(String(v).trim().replace(/[./]/g, "-"));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export const timeAgo = (iso) => {
  if (!iso) return "–";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "방금 전";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

export const stamp = (iso) =>
  iso
    ? new Date(iso).toLocaleString("ko-KR", {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : null;

/** 계정 URL → 핸들 */
export const handleOf = (url) => {
  const m = (url || "").match(/(?:instagram\.com|youtube\.com|blog\.naver\.com)\/(?:@)?([^/?#]+)/i);
  return m ? m[1] : (url || "").replace(/^https?:\/\/(www\.)?/, "").slice(0, 22);
};
