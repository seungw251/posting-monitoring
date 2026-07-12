# Posting Monitor — 프로젝트 컨텍스트

인플루언서 캠페인의 포스팅 성과를 프로젝트 단위로 추적하는 대시보드.
엑셀로 포스팅을 등록하고, 밸류 기준표로 AD/PR Value를 산출한다.

## 스택
Vite + React 18 (JS, TypeScript 아님) / 상태는 useState + localStorage / 스타일은 순수 CSS(`src/styles.css`, CSS 변수 기반)
UI 라이브러리·CSS 프레임워크 없음. 새 의존성 추가는 먼저 물어볼 것.

## 디렉터리
```
src/
  App.jsx              화면 전체 (탭, 리스트, 모달) — 유일한 대형 컴포넌트
  styles.css           전체 스타일 (CSS 변수: --ink, --acc, --ok, --warn, --err …)
  components/
    ColFilter.jsx      컬럼 헤더 필터 팝오버 (정렬 + 검색 + 체크박스 다중선택)
  lib/
    format.js          num/fmt/fmtShort/toISO/timeAgo/handleOf
    rates.js           밸류 기준표(DEFAULT_RATES), rateFor, tierLabel, migrateRates
    posting.js         computeRow, dedupeKey, checkUrl, postType, isStory, cellVal
    excel.js           parseWorkbook — 시트 → 앱 스키마
    sync.js            syncRows — 지표 동기화 (백엔드 연동 지점)
    storage.js         loadState/saveState — localStorage 어댑터
  data/seed.js         초기 시드 21건, PALETTE, DEFAULT_PROJECT
```

## 도메인 규칙 (변경 시 주의)
- `Impression = Follower × Posting`
- `Reach = Follower`
- `View / Like / Comment` — IG STORY는 항상 0
- `Engagement = Like + Comment` (파생값, 저장하지 않음)
- `AD Value = 구간 AD 단가 × Posting`, **IG STORY는 50%**
- `PR Value = 구간 PR 단가 × Posting` (기본값 AD × 5, 기준표에서 개별 수정 가능)
- 팔로워 구간표는 채널별(IG / 유튜버 / 블로그)로 따로 존재. 유튜버는 IG의 3배가 기본.

## 중복 판정 (`dedupeKey`)
- 링크 있는 포스팅: `프로젝트 + 인플루언서 + 포스팅 링크` (날짜 무관)
- IG STORY: 고유 링크가 없어 `프로젝트 + 인플루언서 + 날짜`
같은 인플루언서가 다른 포스팅을 여러 건 올리는 것은 정상이므로 이름만으로 중복 처리하면 안 된다.

## 업로드 흐름
1. `＋ 포스팅 등록 (엑셀)` → 파일 선택 (개별 입력 폼은 의도적으로 없음)
2. 전체 파싱 → 중복 자동 제외
3. 링크 유효성 검사(`checkUrl`) → 오류가 있으면 확인 모달:
   "오류 N건 삭제하고 등록" / "무시하고 모두 등록" / 취소
4. 결과 모달에 등록·중복·오류 건수 표시

## 동기화 (`src/lib/sync.js`) — 다음 작업 후보
현재는 밸류 기준표로 파생 지표만 재계산한다.
View/Like/Comment 실측은 **백엔드가 필요**하다. 브라우저에서 인스타그램을 직접 호출하는 것은
CORS와 플랫폼 약관상 불가능하므로, 서버에서 Instagram Graph API(비즈니스 계정 + 액세스 토큰)로
수집한 뒤 `fetchMetrics`가 그 엔드포인트를 호출하도록 바꾼다. `VITE_METRICS_API_URL` 참고.
자동 폴링은 넣지 않는다 — 동기화는 **버튼 클릭 시에만** 실행한다(의도된 설계).

## UI 원칙
- 탭: `Total`(리스트) / `AD Value`·`PR Value`(기준표 편집 화면)
- 필터는 컬럼 헤더의 ▽ 아이콘에만 존재. 별도 필터바는 두지 않는다(제거된 이력 있음).
- 리스트 컬럼 순서는 원본 엑셀과 동일하게 유지한다.
- 행 개별 수정 버튼 없음. 체크박스 선택 → 선택 삭제만 제공.

## 명령
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```
