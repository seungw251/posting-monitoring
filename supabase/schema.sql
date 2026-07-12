-- ════════════════════════════════════════════════════════════════════════
-- Posting Monitor — Supabase 스키마 (인증 · 권한 · 공유 데이터)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행한다.
-- 접근 제어의 실제 경계는 아래 RLS 정책이다 (프론트 화면은 UX용).
-- ════════════════════════════════════════════════════════════════════════

-- ── 프로필: 사용자 권한(role)과 승인 상태(status) ──────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  role       text not null default 'member'  check (role   in ('admin','member')),
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- 마스터(최고 관리자) 계정 이메일. 이 계정은 가입 순서와 무관하게 항상 관리자·승인이며,
-- 다른 관리자가 강등/거부할 수 없다. 마스터를 바꾸려면 아래 두 곳의 이메일을 함께 수정한다.
--   (1) handle_new_user()  (2) protect_master()

-- 신규 가입 시 프로필 자동 생성.
-- 마스터 이메일만 관리자(admin)+승인(approved), 그 외 모든 사용자는 member + pending(승인 대기).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, status)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'rengo@kakao.com' then 'admin'    else 'member'  end,
    case when lower(new.email) = 'rengo@kakao.com' then 'approved' else 'pending' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 마스터 보호: 마스터 이메일 행은 항상 admin+approved로 강제된다(강등/거부 시도 무효화).
create or replace function public.protect_master()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if lower(new.email) = 'rengo@kakao.com' then
    new.role := 'admin';
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_master_row on public.profiles;
create trigger protect_master_row
  before insert or update on public.profiles
  for each row execute function public.protect_master();

-- ── 권한 판정 헬퍼 (RLS에서 사용) ─────────────────────────────────────────
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

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

-- ── RLS 활성화 ────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.projects     enable row level security;
alter table public.postings     enable row level security;
alter table public.app_settings enable row level security;

-- profiles: 본인 행은 조회 가능, 관리자는 전체 조회·수정(승인/거부/승격) 가능.
-- INSERT는 트리거(security definer)가 전담하므로 공개 INSERT 정책을 두지 않는다.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 공유 데이터: 승인된 사용자만 모든 CRUD 가능 → pending 사용자는 데이터가 전부 차단됨.
do $$
declare t text;
begin
  foreach t in array array['projects','postings','app_settings'] loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format(
      'create policy %I_all on public.%I for all using (public.is_approved()) with check (public.is_approved());',
      t, t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 기존 데이터 보정 (마스터가 이미 가입했거나, 스키마 갱신 후 1회 실행)
--   마스터를 확실히 관리자·승인으로: (미가입이면 0건 갱신 — 무해)
update public.profiles set role='admin', status='approved' where lower(email)='rengo@kakao.com';
--   (선택) 마스터가 아닌데 관리자가 된 계정을 일반으로 강등하려면 아래 주석 해제:
-- update public.profiles set role='member' where lower(email)<>'rengo@kakao.com' and role='admin';
--
-- 관리자 추가 지정: 마스터가 앱의 "사용자 관리"에서 승인 후 "관리자로" 버튼으로 지정한다.
-- ════════════════════════════════════════════════════════════════════════
