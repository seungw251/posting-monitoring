/**
 * Vercel Serverless — 인스타그램 실측 지표(좋아요/댓글/팔로워) 수집.
 *
 * Instagram Graph API의 Business Discovery 사용:
 *   내 비즈니스 계정(IG_USER_ID) + 토큰(IG_ACCESS_TOKEN)으로
 *   대상 크리에이터/비즈니스 계정의 공개 지표를 username으로 조회한다.
 *   (대상 인플루언서의 허락은 필요 없음)
 *
 * 요청:  POST { items: [{ username, shortcode }] }
 * 응답:  { "<shortcode>": { like, comment, follower } }
 *
 * 한계: Business Discovery는 조회수(view)를 제공하지 않는다(좋아요/댓글/팔로워만).
 *       대상이 비즈니스/크리에이터 계정이어야 하며, 개인 계정은 조회되지 않는다.
 *
 * 환경변수(서버 전용 — VITE_ 접두사 없음, 클라이언트에 노출 안 됨):
 *   IG_USER_ID        내 인스타 비즈니스 계정의 IG User ID
 *   IG_ACCESS_TOKEN   장기(long-lived) 액세스 토큰
 *   GRAPH_VERSION     (선택) 기본 v21.0
 */
const VERSION = process.env.GRAPH_VERSION || "v21.0";
const IG_USER_ID = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;
const MAX_PAGES = 3; // username당 최대 미디어 페이지 (50 × 3 = 150건까지 탐색)

export const shortcodeOf = (permalink = "") => {
  const m = String(permalink).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
};

/** 한 username에 대해 필요한 shortcode들을 찾을 때까지 media를 페이지네이션 */
async function discover(username, wanted, fetchImpl = fetch) {
  const out = {};
  let after = "";
  let follower = null;
  for (let page = 0; page < MAX_PAGES && wanted.size; page++) {
    const media = `media.limit(50)${after ? `.after(${after})` : ""}{permalink,like_count,comments_count}`;
    const fields = `business_discovery.username(${username}){followers_count,${media}}`;
    const url = `https://graph.facebook.com/${VERSION}/${IG_USER_ID}`
      + `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(TOKEN)}`;
    const res = await fetchImpl(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "graph error");
    const bd = json.business_discovery;
    if (!bd) break;
    follower = bd.followers_count ?? follower;
    for (const m of bd.media?.data || []) {
      const sc = shortcodeOf(m.permalink);
      if (sc && wanted.has(sc)) {
        out[sc] = { like: m.like_count ?? 0, comment: m.comments_count ?? 0, follower };
        wanted.delete(sc);
      }
    }
    after = bd.media?.paging?.cursors?.after || "";
    if (!after) break;
  }
  return out;
}

/** items를 username→shortcode 집합으로 묶어 순회 수집 (단위 테스트용으로 분리) */
export async function collect(items, fetchImpl = fetch) {
  const byUser = new Map();
  for (const it of items || []) {
    const u = (it?.username || "").trim();
    const sc = (it?.shortcode || "").trim();
    if (!u || !sc) continue;
    if (!byUser.has(u)) byUser.set(u, new Set());
    byUser.get(u).add(sc);
  }
  const result = {};
  for (const [username, wanted] of byUser) {
    try {
      Object.assign(result, await discover(username, wanted, fetchImpl));
    } catch (e) {
      console.error(`business_discovery ${username}:`, e.message);
    }
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  // 미설정 → 조용히 빈 결과(프론트는 파생값 재계산만 수행)
  if (!IG_USER_ID || !TOKEN) { res.status(200).json({}); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  try {
    const result = await collect(body?.items, fetch);
    res.status(200).json(result);
  } catch (e) {
    res.status(502).json({ error: e.message || "collect failed" });
  }
}
