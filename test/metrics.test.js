import { test } from "node:test";
import assert from "node:assert/strict";
import { collect, collectApify, shortcodeOf } from "../api/metrics.js";
import { igUsername, postIdOf } from "../src/lib/sync.js";

test("shortcodeOf: permalink에서 shortcode 추출", () => {
  assert.equal(shortcodeOf("https://www.instagram.com/p/DXgobeRTtNH/"), "DXgobeRTtNH");
  assert.equal(shortcodeOf("https://www.instagram.com/reel/DXom2vWj4p5/"), "DXom2vWj4p5");
  assert.equal(shortcodeOf("https://example.com/x"), null);
});

test("igUsername: 계정 URL에서 username 추출 (포스팅 경로 제외)", () => {
  assert.equal(igUsername("https://www.instagram.com/suesasha/"), "suesasha");
  assert.equal(igUsername("https://instagram.com/@ryu.xx___"), "ryu.xx___");
  assert.equal(igUsername("https://www.instagram.com/p/DXgobeRTtNH/"), null);
  assert.equal(igUsername("https://youtube.com/@chan"), null);
});

test("postIdOf: 인스타 shortcode / 유튜브 id", () => {
  assert.equal(postIdOf("https://www.instagram.com/p/ABC123/"), "ABC123");
  assert.equal(postIdOf("https://youtu.be/abcdef1"), "abcdef1");
});

// 가짜 Graph 응답으로 collect() 검증 (실제 네트워크 없음)
const fakeGraph = (byUser) => async (url) => {
  const decoded = decodeURIComponent(url);
  const m = decoded.match(/business_discovery\.username\(([^)]+)\)/);
  const username = m ? m[1] : "";
  return { json: async () => byUser[username] || { business_discovery: null } };
};

test("collect: username별 조회 후 shortcode→지표 매핑", async () => {
  const graph = fakeGraph({
    suesasha: {
      business_discovery: {
        followers_count: 250000,
        media: {
          data: [
            { permalink: "https://www.instagram.com/p/DXgobeRTtNH/", like_count: 699, comments_count: 7 },
            { permalink: "https://www.instagram.com/reel/ZZZ/", like_count: 1, comments_count: 2 },
          ],
          paging: { cursors: {} },
        },
      },
    },
  });
  const res = await collect([{ username: "suesasha", shortcode: "DXgobeRTtNH" }], graph);
  assert.deepEqual(res, { DXgobeRTtNH: { like: 699, comment: 7, follower: 250000 } });
});

test("collectApify: 포스트 지표 + 프로필 팔로워 병합", async () => {
  // 액터는 두 번 호출된다: resultsType posts(지표) / details(프로필 팔로워)
  const apify = async (url, opts) => {
    const input = JSON.parse(opts.body);
    if (input.resultsType === "posts") {
      assert.ok(input.directUrls.includes("https://www.instagram.com/reel/DXom2vWj4p5/"));
      return {
        ok: true,
        json: async () => [
          { shortCode: "DXom2vWj4p5", likesCount: 3093, commentsCount: 30, videoViewCount: 76000, ownerUsername: "suesasha" },
          { url: "https://www.instagram.com/p/DXgobeRTtNH/", likesCount: 699, commentsCount: 7, ownerUsername: "suesasha" },
        ],
      };
    }
    assert.equal(input.resultsType, "details"); // 프로필 스크랩
    assert.ok(input.directUrls.includes("https://www.instagram.com/suesasha/"));
    return { ok: true, json: async () => [{ username: "suesasha", followersCount: 191000 }] };
  };
  const res = await collectApify(
    [
      { url: "https://www.instagram.com/reel/DXom2vWj4p5/", shortcode: "DXom2vWj4p5", username: "suesasha" },
      { url: "https://www.instagram.com/p/DXgobeRTtNH/", shortcode: "DXgobeRTtNH", username: "suesasha" },
    ],
    apify
  );
  assert.deepEqual(res.DXom2vWj4p5, { like: 3093, comment: 30, view: 76000, follower: 191000 });
  assert.deepEqual(res.DXgobeRTtNH, { like: 699, comment: 7, follower: 191000 }); // 이미지 → view 없음
});

test("collectApify: 프로필 팔로워 스크랩 실패해도 나머지 지표는 유지", async () => {
  const apify = async (url, opts) => {
    const input = JSON.parse(opts.body);
    if (input.resultsType === "posts") {
      return { ok: true, json: async () => [{ shortCode: "AAA", likesCount: 10, commentsCount: 2 }] };
    }
    return { ok: false, status: 500, json: async () => ({}) }; // details 실패
  };
  const res = await collectApify([{ url: "https://www.instagram.com/p/AAA/", shortcode: "AAA", username: "x" }], apify);
  assert.deepEqual(res.AAA, { like: 10, comment: 2 }); // follower 없이도 like/comment 유지
});

test("collect: 못 찾은 shortcode는 결과에 없음, 개별 실패는 전체를 막지 않음", async () => {
  const graph = fakeGraph({
    a: { business_discovery: { followers_count: 10, media: { data: [], paging: { cursors: {} } } } },
    // b는 응답에 business_discovery 없음 → 건너뜀
  });
  const res = await collect(
    [{ username: "a", shortcode: "NOPE" }, { username: "b", shortcode: "X" }],
    graph
  );
  assert.deepEqual(res, {});
});
