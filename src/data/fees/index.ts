import type { FeeRow } from '../sdmBulkFees'
import { SEOUL_FEE_TABLES } from './seoul.generated'

/**
 * 지역별 요금표 레지스트리.
 *
 * 수집·정규화 스크립트가 만든 서울 25개 자치구 요금표를 노출합니다.
 */

export type FeeSource = {
  authority: string
  url: string
  /** 요금표 확인일 — 화면의 "규정 확인일" 문구에 그대로 노출됩니다 */
  checkedOn: string
  /** 자치법규 원문에 표시된 최신 시행일 (공식 데이터 포털은 생략 가능) */
  effectiveOn?: string
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

export const FEE_TABLES: Record<string, FeeTable> = SEOUL_FEE_TABLES

export function getFeeTable(regionId: string): FeeTable | null {
  return FEE_TABLES[regionId] ?? null
}

export const SUPPORTED_REGION_IDS = Object.keys(FEE_TABLES)
