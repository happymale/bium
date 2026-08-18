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
  /** 재사용·재활용으로 간 개수 (대형폐기물·종량제 제외) */
  recirculated: number
  /** 다시 쓰이게 된 비율 0~100 */
  rate: number
  /** 안내를 보고도 종량제봉투로 간 개수 — 카운터 메트릭 */
  wasteBag: number
  /**
   * **실제로 간 곳** 기준 개수 (0인 칸은 제외).
   * 종량제로 간 물건은 판별 경로가 아니라 안티 경로('burn')로 셉니다 —
   * 막대가 "대형폐기물 1"이라고 말하는데 그 물건이 소각됐으면 거짓말이 됩니다.
   */
  segments: { route: RouteId | 'burn'; count: number }[]
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
  // 종량제로 간 물건은 판별 경로가 'reuse' 여도 재사용으로 세지 않습니다.
  // 대표 지표는 "안내한 경로"가 아니라 **실제로 간 곳**을 재야 합니다.
  const wasteBag = done.filter((i) => i.disposal === 'waste_bag').length
  const recirculated = done.filter(
    (i) => i.route !== 'bulk' && i.disposal !== 'waste_bag',
  ).length

  const counts: Record<RouteId | 'burn', number> = {
    reuse: 0,
    free: 0,
    bulk: 0,
    drop: 0,
    burn: 0,
  }
  for (const i of done) {
    counts[i.disposal === 'waste_bag' ? 'burn' : i.route] += 1
  }

  let avoidedFee = 0
  let paidFee = 0
  for (const i of done) {
    // 종량제로 보낸 물건은 아무것도 아끼지 않았습니다 — 집계에서 뺍니다
    if (i.disposal === 'waste_bag') continue
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
    wasteBag,
    rate: total === 0 ? 0 : Math.round((recirculated / total) * 100),
    segments: (['reuse', 'free', 'bulk', 'drop', 'burn'] as const)
      .map((route) => ({ route, count: counts[route] }))
      .filter((s) => s.count > 0),
    avoidedFee,
    paidFee,
  }
}
