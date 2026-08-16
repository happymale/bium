import { SDM_FEE_SOURCE } from './sdmBulkFees'

/**
 * 지역별 배출 규정. 현재는 서대문구 1곳만 구현되어 있습니다.
 * (다른 자치구를 추가하려면 이 배열에 항목을 넣고 요금표를 붙이면 됩니다.)
 */
export type Region = {
  id: string
  name: string
  /** 대형폐기물 신고 · 문의 */
  bulk: {
    phone: string
    reportUrl: string
    feeTableUrl: string
    /** 요금표 확인일 — 화면의 "규정 확인일" 문구에 그대로 노출됩니다 */
    checkedOn: string
  }
  /** 폐가전 무상방문수거 (전국 공통 운영) */
  freePickup: {
    phone: string
    operator: string
    note: string
  }
  /** 전용 수거함 대상 품목 */
  dropOff: {
    kind: string
    where: string
  }[]
}

export const SEODAEMUN: Region = {
  id: 'sdm',
  name: '서대문구',
  bulk: {
    phone: '02-330-1376',
    reportUrl: 'https://www.sdm.go.kr/civil/print/xpay/reg.do',
    feeTableUrl: SDM_FEE_SOURCE.url,
    checkedOn: SDM_FEE_SOURCE.checkedOn,
  },
  freePickup: {
    phone: '1599-0903',
    operator: '폐가전제품 무상방문수거 콜센터',
    note: '원형이 보전된 폐가전은 대형폐기물 수수료 없이 무상으로 수거합니다.',
  },
  // 수거함 위치는 아직 실제 좌표 데이터를 확보하지 않았습니다.
  // 4~5단계에서 실제 위치를 붙이기 전까지는 안내 문구만 노출합니다.
  dropOff: [
    { kind: '폐건전지', where: '주민센터 · 아파트 단지 수거함' },
    { kind: '폐형광등', where: '주민센터 · 아파트 단지 수거함' },
    { kind: '폐의약품', where: '약국 · 보건소 · 주민센터' },
  ],
}

export const CURRENT_REGION = SEODAEMUN

/**
 * 경로별 기본 행선지 — 리포트의 "어디로 갔는지" 추적에 기록됩니다.
 * 프로토타입이라 고정값이지만, 실제 서비스에서는 예약한 업체·지점이 들어갈 자리입니다.
 */
export const DESTINATION: Record<
  string,
  { reserved: string; completed: string }
> = {
  reuse: {
    reserved: '아름다운가게 신촌점 · 픽업 예약됨',
    completed: '아름다운가게 신촌점 · 기증 완료',
  },
  free: {
    reserved: '폐가전 재활용센터 · 수거 예약됨',
    completed: '폐가전 재활용센터 · 수거 완료',
  },
  bulk: {
    reserved: `${SEODAEMUN.name} 처리장 · 배출 신고됨`,
    completed: `${SEODAEMUN.name} 처리장 · 배출 완료`,
  },
  drop: {
    reserved: '전용 수거함 · 배출 예정',
    completed: '전용 수거함 · 투입 완료',
  },
}

/** 선택한 자치구가 처리 기록에도 정확히 남도록 목적지를 계산합니다. */
export function destinationFor(route: string, regionName: string) {
  if (route === 'bulk') {
    return {
      reserved: `${regionName} 처리장 · 배출 신고됨`,
      completed: `${regionName} 처리장 · 배출 완료`,
    }
  }
  return DESTINATION[route]
}

/** 페르소나 — 1단계에서 "고정"으로 확정 */
export const PERSONA = {
  name: '수현',
  dong: '신촌동',
  get label() {
    return `${this.name} · ${CURRENT_REGION.name} ${this.dong}`
  },
} as const
