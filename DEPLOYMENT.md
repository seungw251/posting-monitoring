# 배포 가이드 (Vercel + Supabase, 로그인 없음)

이 앱은 **로그인이 없다.** 사이트 링크를 아는 사람은 누구나 데이터를 조회·업로드·삭제·수정할 수 있다(의도된 설계).
데이터(프로젝트/포스팅/밸류 기준표)는 **Supabase** 백엔드에 저장되어 모두가 공유한다.

> ⚠️ 링크만 있으면 누구나 데이터를 바꾸거나 지울 수 있으므로 **URL을 아는 사람을 신뢰 범위로 관리**한다.
> Supabase 대시보드에서 주기적 백업을 켜두는 것을 권장한다. 접근 제어가 필요해지면 RLS를 인증 기반으로 되돌린다.

## 1. Supabase 프로젝트
1. [supabase.com](https://supabase.com) → 프로젝트 생성.
2. **SQL Editor** 에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체를 실행 → 테이블 3개 + 공개 RLS 정책 생성.
3. **Project Settings → API** 에서 복사:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`  (`service_role` 키는 절대 프론트에 넣지 않는다.)

## 2. Vercel 배포
1. Vercel → **Add New → Project** → 이 저장소 임포트 (Framework: **Vite** 자동 감지).
2. **Settings → Environment Variables** (Production/Preview):
   ```
   VITE_SUPABASE_URL      = https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY = <anon public key>
   ```
   (지표 실측 백엔드가 있으면 `VITE_METRICS_API_URL` 도 추가 — 선택.)
3. Deploy. 환경변수가 비어 있으면 "설정 필요" 화면이 뜬다.
   `vercel.json` rewrite 로 새로고침/딥링크도 정상 로드된다.

## 3. 사용
- 배포된 주소를 열면 **바로 대시보드**가 뜬다(로그인 없음).
- **＋ 포스팅 등록(엑셀)** 으로 데이터를 올리면 Supabase에 저장되어 모두가 공유한다.

## 로컬 개발
```bash
cp .env.example .env      # VITE_SUPABASE_* 값 채우기
npm install
npm run dev               # http://localhost:5173
npm run build
npm test                  # 도메인 로직 단위 테스트
```

## 나중에 접근 제어가 필요해지면
`supabase/schema.sql` 의 공개 정책(`using (true)`)을 인증 기반으로 바꾸고,
Supabase Auth(비밀번호/매직링크/소셜) + 프론트 로그인 게이트를 다시 붙이면 된다.
