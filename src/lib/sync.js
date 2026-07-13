/**
 * 지표 동기화.
 *
 * 인스타 포스팅의 실측 좋아요/댓글/팔로워를 백엔드(/api/metrics)에서 수집해 반영하고,
 * 밸류 기준표로 파생 지표(Impression/Reach/AD/PR)를 재계산한다.
 *
 * 백엔드는 Instagram Graph API Business Discovery를 사용한다(api/metrics.js).
 * 백엔드가 미설정(토큰 없음)이면 빈 결과가 오고, 파생 지표만 재계산된다.
 *
 * 한계: 조회수(view)는 Business Discovery로 수집 불가 → 기존(수동 입력) 값 유지.
 */
import { computeRow, checkUrl } from "./posting.js";

/** 백엔드 응답 대기 상한(ms). 스크래핑(Apify)은 시간이 걸릴 수 있어 넉넉히. */
const FETCH_TIMEOUT = 55000;
/** 지표 API 엔드포인트 — 기본은 같은 배포의 서버리스 함수. 필요 시 env로 override. */
const ENDPOINT = import.meta.env?.VITE_METRICS_API_URL || "/api/metrics";

/** 포스팅 링크에서 플랫폼 ID(인스타 shortcode / 유튜브 id) 추출 */
export const postIdOf = (url = "") => {
  let m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : null;
};

/** 인스타 계정 URL → username (포스팅 경로 세그먼트는 제외) */
export const igUsername = (url = "") => {
  const m = String(url).match(/instagram\.com\/([^/?#]+)/i);
  if (!m) return null;
  const seg = m[1].replace(/^@/, "");
  return ["p", "reel", "reels", "tv", "explore", ""].includes(seg.toLowerCase()) ? null : seg;
};

async function fetchMetrics(rows) {
  // 실측 대상: 인스타 포스팅(계정 username + 포스팅 shortcode 둘 다 있는 건)
  const items = [];
  for (const r of rows) {
    const isIgPost = /instagram\.com\/(?:p|reel|tv)\//i.test(r.postingUrl);
    if (!isIgPost) continue;
    const shortcode = postIdOf(r.postingUrl);
    if (shortcode) items.push({ username: igUsername(r.url), shortcode, url: r.postingUrl });
  }
  if (!items.length) return {};

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: ctl.signal,
    });
    if (res.status === 404) return {}; // 백엔드 함수 없음(로컬 등) → 파생 재계산만
    if (!res.ok) throw new Error(`metrics API ${res.status}`);
    return await res.json(); // { "<shortcode>": { like, comment, follower } }
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`metrics API 응답 시간 초과(${FETCH_TIMEOUT / 1000}초)`);
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
    // 실측값(like/comment/follower)만 덮어쓰고, adOverride 등 기존 값은 보존.
    const merged = { ...r, ...m };
    // 이전 동기화 대비 증감 기준선: 직전 동기화가 있었을 때만 현재값을 스냅샷.
    const prev = r.syncedAt
      ? { view: r.view || 0, like: r.like || 0, comment: r.comment || 0, follower: r.follower || 0 }
      : null;
    out.set(r.id, { ...r, ...computeRow(merged, rates), prev, syncedAt: now });
    onTick(Math.round(((i + 1) / targets.length) * 100));
  });

  return { updated: out, syncedAt: now, count: targets.length };
}
