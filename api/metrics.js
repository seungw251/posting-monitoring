/**
 * Vercel Serverless — 인스타그램 실측 지표 수집.
 *
 * 우선순위:
 *   1) APIFY_TOKEN 설정 시 → Apify Instagram Scraper 사용(좋아요·댓글·조회수까지).
 *   2) 아니면 IG_USER_ID + IG_ACCESS_TOKEN 설정 시 → Graph API Business Discovery(좋아요·댓글·팔로워, 조회수 없음).
 *   3) 아무것도 없으면 → 빈 결과(프론트는 파생값만 재계산).
 *
 * 요청:  POST { items: [{ username, shortcode, url }] }
 * 응답:  { "<shortcode>": { like, comment, view?, follower? } }
 *
 * 환경변수(서버 전용, VITE_ 접두사 없음 → 클라이언트 비노출):
 *   APIFY_TOKEN       Apify Personal API token
 *   APIFY_ACTOR       (선택) 기본 apify~instagram-scraper
 *   IG_USER_ID        (폴백) 내 인스타 비즈니스 계정 IG User ID
 *   IG_ACCESS_TOKEN   (폴백) 장기 액세스 토큰
 *   GRAPH_VERSION     (선택) 기본 v21.0
 */
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR = process.env.APIFY_ACTOR || "apify~instagram-scraper";

const VERSION = process.env.GRAPH_VERSION || "v21.0";
const IG_USER_ID = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;
const MAX_PAGES = 3;

export const shortcodeOf = (permalink = "") => {
  const m = String(permalink).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
};

/* ── 1) Apify Instagram Scraper ─────────────────────────────────────────── */
export async function collectApify(items, fetchImpl = fetch) {
  const urls = [...new Set((items || []).map((it) => it?.url).filter(Boolean))];
  if (!urls.length) return {};

  const input = { directUrls: urls, resultsType: "posts", resultsLimit: 1, addParentData: false };
  const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`
    + `?token=${encodeURIComponent(APIFY_TOKEN)}`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`apify ${res.status}`);
  const data = await res.json();

  const out = {};
  for (const p of Array.isArray(data) ? data : []) {
    const sc = p.shortCode || p.shortcode || shortcodeOf(p.url || p.inputUrl || "");
    if (!sc) continue;
    const view = p.videoViewCount ?? p.videoPlayCount ?? p.igPlayCount ?? null;
    const follower = p.ownerFollowersCount ?? p.owner?.followersCount ?? null;
    out[sc] = {
      like: p.likesCount ?? 0,
      comment: p.commentsCount ?? 0,
      ...(view != null ? { view } : {}),
      ...(follower != null ? { follower } : {}),
    };
  }
  return out;
}

/* ── 2) Graph API Business Discovery (폴백) ──────────────────────────────── */
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

/* ── 핸들러 ──────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const items = Array.isArray(body?.items) ? body.items : [];

  try {
    let result = {};
    if (APIFY_TOKEN) result = await collectApify(items, fetch);
    else if (IG_USER_ID && TOKEN) result = await collect(items, fetch);
    res.status(200).json(result);
  } catch (e) {
    res.status(502).json({ error: e.message || "collect failed" });
  }
}
