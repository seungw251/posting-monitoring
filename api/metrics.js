/**
 * Vercel Serverless — 인스타그램 실측 지표 수집.
 *
 * 우선순위:
 *   1) APIFY_TOKEN 설정 시 → Apify Instagram Scraper 사용(좋아요·댓글·조회수 + 프로필 팔로워).
 *      팔로워는 포스트 출력엔 없으므로 소유자 프로필(details)을 별도 스크랩해 매핑한다.
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

/** Apify 액터를 동기 실행하고 데이터셋 아이템 배열을 돌려준다. */
async function runApify(input, fetchImpl = fetch) {
  const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`
    + `?token=${encodeURIComponent(APIFY_TOKEN)}`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`apify ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * 소유자 프로필에서 팔로워 수 수집.
 * 포스트(posts) 출력에는 팔로워 수가 없고 프로필(details) 출력에만 있으므로,
 * 계정 username 을 프로필 URL 로 만들어 별도 스크랩한다.
 * @returns {Object} { "<username(소문자)>": followersCount }
 */
export async function collectFollowers(usernames, fetchImpl = fetch) {
  const list = [...new Set((usernames || []).filter(Boolean).map((u) => String(u).toLowerCase()))];
  if (!list.length) return {};
  const directUrls = list.map((u) => `https://www.instagram.com/${u}/`);
  const data = await runApify(
    { directUrls, resultsType: "details", resultsLimit: 1 },
    fetchImpl
  );
  const out = {};
  for (const pr of data) {
    const u = (pr.username || pr.ownerUsername || "").toLowerCase();
    const f = pr.followersCount ?? pr.followersCount ?? pr.followers ?? null;
    if (u && f != null) out[u] = f;
  }
  return out;
}

export async function collectApify(items, fetchImpl = fetch) {
  const list = items || [];
  const urls = [...new Set(list.map((it) => it?.url).filter(Boolean))];
  if (!urls.length) return {};

  // 포스트 지표(좋아요·댓글·조회수)와 프로필 팔로워를 병렬 수집.
  // 팔로워 스크랩이 실패해도 나머지 지표는 유지되도록 격리한다.
  const owners = list.map((it) => it?.username).filter(Boolean);
  const [posts, followers] = await Promise.all([
    runApify({ directUrls: urls, resultsType: "posts", resultsLimit: 1, addParentData: false }, fetchImpl),
    collectFollowers(owners, fetchImpl).catch((e) => {
      console.error("apify followers:", e.message);
      return {};
    }),
  ]);

  // shortcode → 소유자 username (items 우선, 없으면 포스트의 ownerUsername)
  const scToUser = new Map();
  for (const it of list) {
    if (it?.shortcode && it?.username) scToUser.set(it.shortcode, String(it.username).toLowerCase());
  }

  const out = {};
  for (const p of posts) {
    const sc = p.shortCode || p.shortcode || shortcodeOf(p.url || p.inputUrl || "");
    if (!sc) continue;
    const view = p.videoViewCount ?? p.videoPlayCount ?? p.igPlayCount ?? null;
    out[sc] = {
      like: p.likesCount ?? 0,
      comment: p.commentsCount ?? 0,
      ...(view != null ? { view } : {}),
    };
    if (!scToUser.has(sc) && p.ownerUsername) scToUser.set(sc, String(p.ownerUsername).toLowerCase());
  }

  // 소유자 팔로워를 각 포스트에 매핑
  for (const [sc, row] of Object.entries(out)) {
    const f = followers[scToUser.get(sc)];
    if (f != null) row.follower = f;
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
