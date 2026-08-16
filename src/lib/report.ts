import type { Item } from '../types'
import type { RouteId } from '../data/routeKinds'
import { exactFee, lookupFee } from './fees'

/**
 * 리포트 집계.
 *
 * 대표 지표를 "버린 개수"가 아니라 "다시 쓰이게 된 비율"로 둔 것은 목업 ④의 설계 의도입니다.
 * 많이 버린 사람이 칭찬받는 구조를 피하기 위한 선택입니다.
 */

export type ReportSummary = {
  /** 처리 완료된 물건 */
  done: Item[]
  total: number
  /** 재사용·재활용으로 간 개수 (대형폐기물 제외) */
  recirculated: number
  /** 다시 쓰이게 된 비율 0~100 */
  rate: number
  /** 경로별 개수 (0인 경로는 제외) */
  segments: { route: RouteId; count: number }[]
  /**
   * 무상 경로로 보낸 물건을 대형폐기물로 신고했다면 냈을 수수료 합계.
   * 서대문구 실제 요금표에서 역산하며, 요금표에 없는 품목은 0으로 셉니다.
   */
  avoidedFee: number
  /** 실제로 지불한 대형폐기물 수수료 */
  paidFee: number
}

export function summarize(items: Item[]): ReportSummary {
  const done = items.filter((i) => i.status === 'done')
  const total = done.length
  const recirculated = done.filter((i) => i.route !== 'bulk').length

  const counts: Record<RouteId, number> = { reuse: 0, free: 0, bulk: 0, drop: 0 }
  for (const i of done) counts[i.route] += 1

  let avoidedFee = 0
  let paidFee = 0
  for (const i of done) {
    if (i.route === 'bulk') {
      paidFee += i.fee
      continue
    }
    // 이 물건을 대형폐기물로 신고했다면?
    // 규격까지 아는 경우엔 정확한 값을, 모르면 후보 중 최저가를 씁니다(보수적 추정).
    const name = i.feeMatchedName ?? i.name
    const exact = i.feeSpec ? exactFee(name, i.feeSpec) : null
    if (exact != null) {
      avoidedFee += exact
    } else {
      const hit = lookupFee(name)
      if (hit) avoidedFee += hit.minFee
    }
  }

  return {
    done,
    total,
    recirculated,
    rate: total === 0 ? 0 : Math.round((recirculated / total) * 100),
    segments: (['reuse', 'free', 'bulk', 'drop'] as RouteId[])
      .map((route) => ({ route, count: counts[route] }))
      .filter((s) => s.count > 0),
    avoidedFee,
    paidFee,
  }
}
