# 실배포 가이드 (Vercel + Supabase 인증)

이 앱은 **등록된 사용자만** 접근할 수 있고, **관리자가 승인한 사용자만 입장**한다.
접근 제어는 프론트 화면이 아니라 **Supabase RLS(Row Level Security)** 가 서버측에서 강제한다.
데이터(프로젝트/포스팅/밸류 기준표)는 승인된 사용자들이 **공유**한다.

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) → 새 프로젝트 생성(기존 조직 재사용 가능).
2. **SQL Editor** 에서 저장소의 [`supabase/schema.sql`](./supabase/schema.sql) 전체를 붙여넣고 **Run**.
   - 테이블(`profiles`, `projects`, `postings`, `app_settings`), RLS 정책, 신규 가입 트리거가 생성된다.
3. **Authentication → Providers → Email** 활성화. 소규모 내부 도구라면
   **Confirm email 을 꺼두는 것을 권장**한다(실제 게이트는 관리자 승인이므로).
4. **Project Settings → API** 에서 다음 두 값을 복사:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`
   > `service_role` 키는 서버 전용이다. **절대 프론트/환경변수에 넣지 않는다.**

## 2. Vercel 배포

1. Vercel → **Add New → Project** → 이 GitHub 저장소 임포트.
2. Framework Preset: **Vite** (자동 감지). Build `npm run build`, Output `dist`.
3. **Settings → Environment Variables** 에 등록(Production/Preview 모두):
   ```
   VITE_SUPABASE_URL      = https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY = <anon public key>
   ```
   (지표 실측 백엔드가 있으면 `VITE_METRICS_API_URL` 도 추가 — 선택.)
4. Deploy. 환경변수가 비어 있으면 앱은 "설정 필요" 화면을 표시한다.
   - `vercel.json` 의 rewrite 로 새로고침/딥링크 시에도 SPA가 정상 로드된다.

## 3. 최초 관리자 지정

- **최초로 가입한 사용자가 자동으로 관리자(admin) + 승인(approved)** 이 된다(트리거).
  배포 후 **본인이 가장 먼저 가입**하면 된다.
- 이후 상단바의 **⚙ 사용자 관리** 에서 다른 가입자를 **승인/거부/관리자 지정** 한다.
- 자동 지정이 안 됐거나 다른 계정을 관리자로 만들려면 Supabase SQL Editor에서:
  ```sql
  update public.profiles set role='admin', status='approved' where email='you@example.com';
  ```

## 4. 사용자 흐름

1. 새 사용자가 이메일/비밀번호로 **가입** → 상태 `pending` → "승인 대기 중" 화면.
2. 관리자가 **사용자 관리** 에서 승인 → 해당 사용자 입장 가능.
3. 승인된 사용자들은 같은 프로젝트/포스팅/기준표 데이터를 **공유**한다.

## 로컬 개발

```bash
cp .env.example .env      # VITE_SUPABASE_* 값 채우기
npm install
npm run dev               # http://localhost:5173
npm run build
npm test                  # 도메인 로직 단위 테스트
```

## 참고 · 한계

- `anon` 키는 공개돼도 안전한 설계값이다. 실제 보안 경계는 `supabase/schema.sql` 의 **RLS 정책**이다.
- (v1) 데이터 저장은 클라이언트 상태 기준 전체 조정(upsert + 삭제)이다. 여러 명이 동시에 편집하면
  마지막 저장이 우선한다. 실시간 동시 편집이 필요해지면 행 단위 연산/충돌 처리로 확장한다.
