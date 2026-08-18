/**
 * Google Analytics 4.
 *
 * 설계 원칙 두 가지:
 * 1. 측정 ID(VITE_GA_MEASUREMENT_ID)가 없으면 아무 일도 하지 않습니다.
 *    개발 중과 ID 미설정 상태에서 완전히 비활성입니다.
 * 2. 사용자가 동의하기 전에는 **gtag 스크립트 자체를 내려받지 않습니다.**
 *    동의 모드로 "거부 상태 로드"를 하는 대신 아예 로드하지 않는 쪽을 택했습니다.
 *    이 앱은 사용자 집에 어떤 물건이 있는지를 다루기 때문입니다.
 *
 * 측정 ID 는 비밀이 아닙니다 (브라우저에 그대로 노출되는 공개 값).
 * 그래서 서버 프록시 없이 VITE_ 접두사로 클라이언트에 주입합니다 — API 키와 다릅니다.
 */

import type { Accuracy, AccuracyNote, Disposal, ItemOrigin } from '../types'

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as
  | string
  | undefined

const CONSENT_KEY = 'bium.analytics-consent'

export type ConsentState = 'granted' | 'denied' | 'unset'

/** 측정 ID 가 설정돼 있는지 — 없으면 동의 배너도 띄우지 않습니다 */
export const analyticsAvailable = Boolean(MEASUREMENT_ID)

export function getConsent(): ConsentState {
  if (!analyticsAvailable) return 'denied'
  const v = localStorage.getItem(CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : 'unset'
}

let loaded = false

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function loadGtag() {
  if (loaded || !MEASUREMENT_ID) return
  loaded = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag 는 arguments 객체를 그대로 밀어 넣어야 동작합니다
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }

  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, {
    // 해시 라우팅이라 자동 페이지뷰를 끄고 직접 보냅니다
    send_page_view: false,
    // IP 익명화 (GA4 는 기본이지만 명시)
    anonymize_ip: true,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
}

export function setConsent(state: 'granted' | 'denied') {
  localStorage.setItem(CONSENT_KEY, state)
  if (state === 'granted') loadGtag()
}

/** 앱 시작 시 호출 — 이미 동의한 사용자면 바로 로드 */
export function initAnalytics() {
  if (getConsent() === 'granted') loadGtag()
}

/* ── 이벤트 ────────────────────────────────────────────────── */

export function pageview(path: string) {
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: document.title,
  })
}

type EventParams = Record<string, string | number | boolean>

/**
 * 4주 실험 참가군 ('A' 판별만 / 'B' 판별+대행).
 *
 * 제안서 §6-4 의 성공 기준은 **두 그룹의 K2 차이 20%p** 입니다.
 * 그래서 모든 이벤트에 이 값이 붙어야 지표를 그룹별로 쪼갤 수 있습니다.
 * 비어 있으면 파라미터를 아예 보내지 않습니다 (실험 미참가자).
 */
let experimentGroup = ''

/**
 * K6 — 고객 세그먼트. 그룹과 같은 이유로 모든 이벤트에 붙습니다.
 * "타깃(자취 3년 이내)의 K2 가 비타깃 대비 1.3배" 를 재려면
 * 모든 퍼널 이벤트를 세그먼트로 쪼갤 수 있어야 합니다.
 */
let segment = ''

export function setSegment(value: string) {
  segment = value
  if (segment) {
    window.gtag?.('set', 'user_properties', { segment })
  }
}

export function setExperimentGroup(group: string) {
  experimentGroup = group.trim().toUpperCase()
  // 사용자 속성으로도 심어두면 GA4 잠재고객·비교 세그먼트에서 바로 쓸 수 있습니다
  if (experimentGroup) {
    window.gtag?.('set', 'user_properties', {
      experiment_group: experimentGroup,
    })
  }
}

