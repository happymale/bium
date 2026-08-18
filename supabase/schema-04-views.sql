-- ============================================================================
-- 비움 · 04 지표 조회용 뷰
--
-- 제안서 §6 의 지표 17개를 **뷰 하나당 하나씩** 만들어 둡니다.
-- Supabase → Table Editor 에서 뷰 이름을 고르거나, SQL Editor 에서
--
--     select * from metric_north_star;
--
-- 처럼 조회하면 됩니다. 쿼리를 직접 쓰지 않아도 됩니다.
--
-- 뷰 이름 규칙: metric_<지표>
--   metric_north_star   대표 지표 (다시 쓰이게 된 비율)
--   metric_k0 ~ k11     보조 지표
--   metric_counter_1~4  카운터 메트릭
--   metric_overview     한 화면에 다 보이는 요약
--   metric_by_group     실험군 A/B 비교 (§6-4 성공 기준)
--
-- ★ 모든 뷰는 origin='ai' 인 물건만 셉니다.
--   직접 추가(manual)와 시연용 예시(demo)를 섞으면 지표가 왜곡됩니다.
--
-- ⚠ 보안: 뷰는 security_invoker 로 만들어 조회하는 사람의 RLS 를 따릅니다.
--   즉 **앱 사용자는 자기 데이터만** 보이고, 대시보드(SQL Editor)에서는
--   service_role 로 실행되므로 전체 집계가 보입니다.
-- ============================================================================

-- ── 공통 기반 ───────────────────────────────────────────────────────────────
-- 판별을 거친 물건만 남기고, 지표에 쓰는 파생값을 미리 계산해 둡니다.

create or replace view metric_base
with (security_invoker = true) as
select
  i.id,
  i.user_id,
  p.experiment_group,
  p.segment,
  p.joined_at,
  i.route,
  i.category,
  i.status,
  i.fee,
  i.disposal,
  i.outcome,
  i.reuse_outcome,
  i."trigger",
  i.idle_before,
  i.acquired_age,
  i.accuracy,
  i.accuracy_note,
  i.free_alternative_available,
  i.captured_at,
  i.added_at,
  i.requested_at,
  i.disposed_at,
  -- 실제로 다시 쓰이게 됐는지: 대형폐기물도 아니고 종량제로도 안 간 것
  (i.status = 'done'
    and i.route <> 'bulk'
    and coalesce(i.disposal, 'as_guided') <> 'waste_bag') as recirculated,
  -- K3 — 등록 → 완료 일수
  case when i.status = 'done' and i.disposed_at is not null
    then extract(epoch from (i.disposed_at - i.added_at)) / 86400.0
  end as days_to_dispose,
  -- K5 — 촬영 → 승인 초. 둘 다 있는 건만 계산합니다.
  case when i.captured_at is not null and i.requested_at is not null
    then extract(epoch from (i.requested_at - i.captured_at))
  end as seconds_to_approve,
  -- K0 — 방치 개월(사용자 응답을 대표값으로 환산)
  case i.idle_before
    when 'lt1m'   then 0.5
    when 'm1to3'  then 2.0
    when 'm3to6'  then 4.5
    when 'm6to12' then 9.0
    when 'gt12m'  then 18.0
  end as idle_months
from public.items i
left join public.profiles p on p.id = i.user_id
where coalesce(i.origin, 'ai') = 'ai';

comment on view metric_base is
  '지표 계산의 공통 기반. 판별(origin=ai)한 물건만. 다른 뷰는 전부 이걸 씁니다.';

-- ── 대표 지표 ───────────────────────────────────────────────────────────────

create or replace view metric_north_star
with (security_invoker = true) as
select
  count(*) filter (where status = 'done')                as 처리완료,
  count(*) filter (where recirculated)                   as 다시쓰임,
  round(100.0 * count(*) filter (where recirculated)
        / nullif(count(*) filter (where status = 'done'), 0), 1) as 비율_퍼센트,
  60  as 목표_6개월,
  75  as 목표_12개월
from metric_base;

comment on view metric_north_star is
  '§6-1 다시 쓰이게 된 비율. 종량제로 간 물건은 route 가 reuse 여도 제외합니다.';

-- ── 보조 지표 ───────────────────────────────────────────────────────────────

