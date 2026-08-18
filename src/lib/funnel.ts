import type { Category, Item } from '../types'
import { IDLE_BEFORE_MONTHS, originOf } from '../types'

/**
 * 제안서 §6-1 ~ §6-3 의 지표를 이 기기의 기록만으로 계산합니다.
 *
 * GA 는 여러 사용자를 합산하지만 집계까지 하루 이상 걸립니다.
 * 4주 실험 중에 "지금 이 기기에서 무슨 일이 있었나"를 바로 확인하려면
 * 로컬 계산이 하나 있어야 합니다. 두 값이 어긋나면 계측이 샌 것입니다.
 *
 * ★ 분모 규칙: **판별을 거친 물건만** 셉니다.
 *   직접 추가(manual)와 시연용 예시(demo)를 섞으면 지표가 부풀거나 꺼집니다.
 */

const DAY = 86_400_000

export type Funnel = {
  /** 판별을 거쳐 등록된 물건 — K2 의 분모 */
  classified: number
  /** 그중 신청·예약까지 간 수 */
  requested: number
  /** 그중 처리 완료된 수 */
  disposed: number
  /** K2 — 판별 → 실행 전환율 (%). 분모가 0이면 null */
  k2: number | null
  /** 신청까지 간 비율 (%) — 등록·신청·완료 중 어디서 막히는지 보려고 함께 둡니다 */
  requestRate: number | null
  /** K3 — 등록 → 완료 중앙값 (일). 완료 건이 없으면 null */
  medianDaysToDispose: number | null
  /** K5 — 촬영 → 승인 완료 중앙값 (초). 목표 ≤ 60. 측정 가능한 건이 없으면 null */
  medianSecondsToApprove: number | null
  /** K8 — 신고 반려·예약 실패율 (%). 목표 ≤ 3 */
  rejectRate: number | null
  /** K11 — 월간 총 처리 건수 (최근 30일). 대표 지표가 못 담는 규모의 성장 */
  monthlyDisposed: number
  /** 참고용. 분모에는 넣지 않습니다. */
  manual: number
}

export type AccuracyStat = {
  /** 물어본 대상 = 판별을 거친 물건 수 */
  asked: number
  /** 실제로 답해준 수 */
  answered: number
  correct: number
  /** K1 — 정답률 (%). 응답이 없으면 null */
  k1: number | null
  /** 응답률 (%) — 표본을 믿어도 되는지 판단하는 값 */
  responseRate: number | null
}

export type CounterMetrics = {
  /** 카운터① 인당 월 처리 개수 — 최근 30일 완료 건수 */
  disposedLast30Days: number
  /** 카운터② 분모: 안내를 받고 실제로 내보낸 물건 */
  guidedAndDone: number
  /** 카운터② 분자: 그중 종량제봉투로 간 물건 */
  wasteBag: number
  /** 카운터② 종량제 경로 선택률 (%). 경보 기준 10% 초과 */
  wasteBagRate: number | null
}

export type NorthStar = {
  /** 처리 완료된 판별 물건 */
  total: number
  /** 그중 재사용·재활용으로 실제 간 수 (대형폐기물·종량제 제외) */
  recirculated: number
  /** 다시 쓰이게 된 비율 (%). 목표 6개월 60% */
  rate: number | null
}

/** 판별을 거친 물건만 (모든 지표의 공통 모집단) */
export function classifiedItems(items: Item[]): Item[] {
  return items.filter((i) => originOf(i) === 'ai')
}

