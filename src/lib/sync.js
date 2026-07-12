/**
 * 지표 동기화.
 *
 * 현재: 밸류 기준표로 파생 지표(Impression/Reach/AD/PR)를 재계산한다.
 * TODO: View/Like/Comment 실측 수집.
 *   브라우저에서 인스타그램을 직접 크롤링하는 것은 CORS·약관상 불가하므로
 *   서버(백엔드)에서 Instagram Graph API(비즈니스 계정 + 토큰)로 수집한 뒤
 *   아래 fetchMetrics를 해당 엔드포인트 호출로 바꾼다.
 *
 *   예시 응답: { "<postId>": { view, like, comment } }
 */
import { computeRow, checkUrl } from "./posting.js";

const API = import.meta.env?.VITE_METRICS_API_URL;

/** 백엔드 응답 대기 상한(ms). 초과 시 동기화가 무한 대기하지 않고 실패로 끝난다. */
const FETCH_TIMEOUT = 15000;

/** 포스팅 링크에서 플랫폼 ID 추출 */
export const postIdOf = (url = "") => {
  let m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : null;
};

async function fetchMetrics(rows) {
  if (!API) return {}; // 백엔드 미연동 → 실측 지표 없음
  const ids = rows.map((r) => postIdOf(r.postingUrl)).filter(Boolean);
  if (!ids.length) return {}; // 수집 가능한 ID 없음 → 호출 생략

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(`${API}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`metrics API ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError")
      throw new Error(`metrics API 응답 시간 초과(${FETCH_TIMEOUT / 1000}초)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {Array} rows      대상 행
 * @param {Object} rates    밸류 기준표
 * @param {Function} onTick 진행률 콜백 (0~100)
 */
export async function syncRows(rows, rates, onTick = () => {}) {
  const targets = rows.filter((r) => checkUrl(r.postingUrl).ok);
  const out = new Map();
  const now = new Date().toISOString();
  if (!targets.length) return { updated: out, syncedAt: now, count: 0 };

  const metrics = await fetchMetrics(targets);

  targets.forEach((r, i) => {
    const m = metrics[postIdOf(r.postingUrl)] || {};
    // 실측 지표(m)만 덮어쓰고, 사용자가 지정한 adOverride 등 기존 값은 보존한다.
    const merged = { ...r, ...m };
    out.set(r.id, { ...r, ...computeRow(merged, rates), syncedAt: now });
    onTick(Math.round(((i + 1) / targets.length) * 100));
  });

  return { updated: out, syncedAt: now, count: targets.length };
}
