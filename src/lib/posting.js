/** 포스팅 도메인 로직 — 유형 판별 · 지표 계산 · 중복 · 링크 검증 */
import { num } from "./format.js";
import { rateFor } from "./rates.js";

export const isStory = (u) => {
  const s = (u || "").toLowerCase().trim();
  return !s || s === "ig story" || s.includes("story");
};

export const postType = (r) => {
  if (isStory(r.postingUrl)) return "스토리";
  const u = (r.postingUrl || "").toLowerCase();
  if (u.includes("/reel")) return "릴스";
  if (u.includes("youtu")) return "영상";
  return "피드";
};

export const detectChannel = (url, postingUrl) => {
  const s = `${url || ""} ${postingUrl || ""}`.toLowerCase();
  if (s.includes("youtu")) return "youtube";
  if (s.includes("blog") || s.includes("naver.com") || s.includes("tistory")) return "blog";
  return "ig";
};

/**
 * 중복 판정
 * - 링크 있는 건: 프로젝트 + 인플루언서 + 포스팅 링크 (날짜 무관)
 * - IG STORY: 고유 링크가 없어 프로젝트 + 인플루언서 + 날짜
 */
export const dedupeKey = (r) => {
  const name = (r.name || "").trim().toLowerCase();
  const url = (r.postingUrl || "").trim().toLowerCase();
  return isStory(url)
    ? `${r.projectId}|story|${name}|${r.date}`
    : `${r.projectId}|url|${name}|${url}`;
};

/** 포스팅 링크 유효성 */
export const checkUrl = (postingUrl) => {
  const u = (postingUrl || "").trim();
  if (isStory(u)) return { ok: true, reason: "" };
  if (!/^https?:\/\//i.test(u)) return { ok: false, reason: "http/https 누락" };
  if (/instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i.test(u)) return { ok: true, reason: "" };
  if (/(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/i.test(u))
    return { ok: true, reason: "" };
  if (/blog\.naver\.com|tistory\.com|brunch\.co\.kr/i.test(u)) return { ok: true, reason: "" };
  if (/instagram\.com/i.test(u))
    return { ok: false, reason: "IG 포스팅 링크 형식 아님 (계정 URL로 보임)" };
  return { ok: false, reason: "인식할 수 없는 링크 형식" };
};

/**
 * 지표 계산
 * Impression = Follower × Posting
 * Reach      = Follower
 * View/Like/Comment = 스토리는 0
 * AD/PR      = 밸류 기준표 × Posting (스토리 50%)
 */
export const computeRow = (f, rates) => {
  const story = isStory(f.postingUrl);
  const posting = num(f.posting) || 1;
  const follower = num(f.follower);
  const channel = f.channel || detectChannel(f.url, f.postingUrl);
  const base = rateFor(follower, channel, rates);
  const mul = posting * (story ? 0.5 : 1);
  const override = num(f.adOverride);
  const adValue = override > 0 ? override : base.ad * mul;
  const prValue = override > 0 ? override * 5 : base.pr * mul;

  return {
    date: f.date,
    name: (f.name || "").trim(),
    url: (f.url || "").trim(),
    postingUrl: (f.postingUrl || "").trim() || "IG STORY",
    channel,
    posting,
    follower,
    impression: follower * posting,
    reach: follower,
    view: story ? 0 : num(f.view),
    like: story ? 0 : num(f.like),
    comment: story ? 0 : num(f.comment),
    adValue,
    prValue,
    adOverride: f.adOverride ?? "",
    syncedAt: f.syncedAt || null,
  };
};

/** 컬럼 값 접근자 (Engagement는 파생) */
export const cellVal = (r, key) =>
  key === "eng" ? (r.like || 0) + (r.comment || 0) : r[key];
