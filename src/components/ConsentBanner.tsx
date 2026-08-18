import { useState } from 'react'
import {
  analytics,
  analyticsAvailable,
  getConsent,
  setConsent,
} from '../lib/analytics'
import s from './ConsentBanner.module.css'

/**
 * 사용 통계 수집 동의 배너.
 *
 * 측정 ID 가 없으면(개발 중·미설정) 아예 렌더링하지 않습니다.
 * 거부해도 앱 기능은 전부 동일하게 동작합니다 — 통계만 수집하지 않습니다.
 */
export function ConsentBanner() {
  const [state, setState] = useState(() => getConsent())

  if (!analyticsAvailable || state !== 'unset') return null

  function decide(next: 'granted' | 'denied') {
    setConsent(next)
    setState(next)
    // 거부는 보낼 수 없습니다 — 거부하면 gtag 를 애초에 내려받지 않기 때문입니다.
    // 그래서 GA 로는 동의율의 분자만 알 수 있습니다 (분모는 운영자가 셉니다).
    if (next === 'granted') analytics.consentGranted()
  }

  return (
    <div className={s.wrap} role="dialog" aria-label="사용 통계 수집 동의">
      <p className={s.text}>
        서비스 개선을 위해 <b>익명 사용 통계</b>를 수집해도 될까요? 어떤 화면을
        얼마나 쓰는지만 집계하며, <b>사진·품목명·주소는 보내지 않습니다.</b>{' '}
        거부하셔도 모든 기능을 그대로 쓸 수 있습니다.
      </p>
      <div className={s.row}>
        <button
          type="button"
          className={`${s.btn} ${s.ghost}`}
          onClick={() => decide('denied')}
        >
          거부
        </button>
        <button type="button" className={s.btn} onClick={() => decide('granted')}>
          동의
        </button>
      </div>
    </div>
  )
}
