import { test } from "node:test";
import assert from "node:assert/strict";
import { isStory, postType, detectChannel, dedupeKey, checkUrl, computeRow, cellVal } from "../src/lib/posting.js";
import { DEFAULT_RATES } from "../src/lib/rates.js";

const IG_POST = "https://www.instagram.com/p/DXgobeRTtNH/";
const IG_REEL = "https://www.instagram.com/reel/DXom2vWj4p5/";

test("isStory: 빈 값·IG STORY·story 포함 문자열", () => {
  assert.equal(isStory(""), true);
  assert.equal(isStory("IG STORY"), true);
  assert.equal(isStory(IG_POST), false);
});

test("postType: 링크 유형 분류", () => {
  assert.equal(postType({ postingUrl: "IG STORY" }), "스토리");
  assert.equal(postType({ postingUrl: IG_REEL }), "릴스");
  assert.equal(postType({ postingUrl: IG_POST }), "피드");
  assert.equal(postType({ postingUrl: "https://youtu.be/abcdef" }), "영상");
});

test("detectChannel: URL로 채널 판별", () => {
  assert.equal(detectChannel("https://youtube.com/@x", ""), "youtube");
  assert.equal(detectChannel("https://blog.naver.com/x", ""), "blog");
  assert.equal(detectChannel("https://www.instagram.com/x/", IG_POST), "ig");
});

test("checkUrl: 링크 유효성", () => {
  assert.equal(checkUrl(IG_POST).ok, true);
  assert.equal(checkUrl("IG STORY").ok, true);
  assert.equal(checkUrl("instagram.com/p/ABC").ok, false); // http(s) 누락
  assert.equal(checkUrl("https://www.instagram.com/suesasha/").ok, false); // 계정 URL
  assert.equal(checkUrl("https://example.com/foo").ok, false);
});

test("dedupeKey: 링크 있는 건은 프로젝트+이름+링크 (날짜 무관)", () => {
  const a = { projectId: "p", name: "수사샤", postingUrl: IG_POST, date: "2026-04-24" };
  const b = { projectId: "p", name: "수사샤", postingUrl: IG_POST, date: "2026-05-01" };
  assert.equal(dedupeKey(a), dedupeKey(b)); // 날짜 달라도 동일
});

test("dedupeKey: 스토리는 프로젝트+이름+날짜", () => {
  const a = { projectId: "p", name: "소리", postingUrl: "IG STORY", date: "2026-04-24" };
  const b = { projectId: "p", name: "소리", postingUrl: "IG STORY", date: "2026-04-25" };
  assert.notEqual(dedupeKey(a), dedupeKey(b)); // 날짜 다르면 별개
  assert.equal(dedupeKey(a), dedupeKey({ ...a }));
});

test("computeRow: Impression = Follower × Posting, Reach = Follower", () => {
  const r = computeRow({ date: "2026-01-01", name: "A", url: "", postingUrl: IG_POST, posting: 2, follower: 100000, view: 500, like: 30, comment: 5 }, DEFAULT_RATES);
  assert.equal(r.impression, 200000);
  assert.equal(r.reach, 100000);
  assert.equal(r.view, 500);
  assert.equal(r.like, 30);
});

test("computeRow: 스토리는 View/Like/Comment = 0, AD Value 50%", () => {
  const feed = computeRow({ date: "2026-01-01", name: "A", url: "", postingUrl: IG_POST, posting: 1, follower: 100000, view: 999, like: 9, comment: 9 }, DEFAULT_RATES);
  const story = computeRow({ date: "2026-01-01", name: "A", url: "", postingUrl: "IG STORY", posting: 1, follower: 100000, view: 999, like: 9, comment: 9 }, DEFAULT_RATES);
  assert.equal(story.view, 0);
  assert.equal(story.like, 0);
  assert.equal(story.comment, 0);
  assert.equal(story.adValue, feed.adValue * 0.5);
});

test("computeRow: PR = 구간 PR 단가 × Posting (기본 AD×5)", () => {
  const r = computeRow({ date: "2026-01-01", name: "A", url: "", postingUrl: IG_POST, posting: 1, follower: 100000 }, DEFAULT_RATES);
  assert.equal(r.adValue, 5000000);
  assert.equal(r.prValue, 25000000);
});

test("computeRow: adOverride 지정 시 우선 적용되고 출력에 보존", () => {
  const r = computeRow({ date: "2026-01-01", name: "A", url: "", postingUrl: IG_POST, posting: 1, follower: 100000, adOverride: 7000000 }, DEFAULT_RATES);
  assert.equal(r.adValue, 7000000);
  assert.equal(r.prValue, 35000000); // override × 5
  assert.equal(r.adOverride, 7000000);
});

test("cellVal: Engagement는 like+comment 파생", () => {
  assert.equal(cellVal({ like: 10, comment: 3 }, "eng"), 13);
  assert.equal(cellVal({ follower: 500 }, "follower"), 500);
});
