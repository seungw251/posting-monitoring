import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildWorkbook } from "../src/lib/excel.js";

test("buildWorkbook: 행을 시트로(파생 Engagement 포함) 변환", () => {
  const rows = [
    { date: "2026-04-26", name: "규원규진", url: "https://insta/q2han",
      postingUrl: "https://www.instagram.com/p/DXk2R6Dk-mt/", posting: 1, follower: 323000,
      impression: 323000, reach: 323000, view: 76000, like: 2571, comment: 27,
      adValue: 5000000, prValue: 25000000, syncedAt: "2026-07-13T00:00:00Z" },
  ];
  const wb = buildWorkbook(rows);
  const out = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  assert.equal(out.length, 1);
  assert.equal(out[0].Name, "규원규진");
  assert.equal(out[0]["Posting URL"], "https://www.instagram.com/p/DXk2R6Dk-mt/");
  assert.equal(out[0].Like, 2571);
  assert.equal(out[0].Engagement, 2598); // like + comment
  assert.equal(out[0]["AD Value"], 5000000);
  assert.equal(out[0]["Synced At"], "2026-07-13T00:00:00Z");
});

test("buildWorkbook: 빈 입력도 안전", () => {
  const wb = buildWorkbook([]);
  assert.ok(wb.SheetNames.includes("Postings"));
});
