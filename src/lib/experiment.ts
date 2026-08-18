/**
 * 4주 실험(§6-4) 참가군 배정과 계측 화면 노출.
 *
 * ★ 참가군은 **초대 링크로만** 배정합니다.
 *
 *   https://biume.vercel.app/?g=A   → 판별만 그룹
 *   https://biume.vercel.app/?g=B   → 판별+대행 그룹
 *
 *   사용자에게 선택지를 보여주면 자기가 어느 그룹인지 알게 되고,
 *   그러면 §6-4 의 성공 기준("B 의 K2 가 A 보다 20%p 높은가")이
 *   행동 편향으로 오염됩니다. 그래서 화면에서 완전히 감췄습니다.
 */

const VALID_GROUPS = ['A', 'B'] as const

/**
 * 주소에서 참가군을 읽습니다. 없으면 빈 문자열(미참가).
 *
 * HashRouter 를 쓰므로 물음표가 해시 앞(`/?g=A#/`)에도 뒤(`/#/?g=A`)에도
 * 올 수 있습니다. 둘 다 봅니다.
 */
export function readGroupFromUrl(): string {
  const fromSearch = new URLSearchParams(window.location.search).get('g')
  const hash = window.location.hash
  const q = hash.indexOf('?')
  const fromHash =
    q >= 0 ? new URLSearchParams(hash.slice(q + 1)).get('g') : null

  const raw = (fromSearch ?? fromHash ?? '').trim().toUpperCase()
  return (VALID_GROUPS as readonly string[]).includes(raw) ? raw : ''
}

/**
 * 계측 점검 화면(#/metrics)을 띄울지.
 *
 * 개발 중에는 항상 켜고, 배포본에서는 VITE_SHOW_METRICS=1 을 넣은 빌드에서만
 * 라우트가 생깁니다. 없으면 주소를 알아도 404 로 갑니다 —
 * 링크를 감추는 것만으로는 감춘 게 아닙니다.
 */
export const METRICS_VISIBLE =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_METRICS === '1'