function track(name: string, params: EventParams = {}) {
  window.gtag?.('event', name, {
    ...params,
    ...(experimentGroup ? { group: experimentGroup } : {}),
    ...(segment ? { segment } : {}),
  })
}

/**
 * 앱 고유 이벤트.
 * 품목명·사진 같은 식별 가능한 내용은 절대 보내지 않고,
 * 경로·확신도 구간 같은 집계용 값만 보냅니다.
 */
export const analytics = {
  /** 사진을 골라 판별을 시작함 */
  classifyStart: (source: 'camera' | 'album') => track('classify_start', { source }),

  /** 판별 완료 — 품목명은 보내지 않습니다 */
  classifyDone: (p: {
    route: string
    confidenceBucket: string
    uncertain: boolean
    aiSource: 'ai' | 'mock'
    elapsedMs: number
    /** K10 — 카테고리별 분해용 */
    category?: string
    /** 카운터② — 무료 경로가 가능했는데 유료로 안내했는지 */
    freeAlternative?: boolean
  }) =>
    track('classify_done', {
      route: p.route,
      confidence_bucket: p.confidenceBucket,
      uncertain: p.uncertain,
      ai_source: p.aiSource,
      elapsed_ms: Math.round(p.elapsedMs),
      ...(p.category ? { category: p.category } : {}),
      ...(p.freeAlternative == null
        ? {}
        : { free_alternative: p.freeAlternative }),
      // 카운터② 의 분자 — 무료로 될 일을 유료로 안내한 건
      ...(p.route === 'bulk' && p.freeAlternative
        ? { paid_despite_free: true }
        : {}),
    }),

  /** 판별 실패 */
  classifyError: (reason: string) => track('classify_error', { reason }),

  /**
   * 목록에 추가 — K2 퍼널 1단계.
   * origin 이 있어야 "판별한 물건"과 "직접 추가한 물건"을 나눠 셀 수 있습니다.
   */
  itemAdded: (p: {
    route: string
    uncertain: boolean
    origin: ItemOrigin
    /** 촬영부터 등록까지 (초). 직접 추가는 없음 */
    secondsFromCapture?: number
    category?: string
  }) =>
    track('item_added', {
      route: p.route,
      uncertain: p.uncertain,
      origin: p.origin,
      ...secs(p.secondsFromCapture),
      ...(p.category ? { category: p.category } : {}),
    }),

  /** 신청 대행 승인 (실제 결제는 아님 — 프로토타입) */
  requestApproved: (route: string, feeWon: number) =>
    track('request_approved', { route, fee_won: feeWon }),

  /**
   * K2 퍼널 2단계 — 신청·예약 접수됨.
   * seconds_from_capture 가 **K5(촬영 → 승인 완료)** 입니다. 목표 ≤ 60초.
   */
  itemRequested: (p: {
    route: string
    origin: ItemOrigin
    daysSinceAdd: number
    secondsFromCapture?: number
  }) =>
    track('item_requested', {
      route: p.route,
      origin: p.origin,
      days_since_add: p.daysSinceAdd,
      ...secs(p.secondsFromCapture),
    }),

  /**
   * K2 퍼널 3단계 — 처리 완료.
   * days_since_add 가 K3(방치 일수), disposal 이 **카운터 메트릭
   * "종량제 경로 선택률"** 의 분자입니다.
   */
  itemDisposed: (p: {
    route: string
    origin: ItemOrigin
    daysSinceAdd: number
    disposal: Disposal
    secondsFromCapture?: number
    /** K10 — 카테고리별 재사용 비율을 여기서 쪼갭니다 */
    category?: string
  }) =>
    track('item_disposed', {
      route: p.route,
      origin: p.origin,
      days_since_add: p.daysSinceAdd,
      disposal: p.disposal,
      ...secs(p.secondsFromCapture),
      ...(p.category ? { category: p.category } : {}),
    }),

  /**
   * 안내를 보고도 종량제봉투를 골랐음 — 카운터 메트릭 전용 이벤트.
   * item_disposed 의 disposal 로도 계산되지만, 경보 기준(10%)을 보는 지표라
   * 따로 세어 GA4 에서 바로 찾을 수 있게 둡니다.
   */
  wasteBagChosen: (route: string, daysSinceAdd: number) =>
    track('waste_bag_chosen', { route, days_since_add: daysSinceAdd }),

  /* ── K0 · K7 · 카운터③ 맥락 ─────────────────────────────────── */

  /** 맥락 질문에 한 줄 답함 (세 줄이 독립이라 줄마다 보냅니다) */
  itemContext: (p: {
    field: 'idle_before' | 'trigger' | 'acquired_age'
    value: string
    route: string
  }) => track('item_context', { field: p.field, value: p.value, route: p.route }),

  /** 맥락 질문을 답 없이 닫음 — 응답률의 분모용 */
  itemContextSkipped: (route: string) => track('item_context_skipped', { route }),

  /* ── K8 · K9 사후 결과 ───────────────────────────────────────── */

  /**
   * K8 — 안내한 방법이 통하지 않았음 (신고 반려·예약 실패).
   * AI 판단이 지자체 규정과 어긋난 사례라 표본을 따로 모아야 합니다.
   */
  outcomeRejected: (route: string, reason: string) =>
    track('outcome_rejected', { route, reason }),

  /** K9 — 재사용 경로가 실제로 성사됐는지 (파트너 연동 전 자기신고) */
  reuseOutcome: (outcome: string, route: string) =>
    track('reuse_outcome', { outcome, route }),

  /** 확신도 미달로 구청 문의 안내가 뜸 */
  lowConfidenceBlocked: (confidenceBucket: string) =>
    track('low_confidence_blocked', { confidence_bucket: confidenceBucket }),

  /* ── K1 판별 정확도 ─────────────────────────────────────────────
     사용자가 답해줄 때만 발생합니다. 답하지 않는 것도 데이터라서
     건너뜀(skipped)도 함께 셉니다 — 응답률을 알아야 표본을 신뢰할 수 있습니다. */

  /** "맞았나요?"에 답함 */
  classifyFeedback: (p: {
    verdict: Accuracy
    route: string
    confidenceBucket: string
  }) =>
    track('classify_feedback', {
      verdict: p.verdict,
      route: p.route,
      confidence_bucket: p.confidenceBucket,
    }),

  /** 무엇이 틀렸는지까지 알려줌 (선택 입력이라 따로 셉니다) */
  classifyFeedbackNote: (note: AccuracyNote, route: string) =>
    track('classify_feedback_note', { note, route }),

  /** 답하지 않고 닫음 */
  classifyFeedbackSkipped: (route: string) =>
    track('classify_feedback_skipped', { route }),

  /**
   * 통계 수집에 동의함.
   *
   * ⚠ **거부는 보낼 수 없습니다.** 거부하면 gtag 스크립트를 애초에
   *   내려받지 않기 때문입니다(설계상 의도). 그래서 GA 로는 동의율의
   *   분자만 알 수 있고, 분모(배포한 인원)는 실험 운영자가 세어야 합니다.
   *   설정 화면에 이 기기의 동의 상태를 노출해 둔 이유입니다.
   */
  consentGranted: () => track('consent_granted'),
}

/** 초 단위 파라미터는 값이 있을 때만 붙입니다 (없는 값을 0으로 보내면 평균이 망가집니다) */
function secs(v: number | undefined): EventParams {
  return v == null ? {} : { seconds_from_capture: Math.round(v) }
}

/** 확신도를 구간으로 뭉갭니다 (원값을 그대로 보내지 않기 위해) */
export function confidenceBucket(c: number): string {
  if (c >= 0.95) return '95-100'
  if (c >= 0.85) return '85-94'
  if (c >= 0.7) return '70-84'
  if (c >= 0.5) return '50-69'
  return '0-49'
}