-- K0 문제 실재성
create or replace view metric_k0
with (security_invoker = true) as
select
  count(distinct user_id)                                as 사용자수,
  round(avg(cnt_14d), 2)                                 as 가입14일내_평균등록수,
  3                                                      as 목표_등록수,
  (select round(percentile_cont(0.5) within group (order by idle_months)::numeric, 1)
     from metric_base where idle_months is not null)      as 방치개월_중앙값,
  2                                                      as 목표_방치개월,
  (select count(*) from metric_base where idle_before is not null) as 방치기간_응답수,
  (select count(*) from metric_base)                      as 전체_판별수
from (
  select user_id,
         count(*) filter (
           where joined_at is not null and added_at <= joined_at + interval '14 days'
         ) as cnt_14d
  from metric_base group by user_id
) t;

comment on view metric_k0 is
  'K0 초기 적체. 방치개월은 사용자가 답해준 건만 셉니다 — 응답수를 함께 보세요.';

-- K1 판별 정확도
create or replace view metric_k1
with (security_invoker = true) as
select
  count(*)                                               as 판별수,
  count(accuracy)                                        as 응답수,
  count(*) filter (where accuracy = 'correct')           as 정확,
  round(100.0 * count(*) filter (where accuracy = 'correct')
        / nullif(count(accuracy), 0), 1)                 as 정확도_퍼센트,
  round(100.0 * count(accuracy) / nullif(count(*), 0), 1) as 응답률_퍼센트,
  95                                                     as 목표
from metric_base;

comment on view metric_k1 is
  'K1 판별 정확도. 응답률이 낮으면 표본을 믿을 수 없으니 함께 보세요.';

-- K1 보조: 무엇이 틀렸는지
create or replace view metric_k1_wrong_reasons
with (security_invoker = true) as
select
  coalesce(accuracy_note, '(사유 미응답)')                as 틀린_이유,
  count(*)                                               as 건수
from metric_base
where accuracy = 'wrong'
group by 1 order by 2 desc;

-- K2 판별 → 실행 전환율
create or replace view metric_k2
with (security_invoker = true) as
select
  count(*)                                                        as 판별_등록,
  count(*) filter (where requested_at is not null or status <> 'pending') as 신청_예약,
  count(*) filter (where status = 'done')                         as 처리완료,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*), 0), 1)                                 as 전환율_퍼센트,
  45                                                              as 목표
from metric_base;

comment on view metric_k2 is 'K2 판별→실행 전환율. §6-4 성공 기준의 핵심 지표.';

-- K3 방치 일수
create or replace view metric_k3
with (security_invoker = true) as
select
  count(days_to_dispose)                                          as 완료건수,
  round(percentile_cont(0.5) within group (order by days_to_dispose)::numeric, 1)
                                                                  as 중앙값_일,
  round(avg(days_to_dispose)::numeric, 1)                         as 평균_일,
  7                                                               as 목표_일,
  128                                                             as AS_IS_일
from metric_base where days_to_dispose is not null;

-- K4 재방문율은 DB 로 계산하지 않습니다 (세션 개념이 없음).
-- GA4 → 보고서 → 보존율 에서 코호트로 확인하세요.

-- K5 처리 소요 시간
create or replace view metric_k5
with (security_invoker = true) as
select
  count(seconds_to_approve)                                       as 측정건수,
  round(percentile_cont(0.5) within group (order by seconds_to_approve)::numeric, 0)
                                                                  as 중앙값_초,
  round(percentile_cont(0.9) within group (order by seconds_to_approve)::numeric, 0)
                                                                  as p90_초,
  60                                                              as 목표_초
from metric_base where seconds_to_approve is not null;

comment on view metric_k5 is
  'K5 촬영→승인. 평균이 아니라 중앙값을 보세요 — 며칠 뒤 승인한 건이 이상치로 섞입니다.';

-- K6 세그먼트별 전환율
create or replace view metric_k6
with (security_invoker = true) as
select
  case segment
    when 'solo_new'     then '자취 3년 이내 (타깃)'
    when 'solo_veteran' then '자취 3년 초과'
    when 'family'       then '가족·동거'
    else '(미응답)'
  end                                                             as 세그먼트,
  count(*)                                                        as 판별수,
  count(*) filter (where status = 'done')                         as 완료수,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*), 0), 1)                                 as K2_퍼센트
from metric_base group by segment order by 2 desc;

comment on view metric_k6 is
  'K6. 타깃(자취 3년 이내)의 K2 가 비타깃 대비 1.3배 이상인지 봅니다.';

