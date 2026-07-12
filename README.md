# Posting Monitor

인플루언서 포스팅 모니터링 대시보드 (React + Vite)

## 시작

```bash
npm install
npm run dev
```

## 기능

- **프로젝트** — 생성 / 이름·색상 변경 / 삭제, 상단 스위처로 전환 (프로젝트별 데이터 분리)
- **엑셀 등록** — 시트 업로드로 포스팅 일괄 등록, 중복 자동 제외, 링크 유효성 검사
- **지표 자동 계산** — Impression / Reach / Engagement / AD Value / PR Value
- **밸류 기준표** — AD·PR 탭에서 팔로워 구간별 단가를 직접 편집 (채널별)
- **컬럼 필터** — 헤더 ▽ 아이콘에서 정렬 + 검색 + 다중 선택
- **동기화** — 버튼 클릭 시에만 실행, 마지막 동기화 시각 표시

## 엑셀 포맷

| Posting Date | Name | URL | Posting URL | Posting | Follower | View | Like | Comment |
|---|---|---|---|---|---|---|---|---|
| 2026-04-24 | 수사샤 | https://instagram.com/suesasha/ | https://instagram.com/p/DXgo… | 1 | 250000 | 38000 | 699 | 7 |

- 스토리는 `Posting URL`에 `IG STORY` 입력
- `Impression`, `Reach`, `Engagement`, `AD Value`, `PR Value` 컬럼은 있어도 무시되고 앱에서 재계산됨

## 접근 · 공유

- **로그인 없음(공개 대시보드).** 사이트 링크를 아는 사람은 누구나 조회·업로드·삭제·수정할 수 있다(의도된 설계).
- 데이터는 **Supabase**(Postgres) 백엔드에 저장되어 모두가 공유한다.
- 실행하려면 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 환경변수가 필요하다(없으면 "설정 필요" 화면).
- 접근 제어가 필요해지면 `supabase/schema.sql`의 RLS 정책을 인증 기반으로 되돌리면 된다.

## 배포

**Vercel + Supabase** 로 배포한다. Supabase 프로젝트 생성 → `supabase/schema.sql` 실행 →
Vercel 환경변수 등록. 전체 절차는 [DEPLOYMENT.md](./DEPLOYMENT.md) 참고.

## 데이터 저장

모두가 공유하는 **Supabase** 백엔드(`src/lib/storage.js` → `projects`/`postings`/`app_settings`).

자세한 도메인 규칙은 [CLAUDE.md](./CLAUDE.md) 참고.
