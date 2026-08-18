import type { RouteId } from './data/routeKinds'

export type ItemStatus =
  /** 아직 집에 있음 */
  | 'pending'
  /** 신청·예약 완료, 배출 대기 */
  | 'requested'
  /** 처리 완료 — 리포트에 집계됨 */
  | 'done'

/**
 * 이 물건이 목록에 들어온 경로.
 *
 * K2(판별 → 실행 전환율)의 **분모를 가르는 값**입니다.
 * "판별한 물건 중 실제 처리까지 간 비율"이므로 직접 추가(manual)와
 * 시연용 예시(demo)는 분모에서 빠져야 합니다.
 */
export type ItemOrigin = 'ai' | 'manual' | 'demo'

/** K1 — 사용자가 알려준 판별 정답 여부. 답하지 않아도 됩니다. */
export type Accuracy = 'correct' | 'wrong'

/** 틀렸다면 무엇이 틀렸는지 (선택 입력) */
export type AccuracyNote = 'item' | 'route' | 'fee' | 'other'

/**
 * K10 — 카테고리별 재사용 비율 분해.
 * "물건 종류만 바뀌어서 대표 지표가 오른 건 아닌지" 를 보기 위한 값입니다.
 * AI 판별이 채우고, 직접 추가한 물건은 비어 있습니다.
 */
export type Category =
  | 'furniture'
  | 'appliance'
  | 'textile'
  | 'book_toy'
  | 'houseware'
  | 'hazardous'
  | 'other'

export const CATEGORY_LABEL: Record<Category, string> = {
  furniture: '가구',
  appliance: '가전',
  textile: '의류·침구',
  book_toy: '도서·완구',
  houseware: '생활잡화',
  hazardous: '유해물질',
  other: '그 밖에',
}

/**
 * K7 — 이 물건을 지금 버리게 된 계기 (제안서 §3-1 의 S1~S4).
 * 선택 입력입니다. 묻는 걸 늘리면 K5(60초)와 K2(전환율)가 나빠지므로
 * 건너뛸 수 있게 두고, 비어 있는 것도 데이터로 셉니다.
 */
export type Trigger =
  /** S1 고장 */
  | 'broken'
  /** S2 대청소·계절 정리 */
  | 'cleanup'
  /** S3 이사·입주 */
  | 'moving'
  /** S4 육아용품 졸업 */
  | 'outgrown'
  | 'other'

export const TRIGGER_LABEL: Record<Trigger, string> = {
  broken: '고장났어요',
  cleanup: '정리하다 나왔어요',
  moving: '이사·입주 때문에',
  outgrown: '아이가 다 썼어요',
  other: '그 밖에',
}

/**
 * K0 — 이 물건을 얼마나 오래 두고 있었는지 (등록 시점 기준, 선택 입력).
 *
 * addedAt 은 "앱에 등록한 날"이라 방치 기간을 알 수 없습니다.
 * 제안서 §1-2 의 "방치 4개월"·§4-1 의 "128일" 이 실재하는지 재려면
 * **사용자에게 물어야만** 알 수 있는 값입니다.
 */
export type IdleBefore = 'lt1m' | 'm1to3' | 'm3to6' | 'm6to12' | 'gt12m'

export const IDLE_BEFORE_LABEL: Record<IdleBefore, string> = {
  lt1m: '한 달 안',
  m1to3: '1~3개월',
  m3to6: '3~6개월',
  m6to12: '6개월~1년',
  gt12m: '1년 넘게',
}

/** 방치 기간의 대표값(개월) — K0 의 "방치 개월 중앙값" 계산용 */
export const IDLE_BEFORE_MONTHS: Record<IdleBefore, number> = {
  lt1m: 0.5,
  m1to3: 2,
  m3to6: 4.5,
  m6to12: 9,
  gt12m: 18,
}

/**
 * 카운터③ 신규 취득물 비중 — 취득 12개월 이내인지 (선택 입력).
 * 적체 재고 처리와 "사서 금방 버리는" 패턴을 구분합니다.
 */
export type AcquiredAge = 'within12m' | 'over12m'

/**
 * K8 — 안내한 방법이 실제로 통했는지.
 * 신고가 반려되거나 예약이 안 됐다면 AI 판단이 지자체 규정과 어긋난 것입니다.
 */
export type Outcome = 'accepted' | 'rejected'

/**
 * K9 — 재사용 경로로 보낸 물건이 실제로 다음 사용자에게 갔는지.
 *
 * ⚠ 원래는 파트너(중고매장·기부처)가 회신해야 확정되는 값입니다.
 *   연동이 없는 프로토타입에서는 사용자에게 다시 물어 근사합니다.
 */
export type ReuseOutcome = 'completed' | 'returned' | 'unknown'