-- K7 트리거별 유입·전환
create or replace view metric_k7
with (security_invoker = true) as
select
  case "trigger"
    when 'broken'   then 'S1 고장'
    when 'cleanup'  then 'S2 대청소·정리'
    when 'moving'   then 'S3 이사·입주'
    when 'outgrown' then 'S4 육아용품 졸업'
    when 'other'    then '그 밖에'
    else '(미응답)'
  end                                                             as 트리거,
  count(*)                                                        as 등록수,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1)    as 비중_퍼센트,
  count(*) filter (where status = 'done')                         as 완료수,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*), 0), 1)                                 as 전환율_퍼센트
from metric_base group by "trigger" order by 2 desc;

comment on view metric_k7 is 'K7. S1 이 최초 세션의 40% 이상인지, S3 전환율이 평균 2배인지.';

-- K8 처리 방법 적중률
create or replace view metric_k8
with (security_invoker = true) as
select
  count(*) filter (where requested_at is not null or outcome = 'rejected') as 실행시도,
  count(*) filter (where outcome = 'rejected')                    as 반려_실패,
  round(100.0 * count(*) filter (where outcome = 'rejected')
        / nullif(count(*) filter (
            where requested_at is not null or outcome = 'rejected'), 0), 1) as 실패율_퍼센트,
  3                                                               as 목표_이하
from metric_base;

comment on view metric_k8 is
  'K8. 반려·실패는 AI 판단이 지자체 규정과 어긋난 사례입니다. 3% 초과면 프롬프트를 봐야 합니다.';

-- K9 재사용 성사율
create or replace view metric_k9
with (security_invoker = true) as
select
  count(*)                                                        as 재사용_보낸건,
  count(*) filter (where reuse_outcome in ('completed','returned')) as 응답건,
  count(*) filter (where reuse_outcome = 'completed')             as 성사,
  round(100.0 * count(*) filter (where reuse_outcome = 'completed')
        / nullif(count(*) filter (
            where reuse_outcome in ('completed','returned')), 0), 1) as 성사율_퍼센트,
  70                                                              as 목표
from metric_base
where route = 'reuse' and status = 'done'
  and coalesce(disposal, 'as_guided') <> 'waste_bag';

comment on view metric_k9 is
  'K9. ⚠ 파트너 회신 연동 전이므로 사용자 자기신고입니다. 응답건이 적으면 신뢰하지 마세요.';

-- K10 카테고리별 재사용 비율 분해
create or replace view metric_k10
with (security_invoker = true) as
select
  case category
    when 'furniture' then '가구'
    when 'appliance' then '가전'
    when 'textile'   then '의류·침구'
    when 'book_toy'  then '도서·완구'
    when 'houseware' then '생활잡화'
    when 'hazardous' then '유해물질'
    when 'other'     then '그 밖에'
    else '(미분류)'
  end                                                             as 카테고리,
  count(*)                                                        as 완료수,
  count(*) filter (where recirculated)                            as 다시쓰임,
  round(100.0 * count(*) filter (where recirculated)
        / nullif(count(*), 0), 1)                                 as 재사용률_퍼센트
from metric_base where status = 'done' group by category order by 2 desc;

comment on view metric_k10 is
  'K10. 전체 비율이 올랐는데 특정 카테고리만 올랐다면 물건 종류가 바뀐 것일 수 있습니다.';

-- K11 월간 총 처리 건수
create or replace view metric_k11
with (security_invoker = true) as
select
  to_char(date_trunc('month', disposed_at), 'YYYY-MM')            as 월,
  count(*)                                                        as 처리건수,
  count(distinct user_id)                                         as 사용자수,
  round(count(*)::numeric / nullif(count(distinct user_id), 0), 2) as 인당_건수
from metric_base
where status = 'done' and disposed_at is not null
group by 1 order by 1 desc;

comment on view metric_k11 is
  'K11 규모의 성장 + 카운터① 인당 월 처리 개수를 한 뷰에서 봅니다.';

-- ── 카운터 메트릭 ───────────────────────────────────────────────────────────

-- 카운터① 인당 월 처리 개수 (경보: 3개월 연속 상승)
create or replace view metric_counter_1
with (security_invoker = true) as
select
  월,
  인당_건수,
  인당_건수 - lag(인당_건수) over (order by 월)                    as 전월대비,
  case when 인당_건수 > lag(인당_건수) over (order by 월)
       then '상승' else '유지·하락' end                            as 추세
