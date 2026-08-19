-- ============================================================================
-- 비움 · 05 지표 공유용 (선택 — 필요할 때만 실행)
--
-- 팀원이 아닌 사람(교수님·다른 조·심사자)에게 **지표 숫자만** 보여주고 싶을 때
-- 씁니다. 물건 목록·사진·사용자 id 는 어떤 경로로도 나가지 않습니다.
--
-- ── 왜 별도 뷰가 필요한가 ────────────────────────────────────────────────────
-- schema-04 의 metric_* 뷰는 security_invoker = true 입니다. 조회하는 사람의
-- RLS 를 따르므로, 로그인하지 않은 DB 계정으로 조회하면 auth.uid() 가 없어
-- **0 행**이 나옵니다. (앱 사용자가 남의 데이터를 못 보게 막는 장치입니다)
--
-- 여기 metrics 스키마의 뷰는 security_invoker 를 쓰지 않습니다. 뷰 소유자
-- (postgres) 권한으로 실행되어 RLS 를 통과합니다. 그래서 **행 단위 데이터를
-- 한 줄도 내보내지 않도록** 집계만 담았습니다 — count·round·median 뿐입니다.
--
-- ⚠ anon / authenticated 에는 절대 권한을 주지 않습니다.
--   anon 키는 브라우저 번들에 그대로 들어 있어서, 거기에 select 를 열면
--   앱을 받은 누구나 전체 집계를 읽을 수 있게 됩니다.
-- ============================================================================

create schema if not exists metrics;

-- 공유 뷰가 읽을 기반. RLS 를 통과하지만 밖으로 나가지 않습니다.
create or replace view metrics._base as
select
  i.id,
  i.user_id,
  p.experiment_group,
  p.segment,
  p.joined_at,
  i.route,
  i.category,
  i.status,
  i.disposal,
  i.outcome,
  i.reuse_outcome,
  i."trigger",
  i.idle_before,
  i.acquired_age,
  i.accuracy,
  i.free_alternative_available,
  i.added_at,
  i.disposed_at,
  (i.status = 'done'
    and i.route <> 'bulk'
    and coalesce(i.disposal, 'as_guided') <> 'waste_bag') as recirculated,
  case when i.status = 'done' and i.disposed_at is not null
    then extract(epoch from (i.disposed_at - i.added_at)) / 86400.0
  end as days_to_dispose,
  case when i.captured_at is not null and i.requested_at is not null
    then extract(epoch from (i.requested_at - i.captured_at))
  end as seconds_to_approve,
  case i.idle_before
    when 'lt1m' then 0.5 when 'm1to3' then 2.0 when 'm3to6' then 4.5
    when 'm6to12' then 9.0 when 'gt12m' then 18.0
  end as idle_months
from public.items i
left join public.profiles p on p.id = i.user_id
where coalesce(i.origin, 'ai') = 'ai';

-- ── 공유하는 것: 집계 세 개뿐 ───────────────────────────────────────────────

/** 지표 요약 — 개인 식별 정보가 하나도 없습니다 */
create or replace view metrics.summary as
select 1 as 순서, '대표' as 구분, '다시 쓰이게 된 비율' as 지표,
       round(100.0 * count(*) filter (where recirculated)
             / nullif(count(*) filter (where status = 'done'), 0), 1) as 값,
       '≥ 60%' as 목표,
       count(*) filter (where status = 'done') || '건 완료' as 표본
  from metrics._base
union all
select 2, '보조 K1', '판별 정확도',
       round(100.0 * count(*) filter (where accuracy = 'correct')
             / nullif(count(accuracy), 0), 1),
       '≥ 95%', count(accuracy) || '건 응답' from metrics._base
union all
select 3, '보조 K2', '판별 → 실행 전환율',
       round(100.0 * count(*) filter (where status = 'done')
             / nullif(count(*), 0), 1),
       '≥ 45%', count(*) || '건 판별' from metrics._base
union all
select 4, '보조 K3', '방치 일수 (중앙값)',
       round(percentile_cont(0.5) within group (order by days_to_dispose)::numeric, 1),
       '≤ 7일', count(days_to_dispose) || '건 완료' from metrics._base
union all
select 5, '보조 K5', '처리 소요 시간 (초)',
       round(percentile_cont(0.5) within group (order by seconds_to_approve)::numeric, 0),
       '≤ 60초', count(seconds_to_approve) || '건 측정' from metrics._base
