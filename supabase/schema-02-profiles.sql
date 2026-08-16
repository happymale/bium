-- ═══════════════════════════════════════════════════════════════
--  비움 BIUM — 프로필 (이름 · 사는 지역)
--
--  schema.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
--  SQL Editor → New query → 붙여넣기 → Run
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  -- auth.users 와 1:1. 익명 계정도 여기 행을 가집니다.
  id            uuid primary key references auth.users(id) on delete cascade,

  nickname      text not null default '',
  -- 자치구 코드 (예: 'sdm'). src/data/regions.ts 의 id 와 맞춥니다.
  region_id     text not null default 'sdm',
  -- 동 이름은 자유 입력 (배출 장소 안내 문구에만 쓰입니다)
  dong          text not null default '',

  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── RLS: 자기 프로필만 ─────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "내 프로필만 조회" on public.profiles;
create policy "내 프로필만 조회"
  on public.profiles for select
  to authenticated using (id = auth.uid());

drop policy if exists "내 프로필만 생성" on public.profiles;
create policy "내 프로필만 생성"
  on public.profiles for insert
  to authenticated with check (id = auth.uid());

drop policy if exists "내 프로필만 수정" on public.profiles;
create policy "내 프로필만 수정"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── 계정 생성 시 프로필 자동 생성 ──────────────────────────────
-- 익명 로그인으로 만들어진 계정도 여기서 함께 처리됩니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 확인 ───────────────────────────────────────────────────────
--   select id, nickname, region_id, dong from public.profiles;