/**
 * 실제로 어떻게 내보냈는지. **판별 경로(route)와 다를 수 있습니다.**
 *
 * 카운터 메트릭 "종량제 경로 선택률"(제안서 §6-3)을 재려면
 * "우리가 안내한 경로"와 "사용자가 실제로 한 행동"을 따로 들고 있어야 합니다.
 * route 를 덮어쓰면 분모(안내받은 물건)가 사라져 비율을 계산할 수 없습니다.
 */
export type Disposal =
  /** 안내한 경로대로 내보냄 */
  | 'as_guided'
  /** 안내를 보고도 종량제봉투로 보냄 — 안티 경로 */
  | 'waste_bag'

export type Item = {
  id: string
  /** 사용자에게 보이는 품목명 */
  name: string
  route: RouteId
  /** 이 물건에 실제로 드는 비용(원). 무상 경로는 0. */
  fee: number
  /** 서대문구 요금표의 규격 문구 (근거 표시용) */
  feeSpec?: string
  /** 요금표에서 매칭된 항목명 — 근거 문장에 인용 */
  feeMatchedName?: string

  /** 화면 표시용 320px 썸네일 (dataURL). 로컬에 보관합니다. */
  photo?: string
  /** Supabase Storage 안의 원본 경로. 미연동 시 비어 있습니다. */
  photoPath?: string
  /** AI 판별 확신도 0~1 */
  confidence?: number
  /** 왜 이 경로인지에 대한 한 문단 */
  basis?: string
  /** K10 — AI 가 판단한 큰 분류 */
  category?: Category
  /** 카운터② — 수수료 없이 내보낼 길이 있었는지 (AI 판단) */
  freeAlternativeAvailable?: boolean

  /**
   * 사진을 고른 시각 — **K5(처리 소요 시간)의 출발점**입니다.
   * 제안서는 K5 를 "사진 촬영 → 승인 완료 ≤ 60초"로 정의했으므로
   * 등록 시각(addedAt)이 아니라 촬영 시각부터 재야 합니다.
   * 직접 추가한 물건에는 없습니다.
   */
  capturedAt?: number
  /** 목록에 등록된 시각 (epoch ms) — 방치일수의 기준 */
  addedAt: number
  status: ItemStatus
  /** 신청·예약이 접수된 시각 — K2 퍼널의 중간 단계 */
  requestedAt?: number
  /** 처리 완료 시각 */
  disposedAt?: number
  /** 실제로 어떻게 내보냈는지. 완료 시에만 채워집니다. */
  disposal?: Disposal
  /** K7 — 지금 버리게 된 계기 (선택) */
  trigger?: Trigger
  /** K0 — 등록 전까지 얼마나 두고 있었는지 (선택) */
  idleBefore?: IdleBefore
  /** 카운터③ — 취득 12개월 이내인지 (선택) */
  acquiredAge?: AcquiredAge
  /** K8 — 안내한 방법이 통했는지. 반려·실패를 사용자가 알려줄 때만 채워집니다. */
  outcome?: Outcome
  /** K9 — 재사용 경로가 실제로 성사됐는지 */
  reuseOutcome?: ReuseOutcome
  /** 어디로 갔는지 (리포트의 "행선지" 추적) */
  destination?: string

  /* ── 측정용 (K1 · K2) ─────────────────────────────────────────
     사용자에게 보이는 값이 아니라 지표를 계산하기 위한 기록입니다. */

  /** 등록 경로. 예전 버전 데이터에는 없어 optional 입니다 — originOf() 를 쓰세요. */
  origin?: ItemOrigin
  /** 판별이 맞았는지에 대한 사용자 답 (K1) */
  accuracy?: Accuracy
  /** 무엇이 틀렸는지 (선택) */
  accuracyNote?: AccuracyNote
  /** 답하지 않고 닫음 — 같은 물건에 두 번 묻지 않기 위한 표시 */
  accuracyDismissed?: boolean
  /** 맥락 질문(K0·K7·카운터③)을 답 없이 닫음 */
  contextDismissed?: boolean
}

/**
 * 등록 경로. 값이 없는 예전 데이터는 흔적으로 추정합니다.
 * (확신도가 있으면 AI 판별을 거친 물건입니다)
 */
export function originOf(item: Item): ItemOrigin {
  if (item.origin) return item.origin
  if (item.id.startsWith('seed-') || item.id.startsWith('done-')) return 'demo'
  return item.confidence != null ? 'ai' : 'manual'
}

/** 종량제봉투로 갔다면 소각됐을 물건인지 — 리포트의 반사실 비교에 사용 */
export const COUNTERFACTUAL_ROUTES: RouteId[] = ['reuse', 'free', 'drop']

const DAY = 86_400_000

/** 방치일수 (등록일 → 오늘). 처리 완료된 물건은 처리일까지로 고정. */
export function daysIdle(item: Item, now = Date.now()): number {
  const end = item.status === 'done' && item.disposedAt ? item.disposedAt : now
  return Math.max(0, Math.floor((end - item.addedAt) / DAY))
}