from metric_k11 order by 월 desc;

comment on view metric_counter_1 is
  '카운터①. 추세가 3개월 연속 상승이면 리바운드 신호 → 재사용 경로 노출 강화.';

-- 카운터② 유료 경로 유도율 (경보: 8% 초과)
create or replace view metric_counter_2
with (security_invoker = true) as
select
  count(*) filter (where free_alternative_available is not null)   as AI판단_건수,
  count(*) filter (where route = 'bulk' and free_alternative_available) as 무료가능한데_유료안내,
  round(100.0 * count(*) filter (where route = 'bulk' and free_alternative_available)
        / nullif(count(*) filter (where free_alternative_available is not null), 0), 1)
                                                                  as 유도율_퍼센트,
  8                                                               as 경보기준
from metric_base;

comment on view metric_counter_2 is
  '카운터②. 8% 초과면 무료 경로 우선 노출 로직 재점검 + AI 판별 표본 재감사.';

-- 카운터③ 신규 취득물 비중
create or replace view metric_counter_3
with (security_invoker = true) as
select
  to_char(date_trunc('month', added_at), 'YYYY-MM')               as 월,
  count(acquired_age)                                            as 응답건,
  count(*) filter (where acquired_age = 'within12m')             as 취득_1년이내,
  round(100.0 * count(*) filter (where acquired_age = 'within12m')
        / nullif(count(acquired_age), 0), 1)                      as 비중_퍼센트
from metric_base group by 1 order by 1 desc;

comment on view metric_counter_3 is
  '카운터③. 6개월 이동평균이 오르면 "사서 금방 버리는" 패턴 — 사용자 인터뷰로 원인 파악.';

-- 카운터④ 종량제 경로 선택률 (경보: 10% 초과)
create or replace view metric_counter_4
with (security_invoker = true) as
select
  count(*)                                                        as 처리완료,
  count(*) filter (where disposal = 'waste_bag')                  as 종량제로_감,
  round(100.0 * count(*) filter (where disposal = 'waste_bag')
        / nullif(count(*), 0), 1)                                 as 선택률_퍼센트,
  10                                                              as 경보기준
from metric_base where status = 'done';

comment on view metric_counter_4 is
  '카운터④. 10% 초과면 판별 UX 재설계. 결과 화면의 "종량제봉투에 버렸어요" 로 수집됩니다.';

-- ── 요약 · 실험군 비교 ──────────────────────────────────────────────────────

-- 한 화면에 전부
create or replace view metric_overview
with (security_invoker = true) as
select '대표 · 다시 쓰이게 된 비율' as 지표, 비율_퍼센트 as 값, '≥60' as 목표 from metric_north_star
union all select 'K1 판별 정확도',      정확도_퍼센트,   '≥95' from metric_k1
union all select 'K2 판별→실행 전환율',  전환율_퍼센트,   '≥45' from metric_k2
union all select 'K3 방치 일수(중앙값)', 중앙값_일,      '≤7'  from metric_k3
union all select 'K5 처리 소요(초)',     중앙값_초,      '≤60' from metric_k5
union all select 'K8 반려·실패율',       실패율_퍼센트,   '≤3'  from metric_k8
union all select 'K9 재사용 성사율',     성사율_퍼센트,   '≥70' from metric_k9
union all select '카운터② 유료 유도율',  유도율_퍼센트,   '≤8'  from metric_counter_2
union all select '카운터④ 종량제 선택률', 선택률_퍼센트,  '≤10' from metric_counter_4;

comment on view metric_overview is
  '한 눈에 보는 지표판. K4 는 GA4 보존율 보고서, K0·K6·K7·K10·K11 은 전용 뷰를 보세요.';

-- §6-4 성공 기준: 판별+대행(B) 의 K2 가 판별만(A) 보다 20%p 이상 높은가
create or replace view metric_by_group
with (security_invoker = true) as
select
  case experiment_group when 'A' then 'A · 판별만'
                        when 'B' then 'B · 판별+대행'
                        else '(미참가)' end                       as 그룹,
  count(distinct user_id)                                         as 사용자수,
  count(*)                                                        as 판별수,
  count(*) filter (where status = 'done')                         as 완료수,
  round(100.0 * count(*) filter (where status = 'done')
        / nullif(count(*), 0), 1)                                 as K2_퍼센트,
  round(percentile_cont(0.5) within group (order by days_to_dispose)::numeric, 1)
                                                                  as K3_중앙값_일,
  round(percentile_cont(0.5) within group (order by seconds_to_approve)::numeric, 0)
                                                                  as K5_중앙값_초