function pct(part: number, whole: number): number | null {
  if (whole === 0) return null
  return Math.round((part / whole) * 100)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 === 1 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

export function funnel(items: Item[]): Funnel {
  const ai = classifiedItems(items)

  // 수거함처럼 예약 단계가 없는 경로는 pending → done 으로 바로 갑니다.
  // 그래도 "실행에 착수했다"는 사실은 같으므로 신청 단계에 포함합니다.
  const requested = ai.filter(
    (i) => i.requestedAt != null || i.status !== 'pending',
  ).length
  const done = ai.filter((i) => i.status === 'done')

  const durations = done
    .filter((i) => i.disposedAt != null)
    .map((i) => Math.max(0, Math.floor((i.disposedAt! - i.addedAt) / DAY)))

  // K5 — 촬영 시각과 승인 시각이 **둘 다** 있는 건만 셉니다.
  // 없는 건을 0으로 채우면 60초 목표가 무조건 달성된 것처럼 보입니다.
  const approveSeconds = ai
    .filter((i) => i.capturedAt != null && i.requestedAt != null)
    .map((i) => Math.max(0, Math.round((i.requestedAt! - i.capturedAt!) / 1000)))

  // K8 — 안내한 방법이 통하지 않은 건. 분모는 실행을 시도한 물건입니다.
  const attempted = ai.filter(
    (i) => i.requestedAt != null || i.outcome === 'rejected',
  ).length
  const rejected = ai.filter((i) => i.outcome === 'rejected').length

  return {
    classified: ai.length,
    requested,
    disposed: done.length,
    rejectRate: pct(rejected, attempted),
    monthlyDisposed: done.filter(
      (i) => i.disposedAt != null && Date.now() - i.disposedAt <= 30 * DAY,
    ).length,
    k2: pct(done.length, ai.length),
    requestRate: pct(requested, ai.length),
    medianDaysToDispose: median(durations),
    medianSecondsToApprove: median(approveSeconds),
    manual: items.filter((i) => originOf(i) === 'manual').length,
  }
}

export function accuracyStat(items: Item[]): AccuracyStat {
  const ai = classifiedItems(items)
  const answered = ai.filter((i) => i.accuracy != null)
  const correct = answered.filter((i) => i.accuracy === 'correct').length

  return {
    asked: ai.length,
    answered: answered.length,
    correct,
    k1: pct(correct, answered.length),
    responseRate: pct(answered.length, ai.length),
  }
}

/**
 * 북극성 지표 — 다시 쓰이게 된 비율.
 *
 * 종량제로 간 물건은 route 가 'reuse' 여도 재사용으로 세지 않습니다.
 * 안내한 경로가 아니라 **실제로 간 곳**이 기준이기 때문입니다.
 */
export function northStar(items: Item[]): NorthStar {
  const done = classifiedItems(items).filter((i) => i.status === 'done')
  const recirculated = done.filter(
    (i) => i.route !== 'bulk' && i.disposal !== 'waste_bag',
  ).length

  return {
    total: done.length,
    recirculated,
    rate: pct(recirculated, done.length),
  }
}

export function counterMetrics(items: Item[], now = Date.now()): CounterMetrics {
  const done = classifiedItems(items).filter((i) => i.status === 'done')
  const wasteBag = done.filter((i) => i.disposal === 'waste_bag').length

  return {
    disposedLast30Days: done.filter(
      (i) => i.disposedAt != null && now - i.disposedAt <= 30 * DAY,
    ).length,
    guidedAndDone: done.length,
    wasteBag,
    wasteBagRate: pct(wasteBag, done.length),
  }
}


/* ── K0 · K7 · K9 · K10 · 카운터②③ ────────────────────────────── */

export type ProblemStat = {
  /** 가입 14일 안에 등록한 개수 — 목표 ≥3개 */
  addedWithin14d: number
  /** 방치 개월 중앙값 — 목표 ≥2개월. 답해준 건만 셉니다 */
  medianIdleMonths: number | null
  /** 방치 기간을 답해준 건수 (표본을 믿어도 되는지 판단용) */
  answered: number
}

/**
 * K0 — "몰라서 못 버림" 문제가 실재하는지.
 *
 * 두 값이 필요합니다: 가입 직후 얼마나 쏟아지는지(적체의 존재)와
 * 그 물건들을 얼마나 오래 두고 있었는지(방치의 길이).
 * 뒤쪽은 사용자가 답해줘야만 알 수 있어 응답 건수를 함께 돌려줍니다.
 */
export function problemStat(
  items: Item[],
  joinedAt: number | undefined,
): ProblemStat {
  const ai = classifiedItems(items)
  const answered = ai.filter((i) => i.idleBefore != null)

  return {
    addedWithin14d:
      joinedAt == null
        ? 0
        : ai.filter((i) => i.addedAt - joinedAt <= 14 * DAY).length,
    medianIdleMonths: median(
      answered.map((i) => IDLE_BEFORE_MONTHS[i.idleBefore as keyof typeof IDLE_BEFORE_MONTHS]),
    ),
    answered: answered.length,
  }
}

export type TriggerStat = { trigger: string; added: number; disposed: number }

/**
 * K7 — 트리거별 유입·전환.
 * "S1(고장)으로 진입해 S3(이사)에서 수익화" 라는 설계가 맞는지 봅니다.
 */
export function triggerStats(items: Item[]): TriggerStat[] {
  const ai = classifiedItems(items).filter((i) => i.trigger != null)
  const keys = [...new Set(ai.map((i) => i.trigger as string))]
  return keys
    .map((trigger) => {
      const rows = ai.filter((i) => i.trigger === trigger)
      return {
        trigger,
        added: rows.length,
        disposed: rows.filter((i) => i.status === 'done').length,
      }
    })
    .sort((a, b) => b.added - a.added)
}

export type ReuseStat = {
  /** 재사용 경로로 보내 완료한 물건 */
  sent: number
  /** 그중 성사 여부를 답해준 건 */
  answered: number
  completed: number
  /** K9 — 재사용 성사율 (%). 목표 ≥ 70 */
  rate: number | null
}

/**
 * K9 — 재사용 성사율.
 *
 * ⚠ 파트너(중고매장·기부처) 회신이 있어야 확정되는 값입니다.
 *   연동 전에는 사용자 자기신고라, 분모를 "답해준 건" 으로 두고
 *   응답 건수를 함께 노출해 과대평가를 막습니다.
 */
export function reuseStat(items: Item[]): ReuseStat {
  const sent = classifiedItems(items).filter(
    (i) =>
      i.route === 'reuse' && i.status === 'done' && i.disposal !== 'waste_bag',
  )
  const answered = sent.filter(
    (i) => i.reuseOutcome === 'completed' || i.reuseOutcome === 'returned',
  )
  const completed = answered.filter((i) => i.reuseOutcome === 'completed').length

  return {
    sent: sent.length,
    answered: answered.length,
    completed,
    rate: pct(completed, answered.length),
  }
}

export type CategoryStat = {
  category: Category
  done: number
  recirculated: number
  rate: number | null
}

/**
 * K10 — 카테고리별 재사용 비율 분해.
 * "물건 종류만 바뀌어서 대표 지표가 오른 건 아닌지" 를 확인합니다.
 */
export function categoryStats(items: Item[]): CategoryStat[] {
  const done = classifiedItems(items).filter(
    (i) => i.status === 'done' && i.category != null,
  )
  const keys = [...new Set(done.map((i) => i.category as Category))]
  return keys
    .map((category) => {
      const rows = done.filter((i) => i.category === category)
      const recirculated = rows.filter(
        (i) => i.route !== 'bulk' && i.disposal !== 'waste_bag',
      ).length
      return {
        category,
        done: rows.length,
        recirculated,
        rate: pct(recirculated, rows.length),
      }
    })
    .sort((a, b) => b.done - a.done)
}

export type PaidPathStat = {
  /** 분모: 무료 대안 여부를 AI 가 판단해준 물건 */
  judged: number
  /** 분자: 무료 길이 있었는데도 대형폐기물로 안내한 건 */
  paidDespiteFree: number
  /** 카운터② 유료 경로 유도율 (%). 경보 기준 8% 초과 */
  rate: number | null
}

/**
 * 카운터② 유료 경로 유도율.
 *
 * 비움의 수익이 유료 경로에서만 나오는 구조적 이해충돌을 직접 감시합니다.
 * 리바운드보다 실제로 일어날 확률이 훨씬 높은 위험입니다.
 */
export function paidPathStat(items: Item[]): PaidPathStat {
  const judged = classifiedItems(items).filter(
    (i) => i.freeAlternativeAvailable != null,
  )
  const paidDespiteFree = judged.filter(
    (i) => i.route === 'bulk' && i.freeAlternativeAvailable === true,
  ).length

  return {
    judged: judged.length,
    paidDespiteFree,
    rate: pct(paidDespiteFree, judged.length),
  }
}

export type NewGoodsStat = {
  /** 취득 시점을 답해준 건 */
  answered: number
  /** 그중 12개월 이내 취득 */
  within12m: number
  /** 카운터③ 신규 취득물 비중 (%) */
  rate: number | null
}

/**
 * 카운터③ 신규 취득물 비중.
 * 적체 재고 처리와 "사서 금방 버리는" 패턴을 구분합니다 —
 * 진짜 리바운드가 있다면 여기서 먼저 보입니다.
 */
export function newGoodsStat(items: Item[]): NewGoodsStat {
  const answered = classifiedItems(items).filter((i) => i.acquiredAge != null)
  const within12m = answered.filter((i) => i.acquiredAge === 'within12m').length

  return {
    answered: answered.length,
    within12m,
    rate: pct(within12m, answered.length),
  }
}
