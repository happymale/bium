import { SDM_BULK_FEES, SDM_FEE_SOURCE, type FeeRow } from '../sdmBulkFees'
import { JONGNO_FEES, JONGNO_SOURCE } from './jongno'

/**
 * 지역별 요금표 레지스트리.
 *
 * 새 자치구를 추가하려면 이 파일에 항목 하나만 넣으면 됩니다.
 * 요금표가 없는 지역은 여기 없고, 앱은 금액 대신 구청 문의로 안내합니다.
 */

export type FeeSource = {
  authority: string
  url: string
  /** 요금표 확인일 — 화면의 "규정 확인일" 문구에 그대로 노출됩니다 */
  checkedOn: string
  rowCount: number
}

export type FeeTable = {
  regionId: string
  regionName: string
  rows: FeeRow[]
  source: FeeSource
  /** 대형폐기물 문의 전화 (각 구청 페이지에서 확인한 값) */
  phone: string
  reportUrl: string
}

export const FEE_TABLES: Record<string, FeeTable> = {
  sdm: {
    regionId: 'sdm',
    regionName: '서대문구',
    rows: SDM_BULK_FEES,
    source: SDM_FEE_SOURCE,
    phone: '02-330-1376',
    reportUrl: 'https://www.sdm.go.kr/civil/print/xpay/reg.do',
  },
  jongno: {
    regionId: 'jongno',
    regionName: '종로구',
    rows: JONGNO_FEES,
    source: JONGNO_SOURCE,
    phone: '02-2148-2376',
    reportUrl: 'https://jongno.go.kr/waste/pc/web/expense/selectExpenseList.do',
  },
}

export function getFeeTable(regionId: string): FeeTable | null {
  return FEE_TABLES[regionId] ?? null
}

export const SUPPORTED_REGION_IDS = Object.keys(FEE_TABLES)
