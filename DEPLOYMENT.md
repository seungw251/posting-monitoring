# 배포 가이드 (Vercel + Supabase, 로그인)

이 앱은 **이메일+비밀번호 로그인**이 필요하다. 회원가입한 사용자만 데이터를 조회·편집할 수 있고(별도 승인 없음),
비밀번호 분실 시 이메일로 재설정한다. 데이터(프로젝트/포스팅/밸류 기준표)는 **Supabase**에 저장되어 로그인 사용자들이 공유한다.

## 1. Supabase 프로젝트
1. [supabase.com](https://supabase.com) → 프로젝트 생성.
2. **SQL Editor** 에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체를 실행 → 테이블 3개 + 로그인 사용자용 RLS 정책 생성.
3. **Authentication → Providers → Email** 활성화.
   - 이메일 인증(Confirm email)을 켜면 가입 시 확인 메일을 눌러야 로그인된다(권장, 이메일 소유 확인). 끄면 가입 즉시 로그인.
4. **Authentication → URL Configuration**: **Site URL** 과 **Redirect URLs** 에 배포 도메인(예: `https://posting-monitoring.vercel.app`)을 등록.
   → 비밀번호 재설정/가입 확인 메일의 링크가 앱으로 정확히 돌아온다.
5. **Project Settings → API** 에서 복사:
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
- 배포된 주소를 열면 **로그인 화면**이 뜬다. **회원가입**으로 계정을 만들고 로그인한다.
- 비밀번호를 잊으면 로그인 화면의 **"비밀번호를 잊으셨나요?"** → 재설정 메일 → 링크 클릭 → 새 비밀번호 설정.
- **＋ 포스팅 등록(엑셀)** 으로 데이터를 올리면 Supabase에 저장되어 로그인 사용자들이 공유한다.

## 로컬 개발
```bash
cp .env.example .env      # VITE_SUPABASE_* 값 채우기
npm install
npm run dev               # http://localhost:5173
npm run build
npm test                  # 도메인 로직 단위 테스트
```

## 참고
- 승인 절차가 없으므로 이메일만 있으면 누구나 가입할 수 있다. 가입을 제한하려면
  Supabase Auth 설정에서 도메인 제한/초대 방식으로 바꾸거나, 관리자 승인 게이트를 추가한다.
- 비밀번호 재설정·가입 확인 메일은 Supabase 기본 메일로 발송되며 시간당 발송 한도가 있다.
  실사용 규모가 커지면 커스텀 SMTP를 연결한다.