from metric_base group by experiment_group order by 1;

comment on view metric_by_group is
  '§6-4 성공 기준. B 의 K2_퍼센트 − A 의 K2_퍼센트 ≥ 20 이면 가설 지지.';

-- ── 전체 지표 한 판 ─────────────────────────────────────────────────────────
--
--     select * from metric_all;
--
-- 17개 지표를 한 표로 봅니다. 목표 대비 판정까지 붙습니다.
-- K6·K7·K10 은 여기서 요약 한 줄만 보여주고, 세부 분해는 전용 뷰를 보세요.
--
-- 판정 규칙
--   달성      목표를 넘었거나 기준 안에 있음
--   미달      목표에 못 미침
--   경보      카운터 메트릭이 경보 기준을 넘음
--   표본부족  분모가 0이라 계산할 수 없음
--   GA4       DB 로는 계산할 수 없어 GA4 에서 확인

create or replace view metric_all
with (security_invoker = true) as
with
  ns as (select * from metric_north_star),
  a0 as (select * from metric_k0),
  a1 as (select * from metric_k1),
  a2 as (select * from metric_k2),
  a3 as (select * from metric_k3),
  a5 as (select * from metric_k5),
  a8 as (select * from metric_k8),
  a9 as (select * from metric_k9),
  c2 as (select * from metric_counter_2),
  c4 as (select * from metric_counter_4),
  -- K6 — 타깃(자취 3년 이내) K2 가 비타깃 대비 몇 배인지
  k6 as (
    select
      max(case when segment = 'solo_new' then k2 end)                as 타깃,
      avg(case when segment in ('solo_veteran','family') then k2 end) as 비타깃
    from (
      select segment,
             100.0 * count(*) filter (where status = 'done')
               / nullif(count(*), 0) as k2
      from metric_base group by segment
    ) x
  ),
  -- K7 — S1(고장) 트리거가 전체 등록의 몇 %인지
  k7 as (
    select round(100.0 * count(*) filter (where "trigger" = 'broken')
                 / nullif(count(*) filter (where "trigger" is not null), 0), 1) as s1_비중,
           count(*) filter (where "trigger" is not null)                        as 응답수
    from metric_base
  ),
  -- K10 — 카테고리가 몇 종류 잡혔는지 (분해는 metric_k10)
  k10 as (select count(*) as 종류수 from metric_k10),
  -- K11 / 카운터① — 최근 한 달
  k11 as (
    select count(*) as 처리건수,
           round(count(*)::numeric / nullif(count(distinct user_id), 0), 2) as 인당
    from metric_base
    where status = 'done' and disposed_at >= now() - interval '30 days'
  ),
  c3 as (
    select round(100.0 * count(*) filter (where acquired_age = 'within12m')
                 / nullif(count(acquired_age), 0), 1) as 비중,
           count(acquired_age)                        as 응답수
    from metric_base
  )
