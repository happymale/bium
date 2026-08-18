-- ============================================================================
-- 비움 · 03 측정 컬럼
--
-- 제안서 §6-1~§6-3 의 지표 17개를 기기 밖에서도 보존하기 위한 컬럼입니다.
--
-- ⚠ 이 스크립트를 실행하지 않으면 측정값이 **동기화 과정에서 지워집니다.**
--   앱 시작 시 서버 목록을 받아 병합하는데, 서버에 컬럼이 없으면 그 값이
--   비어 있는 채로 돌아옵니다. 4주 실험 전에 반드시 실행하세요.
--
-- 실행 순서: schema.sql → schema-02-profiles.sql → 이 파일 → schema-04-views.sql
-- 이미 실행했더라도 다시 실행해도 안전합니다 (if not exists).
-- ============================================================================

-- ── items ───────────────────────────────────────────────────────────────────

alter table public.items
  -- K2 의 분모를 가릅니다. 'ai' 만 "판별한 물건" 으로 셉니다.
  add column if not exists origin text
    check (origin is null or origin in ('ai','manual','demo')),

  -- K5 의 출발점 — 사진을 고른 시각. 등록 시각(added_at)과 다릅니다.
  add column if not exists captured_at timestamptz,

  -- K2 퍼널 2단계 — 신청·예약이 접수된 시각
  add column if not exists requested_at timestamptz,

  -- 카운터④ — 실제로 어떻게 내보냈는지. route(안내한 경로)를 덮지 않습니다.
  add column if not exists disposal text
    check (disposal is null or disposal in ('as_guided','waste_bag')),

  -- K1 — 사용자가 알려준 판별 정답 여부. 답하지 않으면 null 로 남습니다.
  add column if not exists accuracy text
    check (accuracy is null or accuracy in ('correct','wrong')),
  add column if not exists accuracy_note text
    check (accuracy_note is null or accuracy_note in ('item','route','fee','other')),
  add column if not exists accuracy_dismissed boolean not null default false,

  -- K10 — 카테고리별 재사용 비율 분해 (AI 가 판단)
  add column if not exists category text
    check (category is null or category in (
      'furniture','appliance','textile','book_toy','houseware','hazardous','other'
    )),

  -- 카운터② — 무료로 내보낼 길이 있었는지 (AI 가 판단).
  -- route='bulk' 인데 이 값이 true 면 "무료로 될 일을 유료로 안내" 한 건입니다.
  add column if not exists free_alternative_available boolean,

  -- K7 — 이 물건을 지금 버리게 된 계기 (§3-1 의 S1~S4). 선택 입력.
  add column if not exists "trigger" text
    check ("trigger" is null or "trigger" in
      ('broken','cleanup','moving','outgrown','other')),

  -- K0 — 등록 전까지 얼마나 두고 있었는지. 선택 입력.
  -- added_at 은 "앱에 등록한 날"이라 방치 기간을 알 수 없어 물어야 합니다.
  add column if not exists idle_before text
    check (idle_before is null or idle_before in
      ('lt1m','m1to3','m3to6','m6to12','gt12m')),

  -- 카운터③ — 취득 12개월 이내인지. 선택 입력.
  add column if not exists acquired_age text
    check (acquired_age is null or acquired_age in ('within12m','over12m')),

  -- K8 — 신고 반려·예약 실패. AI 판단이 지자체 규정과 어긋난 사례.
  add column if not exists outcome text
    check (outcome is null or outcome in ('accepted','rejected')),

  -- K9 — 재사용 경로가 실제로 성사됐는지.
  -- 원래는 파트너 회신으로 확정되는 값이며, 지금은 사용자 자기신고입니다.
  add column if not exists reuse_outcome text
    check (reuse_outcome is null or reuse_outcome in
      ('completed','returned','unknown')),

  add column if not exists context_dismissed boolean not null default false;

-- 지표 집계는 "판별한 물건" 과 "완료된 물건" 을 항상 함께 걸러 봅니다.
create index if not exists items_origin_status_idx
  on public.items (user_id, origin, status);
-- K10 · K7 분해용
create index if not exists items_category_idx on public.items (category);
create index if not exists items_trigger_idx  on public.items ("trigger");

-- ── profiles ────────────────────────────────────────────────────────────────

alter table public.profiles
  -- 4주 실험 참가군. 'A' 판별만 · 'B' 판별+대행 · '' 미참가.
  -- 성공 기준이 두 그룹의 K2 차이라서 서버에도 남깁니다.
  add column if not exists experiment_group text not null default ''
    check (experiment_group in ('','A','B')),

  -- K6 — 세그먼트별 전환율. §2-1 의 1순위 고객이 정말 메인인지 봅니다.
  add column if not exists segment text not null default ''
    check (segment in ('','solo_new','solo_veteran','family')),

  -- K0 의 기준점 — "가입 14일 내 등록 개수" 를 재려면 가입일이 있어야 합니다.
  add column if not exists joined_at timestamptz;

-- ── 확인 ────────────────────────────────────────────────────────────────────
-- 아래를 실행하면 위 컬럼이 전부 보여야 합니다.
--
--   select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='items' order by ordinal_position;