union all
select 6, '보조 K8', '반려·실패율',
       round(100.0 * count(*) filter (where outcome = 'rejected')
             / nullif(count(*) filter (where status <> 'pending'
                                        or outcome = 'rejected'), 0), 1),
       '≤ 3%', count(*) filter (where status <> 'pending') || '건 시도'
  from metrics._base
union all
select 7, '보조 K9', '재사용 성사율',
       round(100.0 * count(*) filter (where reuse_outcome = 'completed')
             / nullif(count(*) filter (where reuse_outcome in
                       ('completed','returned')), 0), 1),
       '≥ 70%',
       count(*) filter (where reuse_outcome in ('completed','returned'))
         || '건 응답 (자기신고)' from metrics._base
union all
select 8, '카운터②', '유료 경로 유도율',
       round(100.0 * count(*) filter (where route = 'bulk'
                                       and free_alternative_available)
             / nullif(count(free_alternative_available), 0), 1),
       '≤ 8%', count(free_alternative_available) || '건 판단' from metrics._base
union all
select 9, '카운터④', '종량제 경로 선택률',
       round(100.0 * count(*) filter (where disposal = 'waste_bag')
             / nullif(count(*) filter (where status = 'done'), 0), 1),
       '≤ 10%', count(*) filter (where status = 'done') || '건 완료'
  from metrics._base
order by 1;

/** 실험군 비교 — §6-4 성공 기준. 사용자 수만 세고 id 는 내보내지 않습니다 */
create or replace view metrics.by_group as
select
  case experiment_group when 'A' then 'A · 판별만'
                        when 'B' then 'B · 판별+대행'
                        else '(미참가)' end as 그룹,
  count(distinct user_id)                  as 사용자수,
  count(*)                                 as 판별수,
  count(*) filter (where status = 'done')  as 완료수,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*), 0), 1)          as K2_퍼센트
from metrics._base group by experiment_group order by 1;

/** 카테고리별 재사용률 — K10 */
create or replace view metrics.by_category as
select
  case category
    when 'furniture' then '가구'      when 'appliance' then '가전'
    when 'textile'   then '의류·침구' when 'book_toy'  then '도서·완구'
    when 'houseware' then '생활잡화'  when 'hazardous' then '유해물질'
    when 'other'     then '그 밖에'   else '(미분류)'
  end                                     as 카테고리,
  count(*)                                as 완료수,
  count(*) filter (where recirculated)    as 다시쓰임,
  round(100.0 * count(*) filter (where recirculated)
        / nullif(count(*), 0), 1)         as 재사용률_퍼센트
from metrics._base where status = 'done' group by category order by 2 desc;

-- ── 권한 ────────────────────────────────────────────────────────────────────

-- 기반 뷰는 절대 공유하지 않습니다 (행 단위가 보입니다)
revoke all on metrics._base from public, anon, authenticated;

-- 앱의 anon 키로는 읽히지 않게 명시적으로 막습니다
revoke all on metrics.summary, metrics.by_group, metrics.by_category
  from anon, authenticated;

-- ── 읽기 전용 계정 만들기 ───────────────────────────────────────────────────
-- 아래 두 줄의 '여기에_긴_임의_비밀번호' 를 바꾼 뒤 실행하세요.
-- 비밀번호는 채팅·문서에 붙여넣지 말고 상대에게 따로 전달하십시오.
--
--   do $$
--   begin
--     if not exists (select 1 from pg_roles where rolname = 'metrics_viewer') then
--       create role metrics_viewer login password '여기에_긴_임의_비밀번호';
--     end if;
--   end $$;
--
--   grant usage on schema metrics to metrics_viewer;
--   grant select on metrics.summary, metrics.by_group, metrics.by_category
--     to metrics_viewer;
--
-- 접속 정보는 Dashboard → Settings → Database → Connection string 에서
-- 사용자 이름만 metrics_viewer 로 바꿔 전달하면 됩니다.
-- 상대는 DBeaver·TablePlus·psql 로 붙어 세 뷰만 조회할 수 있습니다.
--
-- 회수: revoke all on schema metrics from metrics_viewer; drop role metrics_viewer;

-- ── 확인 ────────────────────────────────────────────────────────────────────
--   select * from metrics.summary;
--   select * from metrics.by_group;
