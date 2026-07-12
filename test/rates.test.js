import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RATES, rateFor, tierLabel, migrateRates } from "../src/lib/rates.js";

test("rateFor: 팔로워 구간 매칭 (경계 포함)", () => {
  assert.deepEqual(rateFor(0, "ig", DEFAULT_RATES), { ad: 500000, pr: 2500000 });
  assert.deepEqual(rateFor(9999, "ig", DEFAULT_RATES), { ad: 500000, pr: 2500000 });
  assert.deepEqual(rateFor(10000, "ig", DEFAULT_RATES), { ad: 1000000, pr: 5000000 });
  assert.deepEqual(rateFor(250000, "ig", DEFAULT_RATES), { ad: 8000000, pr: 40000000 });
  assert.deepEqual(rateFor(5000000, "ig", DEFAULT_RATES), { ad: 20000000, pr: 100000000 });
});

test("rateFor: 유튜버는 IG의 3배(기본값)", () => {
  const ig = rateFor(100000, "ig", DEFAULT_RATES);
  const yt = rateFor(100000, "youtube", DEFAULT_RATES);
  assert.equal(yt.ad, ig.ad * 3);
  assert.equal(yt.pr, ig.pr * 3);
});

test("rateFor: 알 수 없는 채널이면 ig로 폴백", () => {
  assert.deepEqual(rateFor(10000, "tiktok", DEFAULT_RATES), rateFor(10000, "ig", DEFAULT_RATES));
});

test("rateFor: 정렬되지 않은 tiers도 올바르게 매칭", () => {
  const unsorted = { ig: [{ min: 100000, ad: 5, pr: 25 }, { min: 0, ad: 1, pr: 5 }, { min: 10000, ad: 2, pr: 10 }] };
  assert.deepEqual(rateFor(50000, "ig", unsorted), { ad: 2, pr: 10 });
});

test("tierLabel: 구간 라벨 포맷", () => {
  const t = DEFAULT_RATES.ig;
  assert.equal(tierLabel(t, 0), "~ 9,999");
  assert.equal(tierLabel(t, 1), "10,000 ~ 49,999");
  assert.equal(tierLabel(t, t.length - 1), "1,000,000 ~");
});

test("migrateRates: 구버전 {min,value} → {min,ad,pr}", () => {
  const legacy = { ig: [{ min: 0, value: 500000 }], youtube: [], blog: [] };
  const out = migrateRates(legacy);
  assert.deepEqual(out.ig[0], { min: 0, ad: 500000, pr: 2500000 });
});

test("migrateRates: ig 없으면 기본값 반환", () => {
  assert.deepEqual(migrateRates({}), DEFAULT_RATES);
  assert.deepEqual(migrateRates(null), DEFAULT_RATES);
});
