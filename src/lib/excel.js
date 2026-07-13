/** 엑셀 파싱 — 시트 컬럼을 앱 스키마로 변환 */
import * as XLSX from "xlsx";
import { toISO, uid } from "./format.js";
import { computeRow } from "./posting.js";

/** 헤더 정규화: 공백(일반/유니코드)·대소문자 차이를 무시하고 매칭 */
const norm = (k) => String(k).replace(/[\s ]+/g, "").toLowerCase();

/** row에서 alias 중 처음으로 값이 있는 컬럼을 찾아 반환 (헤더 변형에 강함) */
const pick = (row, keyCache, aliases) => {
  for (const a of aliases) {
    const key = keyCache.get(norm(a));
    if (key !== undefined && row[key] !== "" && row[key] != null) return row[key];
  }
  return "";
};

/** 시트 헤더: Posting Date(=Date) | Name | URL | Posting URL | Posting | Follower | View | Like | Comment */
export async function parseWorkbook(file, projectId, rates) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  return json.map((r) => {
    // 이 행의 실제 헤더 키를 정규화 → 원본 키로 매핑
    const keyCache = new Map(Object.keys(r).map((k) => [norm(k), k]));
    const g = (aliases) => pick(r, keyCache, aliases);
    return {
      id: uid(),
      projectId,
      ...computeRow(
        {
          date: toISO(g(["Posting Date", "Date", "날짜", "게시일"])),
          name: g(["Name", "이름", "인플루언서"]),
          url: g(["URL", "계정 URL", "Account URL", "채널"]),
          postingUrl: g(["Posting URL", "포스팅 URL", "포스팅 링크", "포스팅링크", "게시물 URL", "Post URL", "Link"]),
          posting: g(["Posting", "포스팅", "게시물 수", "건수"]) || 1,
          follower: g(["Follower", "팔로워", "구독자"]),
          view: g(["View", "조회", "조회수"]),
          like: g(["Like", "좋아요"]),
          comment: g(["Comment", "댓글"]),
        },
        rates
      ),
    };
  });
}
