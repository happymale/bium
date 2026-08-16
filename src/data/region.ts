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

/** 페르소나 — 1단계에서 "고정"으로 확정 */
export const PERSONA = {
  name: '수현',
  dong: '신촌동',
  get label() {
    return `${this.name} · ${CURRENT_REGION.name} ${this.dong}`
  },
} as const
