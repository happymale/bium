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

function track(name: string, params: EventParams = {}) {
  window.gtag?.('event', name, params)
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
  }) =>
    track('classify_done', {
      route: p.route,
      confidence_bucket: p.confidenceBucket,
      uncertain: p.uncertain,
      ai_source: p.aiSource,
      elapsed_ms: Math.round(p.elapsedMs),
    }),

  /** 판별 실패 */
  classifyError: (reason: string) => track('classify_error', { reason }),

  /** 목록에 추가 */
  itemAdded: (route: string, uncertain: boolean) =>
    track('item_added', { route, uncertain }),

  /** 신청 대행 승인 (실제 결제는 아님 — 프로토타입) */
  requestApproved: (route: string, feeWon: number) =>
    track('request_approved', { route, fee_won: feeWon }),

  /** 물건 처리 완료 */
  itemDisposed: (route: string) => track('item_disposed', { route }),

  /** 확신도 미달로 구청 문의 안내가 뜸 */
  lowConfidenceBlocked: (confidenceBucket: string) =>
    track('low_confidence_blocked', { confidence_bucket: confidenceBucket }),
}

/** 확신도를 구간으로 뭉갭니다 (원값을 그대로 보내지 않기 위해) */
export function confidenceBucket(c: number): string {
  if (c >= 0.95) return '95-100'
  if (c >= 0.85) return '85-94'
  if (c >= 0.7) return '70-84'
  if (c >= 0.5) return '50-69'
  return '0-49'
}
