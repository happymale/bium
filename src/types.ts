import type { RouteId } from './data/routeKinds'

export type ItemStatus =
  /** 아직 집에 있음 */
  | 'pending'
  /** 신청·예약 완료, 배출 대기 */
  | 'requested'
  /** 처리 완료 — 리포트에 집계됨 */
  | 'done'

export type Item = {
  id: string
  /** 사용자에게 보이는 품목명 */
  name: string
  route: RouteId
  /** 이 물건에 실제로 드는 비용(원). 무상 경로는 0. */
  fee: number
  /** 서대문구 요금표의 규격 문구 (근거 표시용) */
  feeSpec?: string
  /** 요금표에서 매칭된 항목명 — 근거 문장에 인용 */
  feeMatchedName?: string

  /** 화면 표시용 320px 썸네일 (dataURL). 로컬에 보관합니다. */
  photo?: string
  /** Supabase Storage 안의 원본 경로. 미연동 시 비어 있습니다. */
  photoPath?: string
  /** AI 판별 확신도 0~1 */
  confidence?: number
  /** 왜 이 경로인지에 대한 한 문단 */
  basis?: string

  /** 목록에 등록된 시각 (epoch ms) — 방치일수의 기준 */
  addedAt: number
  status: ItemStatus
  /** 처리 완료 시각 */
  disposedAt?: number
  /** 어디로 갔는지 (리포트의 "행선지" 추적) */
  destination?: string
}

/** 종량제봉투로 갔다면 소각됐을 물건인지 — 리포트의 반사실 비교에 사용 */
export const COUNTERFACTUAL_ROUTES: RouteId[] = ['reuse', 'free', 'drop']

const DAY = 86_400_000

/** 방치일수 (등록일 → 오늘). 처리 완료된 물건은 처리일까지로 고정. */
export function daysIdle(item: Item, now = Date.now()): number {
  const end = item.status === 'done' && item.disposedAt ? item.disposedAt : now
  return Math.max(0, Math.floor((end - item.addedAt) / DAY))
}
