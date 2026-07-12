import { test } from "node:test";
import assert from "node:assert/strict";
import { num, fmtShort, toISO, serialToISO, handleOf } from "../src/lib/format.js";

test("num: 콤마·통화기호·공백 제거 후 숫자화", () => {
  assert.equal(num("1,234"), 1234);
  assert.equal(num("₩ 5,000,000"), 5000000);
  assert.equal(num(""), 0);
  assert.equal(num(null), 0);
  assert.equal(num("abc"), 0);
  assert.equal(num(42), 42);
});

test("fmtShort: 억/만 단위 축약", () => {
  assert.equal(fmtShort(0), "0");
  assert.equal(fmtShort(9999), "9,999");
  assert.equal(fmtShort(120000), "12만");
  assert.equal(fmtShort(100000000), "1억");
  assert.equal(fmtShort(150000000), "1.5억");
});

test("serialToISO: 엑셀 시리얼 → ISO", () => {
  // 46136 = 2026-04-24 (시드 데이터 기준)
  assert.equal(serialToISO(46136), "2026-04-24");
});

test("toISO: 문자열/Date/시리얼 정규화", () => {
  assert.equal(toISO("2026-04-24"), "2026-04-24");
  assert.equal(toISO("2026.04.24"), "2026-04-24");
  assert.equal(toISO(""), "");
  assert.equal(toISO("not-a-date"), "");
  assert.equal(toISO(46136), "2026-04-24");
});

test("handleOf: 계정 URL → 핸들", () => {
  assert.equal(handleOf("https://www.instagram.com/suesasha/"), "suesasha");
  assert.equal(handleOf("https://youtube.com/@somechannel"), "somechannel");
});
