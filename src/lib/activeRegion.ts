import { findRegionOption, type RegionOption } from '../data/regions'
import { SEODAEMUN } from '../data/region'
import { useProfile } from '../store/profile'

/**
 * 현재 선택된 지역.
 *
 * 요금표를 갖춘 지역이 아니면 `fees` 가 undefined 입니다.
 * 호출부는 반드시 그 경우를 다뤄야 합니다 — 다른 구 요금을 대신 보여주면
 * 사용자가 틀린 금액을 믿고 배출하게 됩니다.
 */
export function getActiveRegion(): RegionOption {
  return findRegionOption(useProfile.getState().regionId)
}

/** React 컴포넌트용 — 지역이 바뀌면 자동으로 다시 그립니다 */
export function useActiveRegion(): RegionOption {
  const regionId = useProfile((s) => s.regionId)
  return findRegionOption(regionId)
}

/**
 * 지역과 무관하게 유효한 정보.
 * 폐가전 무상방문수거는 전국 단일 콜센터가 운영합니다.
 */
export const NATIONWIDE = SEODAEMUN.freePickup
