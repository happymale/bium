import type { FeeRow } from '../sdmBulkFees'
import { SDM_BULK_FEES, SDM_FEE_SOURCE } from '../sdmBulkFees'
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

/* ── 서대문구 보정 ──────────────────────────────────────────────────────────
 *
 * 자치법규(ELIS) 기반 자동 수집본에는 **소파가 한 행도 없습니다.** 25개 구 중
 * 서대문구만 그렇고, 하필 기본 지역이자 4주 실험 지역입니다. 폐가전 무상(0원)
 * 행도 68개 → 37개로 줄어 요금표發 free 보정이 얇아졌습니다.
 *
 * 그래서 구청 안내 페이지에서 손수 수집한 218행을 합칩니다. 합치기 전에 두
 * 가지를 확인했습니다.
 *   · 품목+규격이 정확히 겹치는 49행의 **금액이 전부 일치** — 두 출처가
 *     서로 모순되지 않습니다.
 *   · 한쪽이 0원인데 다른 쪽이 유료인 품목 **0개** — 합쳐도 무상 판정이
 *     뒤집히지 않습니다.
 *
 * 규격 표기는 서로 달라서(예: "가습기/소형(1M미만)" vs "가습기/규격없음")
 * 양쪽을 모두 후보로 남깁니다. resolveFee 가 규격 토큰으로 점수를 매기므로
 * 후보가 많을수록 정확해지고, 동점이면 더 싼 쪽을 고릅니다(보수적).
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s()·.,\-–—/]/g, '')
}

function mergeRows(primary: FeeRow[], extra: FeeRow[]): FeeRow[] {
  const seen = new Set(primary.map((r) => `${normalize(r.name)}|${normalize(r.spec)}`))
  const merged = [...primary]
  for (const r of extra) {
    const key = `${normalize(r.name)}|${normalize(r.spec)}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(r)
  }
  return merged
}

function withSdmFallback(base: FeeTable): FeeTable {
  const rows = mergeRows(SDM_BULK_FEES, base.rows)
  return {
    ...base,
    rows,
    source: {
      ...base.source,
      // 두 출처를 합쳤다는 사실을 화면에 그대로 드러냅니다.
      // 어디서 온 금액인지 숨기면 "구청 고시 기준" 이라는 말이 거짓이 됩니다.
      authority: `${SDM_FEE_SOURCE.authority} · ${base.source.authority}`,
      url: SDM_FEE_SOURCE.url,
      rowCount: rows.length,
    },
  }
}

export const FEE_TABLES: Record<string, FeeTable> = {
  ...SEOUL_FEE_TABLES,
  sdm: withSdmFallback(SEOUL_FEE_TABLES.sdm),
}

export function getFeeTable(regionId: string): FeeTable | null {
  return FEE_TABLES[regionId] ?? null
}

export const SUPPORTED_REGION_IDS = Object.keys(FEE_TABLES)

/**
 * 이 구의 reportUrl 이 **실제 신고 시스템**인지.
 *
 * 자동 수집본은 신고 URL 을 찾지 못한 구에 구글 검색 링크를 넣어 뒀습니다
 * (25개 중 21개). 그걸 "○○구에 직접 신고하기" 라고 부르면 버튼이 거짓말을
 * 하게 되므로, 화면에서 문구를 갈라 쓰기 위한 판별입니다.
 */
export function isDirectReportUrl(url: string): boolean {
  return !/(?:google|naver|daum|bing)\.[a-z.]+\/search/i.test(url)
}
