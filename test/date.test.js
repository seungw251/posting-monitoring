import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/lib/excel.js";
import { toISO, serialToISO } from "../src/lib/format.js";
import { DEFAULT_RATES } from "../src/lib/rates.js";

test("serialToISO / toISO(number): 엑셀 serial → 정확한 날짜 (TZ 무관)", () => {
  assert.equal(serialToISO(46136), "2026-04-24");
  assert.equal(toISO(46136), "2026-04-24");
  assert.equal(toISO(46129), "2026-04-17");
});

test("parseWorkbook: 날짜서식 serial 셀을 하루 밀림 없이 파싱", async () => {
  // 실제 엑셀처럼 날짜서식이 걸린 숫자(serial) 셀
  const ws = {
    "!ref": "A1:F3",
    A1: { t: "s", v: "Posting Date" }, B1: { t: "s", v: "Name" }, C1: { t: "s", v: "URL" },
    D1: { t: "s", v: "Posting URL" }, E1: { t: "s", v: "Posting" }, F1: { t: "s", v: "Follower" },
    A2: { t: "n", v: 46136, z: "yyyy-mm-dd" }, B2: { t: "s", v: "수사샤" },
    C2: { t: "s", v: "https://www.instagram.com/suesasha/" },
    D2: { t: "s", v: "https://www.instagram.com/p/DXgobeRTtNH/" }, E2: { t: "n", v: 1 }, F2: { t: "n", v: 250000 },
    A3: { t: "s", v: "2026-04-17" }, B3: { t: "s", v: "안소미" },
    C3: { t: "s", v: "https://www.instagram.com/a.ssom/" }, D3: { t: "s", v: "IG STORY" }, E3: { t: "n", v: 1 }, F3: { t: "n", v: 270000 },
  };
  const wb = { SheetNames: ["S"], Sheets: { S: ws } };
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const rows = await parseWorkbook({ arrayBuffer: async () => buf }, "p", DEFAULT_RATES);
  assert.equal(rows[0].date, "2026-04-24"); // serial 46136
  assert.equal(rows[1].date, "2026-04-17"); // 문자열 날짜
});
