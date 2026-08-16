import { getFeeTable, type FeeTable } from './fees'

/**
 * 선택 가능한 지역 목록.
 *
 * 요금표를 실제로 수집한 구만 `supported` 입니다.
 * "지자체마다 요금과 신고 경로가 다르다" 는 것이 이 앱의 출발점이므로,
 * 데이터가 없는 지역에 다른 구의 요금을 보여주면 앱의 존재 이유를 배반합니다.
 * 그래서 미지원 지역은 화면에서 명확히 표시하고 구청 문의로 안내합니다.
 */

export type RegionOption = {
  id: string
  name: string
  supported: boolean
  /** 지원 지역이면 요금표·문의처 */
  fees?: FeeTable
}

/** 서울 25개 자치구 (가나다순) — id 는 요금표 레지스트리 키와 맞춥니다 */
const SEOUL_GU: { id: string; name: string }[] = [
  { id: 'gangnam', name: '강남구' },
  { id: 'gangdong', name: '강동구' },
  { id: 'gangbuk', name: '강북구' },
  { id: 'gangseo', name: '강서구' },
  { id: 'gwanak', name: '관악구' },
  { id: 'gwangjin', name: '광진구' },
  { id: 'guro', name: '구로구' },
  { id: 'geumcheon', name: '금천구' },
  { id: 'nowon', name: '노원구' },
  { id: 'dobong', name: '도봉구' },
  { id: 'ddm', name: '동대문구' },
  { id: 'dongjak', name: '동작구' },
  { id: 'mapo', name: '마포구' },
  { id: 'sdm', name: '서대문구' },
  { id: 'seocho', name: '서초구' },
  { id: 'seongdong', name: '성동구' },
  { id: 'seongbuk', name: '성북구' },
  { id: 'songpa', name: '송파구' },
  { id: 'yangcheon', name: '양천구' },
  { id: 'ydp', name: '영등포구' },
  { id: 'yongsan', name: '용산구' },
  { id: 'ep', name: '은평구' },
  { id: 'jongno', name: '종로구' },
  { id: 'junggu', name: '중구' },
  { id: 'jungnang', name: '중랑구' },
]

export const REGION_OPTIONS: RegionOption[] = SEOUL_GU.map(({ id, name }) => {
  const fees = getFeeTable(id)
  return { id, name, supported: Boolean(fees), fees: fees ?? undefined }
})

export const DEFAULT_REGION_ID = 'sdm'

export function findRegionOption(id: string): RegionOption {
  return (
    REGION_OPTIONS.find((r) => r.id === id) ??
    REGION_OPTIONS.find((r) => r.id === DEFAULT_REGION_ID)!
  )
}

export const SUPPORTED_COUNT = REGION_OPTIONS.filter((r) => r.supported).length
export const TOTAL_COUNT = REGION_OPTIONS.length
