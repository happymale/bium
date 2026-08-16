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
  /** 지도를 열 때 중심으로 쓸 좌표 [경도, 위도] */
  center: [string, string]
}

/**
 * 서울 25개 자치구 (가나다순) — id 는 요금표 레지스트리 키와 맞춥니다.
 * center 는 각 구청 부근 좌표로, **지도 초기 중심을 잡는 용도**입니다.
 * (정밀 측위가 아니라 화면을 그 동네로 옮기는 데만 씁니다)
 */
const SEOUL_GU: { id: string; name: string; center: [string, string] }[] = [
  { id: 'gangnam', name: '강남구', center: ['127.0473', '37.5172'] },
  { id: 'gangdong', name: '강동구', center: ['127.1238', '37.5301'] },
  { id: 'gangbuk', name: '강북구', center: ['127.0257', '37.6396'] },
  { id: 'gangseo', name: '강서구', center: ['126.8495', '37.5509'] },
  { id: 'gwanak', name: '관악구', center: ['126.9516', '37.4784'] },
  { id: 'gwangjin', name: '광진구', center: ['127.0823', '37.5385'] },
  { id: 'guro', name: '구로구', center: ['126.8874', '37.4954'] },
  { id: 'geumcheon', name: '금천구', center: ['126.8956', '37.4569'] },
  { id: 'nowon', name: '노원구', center: ['127.0568', '37.6542'] },
  { id: 'dobong', name: '도봉구', center: ['127.0471', '37.6688'] },
  { id: 'ddm', name: '동대문구', center: ['127.0396', '37.5744'] },
  { id: 'dongjak', name: '동작구', center: ['126.9393', '37.5124'] },
  { id: 'mapo', name: '마포구', center: ['126.9018', '37.5663'] },
  { id: 'sdm', name: '서대문구', center: ['126.9368', '37.5791'] },
  { id: 'seocho', name: '서초구', center: ['127.0324', '37.4837'] },
  { id: 'seongdong', name: '성동구', center: ['127.0371', '37.5633'] },
  { id: 'seongbuk', name: '성북구', center: ['127.0167', '37.5894'] },
  { id: 'songpa', name: '송파구', center: ['127.1059', '37.5145'] },
  { id: 'yangcheon', name: '양천구', center: ['126.8666', '37.5170'] },
  { id: 'ydp', name: '영등포구', center: ['126.8962', '37.5264'] },
  { id: 'yongsan', name: '용산구', center: ['126.9654', '37.5384'] },
  { id: 'ep', name: '은평구', center: ['126.9291', '37.6027'] },
  { id: 'jongno', name: '종로구', center: ['126.9794', '37.5730'] },
  { id: 'junggu', name: '중구', center: ['126.9976', '37.5638'] },
  { id: 'jungnang', name: '중랑구', center: ['127.0927', '37.6065'] },
]

export const REGION_OPTIONS: RegionOption[] = SEOUL_GU.map(
  ({ id, name, center }) => {
    const fees = getFeeTable(id)
    return { id, name, center, supported: Boolean(fees), fees: fees ?? undefined }
  },
)

export const DEFAULT_REGION_ID = 'sdm'

export function findRegionOption(id: string): RegionOption {
  return (
    REGION_OPTIONS.find((r) => r.id === id) ??
    REGION_OPTIONS.find((r) => r.id === DEFAULT_REGION_ID)!
  )
}

export const SUPPORTED_COUNT = REGION_OPTIONS.filter((r) => r.supported).length
export const TOTAL_COUNT = REGION_OPTIONS.length
