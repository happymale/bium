import type { Item } from '../types'
import { daysIdle } from '../types'
import type { RouteId } from '../data/routeKinds'

/**
 * "오늘 하나만 비워볼까요?" 추천.
 *
 * 목업 ②의 설계 의도 2번 — **가장 오래 기다린 물건이 아니라
 * 지금 당장 처리할 수 있는 물건을 맨 위에 올립니다.**
 * 211일 된 소파를 권하면 오늘도 못 버리지만, 걸어서 4분 거리 수거함이면 오늘 사라집니다.
 *
 * 그래서 점수는 "처리 난이도"가 주(主), "방치일수"가 종(從)입니다.
 */

/** 경로별 착수 난이도 점수 — 높을수록 오늘 당장 하기 쉬움 */
const EASE: Record<RouteId, number> = {
  // 들고 나가서 넣으면 끝. 예약도 결제도 없음.
  drop: 100,
  // 문 앞에 두고 전화 한 통. 0원.
  free: 80,
  // 픽업 예약 필요. 물건 상태를 확인받아야 할 수도 있음.
  reuse: 55,
  // 신고 + 결제 + 배출일 대기. 가장 무거움.
  bulk: 25,
}

/** 방치일수가 점수에 더할 수 있는 최대치 — 난이도를 뒤집지 못하게 상한을 둡니다 */
const MAX_IDLE_BONUS = 30

export function score(item: Item, now = Date.now()): number {
  const ease = EASE[item.route]
  // 180일에 상한 도달. 오래될수록 가중되지만 경로 난이도를 역전하진 않습니다.
  const idle = Math.min(MAX_IDLE_BONUS, (daysIdle(item, now) / 180) * MAX_IDLE_BONUS)
  return ease + idle
}

/**
 * 오늘 권할 물건 하나.
 * 이미 신청이 끝난 물건은 제외합니다 — 사용자가 할 일이 없기 때문입니다.
 */
export function pickToday(items: Item[], now = Date.now()): Item | undefined {
  const candidates = items.filter((i) => i.status === 'pending')
  if (candidates.length === 0) return undefined
  return candidates.reduce((best, it) =>
    score(it, now) > score(best, now) ? it : best,
  )
}

/** 추천 이유 한 줄 — 화면마다 다시 쓰지 않도록 여기서 만듭니다 */
export function reasonFor(item: Item): string {
  switch (item.route) {
    case 'drop':
      return '전용 수거함에 넣기만 하면 됩니다'
    case 'free':
      return '문 앞에 두면 무상으로 가져갑니다'
    case 'reuse':
      return '픽업을 예약하면 가지러 옵니다'
    case 'bulk':
      return '신고와 결제가 필요합니다'
  }
}
