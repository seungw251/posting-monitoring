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

## 인증 · 접근 제어

- **등록된 사용자만** 접근, **관리자가 승인한 사용자만 입장**. 최초 가입자가 자동으로 관리자가 된다.
- 인증·권한·공유 데이터는 **Supabase**(Postgres + Auth + RLS)로 처리하며, 접근 제어는 서버측 **RLS**가 강제한다.
- 실행하려면 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 환경변수가 필요하다(없으면 "설정 필요" 화면).

## 배포

**Vercel + Supabase** 로 배포한다. Supabase 프로젝트 생성 → `supabase/schema.sql` 실행 →
Vercel 환경변수 등록 → 최초 관리자 가입. 전체 절차는 [DEPLOYMENT.md](./DEPLOYMENT.md) 참고.

## 데이터 저장

승인된 사용자들이 공유하는 **Supabase** 백엔드(`src/lib/storage.js` → `projects`/`postings`/`app_settings`).

자세한 도메인 규칙은 [CLAUDE.md](./CLAUDE.md) 참고.
