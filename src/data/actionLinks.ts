import type { RouteId } from './routeKinds'

/**
 * 경로별 "실제로 신청하는 곳".
 *
 * ⚠ 이 앱은 대형폐기물 신고 외에는 **대신 신청해 줄 수 없습니다.**
 *   무상수거는 전국 콜센터가, 기부는 각 단체가, 수거함은 본인이 처리합니다.
 *   그래서 버튼을 "예약하기"(우리가 해준다)가 아니라
 *   "예약하러 가기"(실제 창구로 보낸다)로 두고, 다녀온 뒤 상태를 직접
 *   표시하게 합니다. 하지도 않은 예약을 완료로 표시하면 사용자는
 *   오지 않을 수거를 기다리게 됩니다.
 */

export type ActionLink = {
  /** 실제 신청 창구로 보내는 버튼 문구 */
  goLabel: string
  /** 다녀온 뒤 상태를 바꾸는 버튼 문구 */
  doneLabel: string
  /** 이 경로가 '예약'을 거치는지 (수거함은 바로 완료) */
  hasReservation: boolean
  url: (regionName: string) => string
  /** 전화 예약이 가능하면 번호 */
  phone?: string
  note: string
}

export const ACTION_LINKS: Record<RouteId, ActionLink> = {
  free: {
    goLabel: '무상수거 예약하러 가기',
    doneLabel: '예약했어요',
    hasReservation: true,
    // 환경부 위탁 e순환거버넌스 — 전국 어디서나 같은 창구입니다
    url: () => 'https://15990903.or.kr/portal/main/main.do',
    phone: '1599-0903',
    note: '폐가전 무상방문수거 공식 예약처로 이동합니다. 전화 예약도 됩니다 (평일 08~18시).',
  },
  reuse: {
    goLabel: '기부처 찾아보기',
    doneLabel: '픽업 예약했어요',
    hasReservation: true,
    url: (region) =>
      `https://www.google.com/search?q=${encodeURIComponent(`${region} 물품 기증 방문수거`)}`,
    note: '아름다운가게·굿윌스토어 등 단체마다 접수 방식이 다릅니다. 우리 동네에서 받아주는 곳을 찾아보세요.',
  },
  drop: {
    goLabel: '가까운 수거함 찾기',
    doneLabel: '넣고 왔어요',
    // 수거함은 예약이 없습니다 — 들고 가면 끝입니다
    hasReservation: false,
    url: (region) =>
      `https://map.naver.com/p/search/${encodeURIComponent(`${region} 폐건전지 수거함`)}`,
    note: '주민센터·아파트 단지에 있습니다. 비용은 들지 않습니다.',
  },
  bulk: {
    goLabel: '신청 대행 맡기기',
    doneLabel: '배출 완료',
    hasReservation: true,
    url: () => '',
    note: '',
  },
}
