/**
 * 비움의 4개 처리 경로 + 안티 경로(종량제).
 * 목업의 컬러 토큰과 1:1 대응합니다. 2단계에서 판별 결과가 이 id 를 반환합니다.
 */

export type RouteId = 'reuse' | 'free' | 'bulk' | 'drop'
/** 판별 결과로는 절대 반환하지 않는 안티 경로. 리포트에서 "만약 종량제였다면" 비교용. */
export type AntiRouteId = 'burn'

export type RouteKind = {
  id: RouteId
  label: string
  /** 필터 칩처럼 폭이 좁은 자리에서 쓰는 짧은 이름 */
  short: string
  /** 홈 화면 카드의 한 줄 설명 */
  hint: string
  /** CSS 변수 참조 — 다크모드에서 자동으로 갈립니다 */
  color: string
  /** 비용 표기 기본값 (bulk 만 지자체 요금표를 따름) */
  freeOfCharge: boolean
}

export const ROUTE_KINDS: RouteKind[] = [
  {
    id: 'reuse',
    label: '재사용·기부',
    short: '재사용',
    hint: '아직 쓸 만한 가구·의류·장난감 · 0원 픽업',
    color: 'var(--r-reuse)',
    freeOfCharge: true,
  },
  {
    id: 'free',
    label: '무상 방문수거',
    short: '무상',
    hint: '폐가전 전 품목 · 0원',
    color: 'var(--r-free)',
    freeOfCharge: true,
  },
  {
    id: 'bulk',
    label: '대형폐기물 신고',
    short: '대형',
    hint: '가구·매트리스 · 지자체별 수수료',
    color: 'var(--r-bulk)',
    freeOfCharge: false,
  },
  {
    id: 'drop',
    label: '전용 수거함',
    short: '수거함',
    hint: '폐의약품·건전지·형광등 · 위치 안내',
    color: 'var(--r-drop)',
    freeOfCharge: true,
  },
]

export const ROUTE_BY_ID = Object.fromEntries(
  ROUTE_KINDS.map((r) => [r.id, r]),
) as Record<RouteId, RouteKind>

export const BURN_COLOR = 'var(--r-burn)'
