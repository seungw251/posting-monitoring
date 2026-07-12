-- ════════════════════════════════════════════════════════════════════════
-- Posting Monitor — Supabase 스키마 (로그인 없는 공개 공유 데이터)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행한다.
--
-- ⚠️ 로그인/인증 없음(의도된 설계). 사이트 링크를 아는 사람은 누구나
--    데이터를 조회·업로드·삭제·수정할 수 있다. 접근 제어가 필요해지면
--    RLS 정책을 인증 기반으로 되돌리면 된다.
-- ════════════════════════════════════════════════════════════════════════

-- ── 공유 데이터 테이블 ────────────────────────────────────────────────────
create table if not exists public.projects (
  id         text primary key,
  name       text not null,
  color      text,
  created_at timestamptz not null default now()
);

create table if not exists public.postings (
  id         text primary key,
  project_id text references public.projects(id) on delete cascade,
  data       jsonb not null,      -- computeRow 출력(행 전체 페이로드)
  created_at timestamptz not null default now()
);
create index if not exists postings_project_idx on public.postings(project_id);

-- 팀 공유 밸류 기준표 + 마지막 동기화 시각 (단일 행)
create table if not exists public.app_settings (
  id        int primary key default 1 check (id = 1),
  rates     jsonb,
  last_sync jsonb
);

-- ── RLS: 공개(익명 포함 전체 CRUD) ────────────────────────────────────────
alter table public.projects     enable row level security;
alter table public.postings     enable row level security;
alter table public.app_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','postings','app_settings'] loop
    -- 이전(인증 기반) 정책이 있으면 제거
    execute format('drop policy if exists %I_all    on public.%I;', t, t);
    execute format('drop policy if exists %I_public on public.%I;', t, t);
    execute format(
      'create policy %I_public on public.%I for all using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- ── (선택) 예전 인증 방식 잔여물 정리 ─────────────────────────────────────
-- 로그인 버전에서 넘어온 경우 아래를 실행하면 사용자/권한 관련 객체를 제거한다.
--   drop trigger  if exists on_auth_user_created on auth.users;
--   drop trigger  if exists protect_master_row   on public.profiles;
--   drop function if exists public.handle_new_user();
--   drop function if exists public.protect_master();
--   drop function if exists public.is_approved();
--   drop function if exists public.is_admin();
--   drop table    if exists public.profiles;
