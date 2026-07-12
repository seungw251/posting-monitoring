/** 엑셀 파싱 — 시트 컬럼을 앱 스키마로 변환 */
import * as XLSX from "xlsx";
import { toISO, uid } from "./format.js";
import { computeRow } from "./posting.js";

/** 시트 헤더: Posting Date(=Date) | Name | URL | Posting URL | Posting | Follower | View | Like | Comment */
export async function parseWorkbook(file, projectId, rates) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  return json.map((r) => ({
    id: uid(),
    projectId,
    ...computeRow(
      {
        date: toISO(r["Posting Date"] ?? r["Date"] ?? r["date"] ?? r["날짜"]),
        name: r["Name"] ?? r["이름"] ?? "",
        url: r["URL"] ?? r["url"] ?? "",
        postingUrl: r["Posting URL"] ?? r["포스팅 URL"] ?? "",
        posting: r["Posting"] ?? 1,
        follower: r["Follower"],
        view: r["View"],
        like: r["Like"],
        comment: r["Comment"],
      },
      rates
    ),
  }));
}
