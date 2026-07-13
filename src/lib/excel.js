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

/** 현재 행들을 워크북으로 변환 (동기화된 실측값·파생값 포함) */
export function buildWorkbook(rows) {
  const data = (rows || []).map((r) => ({
    "Posting Date": r.date,
    "Name": r.name,
    "URL": r.url,
    "Posting URL": r.postingUrl,
    "Posting": r.posting,
    "Follower": r.follower,
    "Impression": r.impression,
    "Reach": r.reach,
    "View": r.view,
    "Like": r.like,
    "Comment": r.comment,
    "Engagement": (r.like || 0) + (r.comment || 0),
    "AD Value": r.adValue,
    "PR Value": r.prValue,
    "Synced At": r.syncedAt || "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Postings");
  return wb;
}

/** 워크북을 파일로 내려받기 (브라우저에서 다운로드 트리거) */
export function exportRows(rows, filename = "posting-export.xlsx") {
  XLSX.writeFile(buildWorkbook(rows), filename);
}

/** 시트 헤더: Posting Date(=Date) | Name | URL | Posting URL | Posting | Follower | View | Like | Comment */
export async function parseWorkbook(file, projectId, rates) {
  // cellDates는 쓰지 않는다: SheetJS가 날짜 serial을 자정 직전(≈-52초)의 Date로 만들어
  // KST 등 UTC+ 타임존에서 하루 밀리는 버그가 있다. serial 숫자 그대로 읽어
  // toISO→serialToISO(순수 UTC 계산, TZ 무관)로 변환한다.
  const wb = XLSX.read(await file.arrayBuffer());
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
