-- ═══════════════════════════════════════════════════════════════
--  비움 BIUM — Supabase 스키마
--
--  Supabase 대시보드 → SQL Editor → New query 에 통째로 붙여넣고 Run.
--  여러 번 실행해도 안전합니다 (if not exists / drop policy if exists).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 물건 테이블 ─────────────────────────────────────────────
create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),

  -- 익명 로그인 사용자도 auth.users 에 행이 생깁니다.
  -- 기기별로 자동 생성되며, 나중에 이메일을 연결해도 id 가 유지됩니다.
  user_id           uuid not null default auth.uid()
                      references auth.users(id) on delete cascade,

  name              text not null,
  route             text not null check (route in ('reuse','free','bulk','drop')),

  -- 금액은 항상 지자체 요금표에서 조회한 값입니다 (AI 가 만들지 않음)
  fee               integer not null default 0,
  fee_spec          text,
  fee_matched_name  text,

  -- Storage 안의 경로. 이미지 자체는 여기 넣지 않습니다.
  photo_path        text,

  confidence        real,
  basis             text,

  status            text not null default 'pending'
                      check (status in ('pending','requested','done')),
  added_at          timestamptz not null default now(),
  disposed_at       timestamptz,
  destination       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 목록은 "방치일수 내림차순 + 내 것만" 으로 읽으므로 이 조합에 인덱스를 둡니다
create index if not exists items_user_added_idx
  on public.items (user_id, added_at desc);

create index if not exists items_user_status_idx
  on public.items (user_id, status);

-- ── 2. updated_at 자동 갱신 ────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

-- ── 3. RLS — 남의 데이터는 아예 안 보입니다 ────────────────────
-- 이 앱은 "집에 뭐가 있는지" 를 다룹니다. 격리가 핵심입니다.
alter table public.items enable row level security;

drop policy if exists "내 물건만 조회" on public.items;
create policy "내 물건만 조회"
  on public.items for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "내 물건만 추가" on public.items;
create policy "내 물건만 추가"
  on public.items for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "내 물건만 수정" on public.items;
create policy "내 물건만 수정"
  on public.items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "내 물건만 삭제" on public.items;
create policy "내 물건만 삭제"
  on public.items for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 4. 사진 저장소 ─────────────────────────────────────────────
-- public = false : 링크를 알아도 남이 못 봅니다. 앱은 서명 URL 로 읽습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로 규칙: photos/<user_id>/<uuid>.jpg
-- 첫 번째 폴더명이 본인 user id 일 때만 허용합니다.
drop policy if exists "내 사진만 업로드" on storage.objects;
create policy "내 사진만 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "내 사진만 조회" on storage.objects;
create policy "내 사진만 조회"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "내 사진만 삭제" on storage.objects;
create policy "내 사진만 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 5. 확인용 ──────────────────────────────────────────────────
-- 아래를 실행하면 정책이 제대로 걸렸는지 볼 수 있습니다.
--   select tablename, policyname from pg_policies where schemaname = 'public';
--   select id, public from storage.buckets where id = 'photos';