select * from (
  select 1 as 순서, '대표'   as 구분, '다시 쓰이게 된 비율'      as 지표,
         ns.비율_퍼센트 as 값, '≥ 60%' as 목표,
         case when ns.비율_퍼센트 is null then '표본부족'
              when ns.비율_퍼센트 >= 60 then '달성' else '미달' end as 판정,
         ns.처리완료 || '건 완료' as 표본
    from ns
  union all
  select 2, '보조 K0', '가입 14일 내 등록 수', a0.가입14일내_평균등록수, '≥ 3개',
         case when a0.가입14일내_평균등록수 is null then '표본부족'
              when a0.가입14일내_평균등록수 >= 3 then '달성' else '미달' end,
         a0.사용자수 || '명' from a0
  union all
  select 3, '보조 K0', '방치 개월 중앙값', a0.방치개월_중앙값, '≥ 2개월',
         case when a0.방치개월_중앙값 is null then '표본부족'
              when a0.방치개월_중앙값 >= 2 then '달성' else '미달' end,
         a0.방치기간_응답수 || '건 응답' from a0
  union all
  select 4, '보조 K1', '판별 정확도', a1.정확도_퍼센트, '≥ 95%',
         case when a1.정확도_퍼센트 is null then '표본부족'
              when a1.정확도_퍼센트 >= 95 then '달성' else '미달' end,
         a1.응답수 || '/' || a1.판별수 || ' 응답' from a1
  union all
  select 5, '보조 K2', '판별 → 실행 전환율', a2.전환율_퍼센트, '≥ 45%',
         case when a2.전환율_퍼센트 is null then '표본부족'
              when a2.전환율_퍼센트 >= 45 then '달성' else '미달' end,
         a2.판별_등록 || '건 판별' from a2
  union all
  select 6, '보조 K3', '방치 일수 (중앙값)', a3.중앙값_일, '≤ 7일',
         case when a3.중앙값_일 is null then '표본부족'
              when a3.중앙값_일 <= 7 then '달성' else '미달' end,
         a3.완료건수 || '건 완료' from a3
  union all
  select 7, '보조 K4', '4주 재방문율', null::numeric, '≥ 40%', 'GA4',
         'GA4 → 보고서 → 보존율'
  union all
  select 8, '보조 K5', '처리 소요 시간 (초)', a5.중앙값_초, '≤ 60초',
         case when a5.중앙값_초 is null then '표본부족'
              when a5.중앙값_초 <= 60 then '달성' else '미달' end,
         a5.측정건수 || '건 측정' from a5
  union all
  select 9, '보조 K6', '타깃/비타깃 전환 배수',
         round((k6.타깃 / nullif(k6.비타깃, 0))::numeric, 2), '≥ 1.3배',
         case when k6.타깃 is null or k6.비타깃 is null then '표본부족'
              when k6.타깃 / nullif(k6.비타깃, 0) >= 1.3 then '달성' else '미달' end,
         '분해는 metric_k6' from k6
  union all
  select 10, '보조 K7', 'S1(고장) 트리거 비중', k7.s1_비중, '≥ 40%',
         case when k7.s1_비중 is null then '표본부족'
              when k7.s1_비중 >= 40 then '달성' else '미달' end,
         k7.응답수 || '건 응답' from k7
  union all
  select 11, '보조 K8', '반려·실패율', a8.실패율_퍼센트, '≤ 3%',
         case when a8.실패율_퍼센트 is null then '표본부족'
              when a8.실패율_퍼센트 <= 3 then '달성' else '미달' end,
         a8.실행시도 || '건 시도' from a8
  union all
  select 12, '보조 K9', '재사용 성사율', a9.성사율_퍼센트, '≥ 70%',
         case when a9.성사율_퍼센트 is null then '표본부족'
              when a9.성사율_퍼센트 >= 70 then '달성' else '미달' end,
         a9.응답건 || '/' || a9.재사용_보낸건 || ' 응답 (자기신고)' from a9
  union all
  select 13, '보조 K10', '카테고리 분해 종류', k10.종류수::numeric, '분해 확인',
         case when k10.종류수 = 0 then '표본부족' else '수집중' end,
         '분해는 metric_k10' from k10
  union all
  select 14, '보조 K11', '월간 총 처리 건수', k11.처리건수::numeric, '지속 증가',
         case when k11.처리건수 = 0 then '표본부족' else '수집중' end,
         '최근 30일' from k11
  union all
  select 15, '카운터①', '인당 월 처리 개수', k11.인당, '급증 감시',
         case when k11.인당 is null then '표본부족' else '감시중' end,
         '추세는 metric_counter_1' from k11
  union all
  select 16, '카운터②', '유료 경로 유도율', c2.유도율_퍼센트, '≤ 8%',
         case when c2.유도율_퍼센트 is null then '표본부족'
              when c2.유도율_퍼센트 > 8 then '경보' else '달성' end,
         c2.AI판단_건수 || '건 판단' from c2
  union all
  select 17, '카운터③', '신규 취득물 비중', c3.비중, '급증 감시',
         case when c3.비중 is null then '표본부족' else '감시중' end,
         c3.응답수 || '건 응답' from c3
  union all
  select 18, '카운터④', '종량제 경로 선택률', c4.선택률_퍼센트, '≤ 10%',
         case when c4.선택률_퍼센트 is null then '표본부족'
              when c4.선택률_퍼센트 > 10 then '경보' else '달성' end,
         c4.처리완료 || '건 완료' from c4
) t order by 순서;

comment on view metric_all is
  '17개 지표를 한 표로. select * from metric_all; 한 줄이면 전체 상태가 보입니다.';
