import { useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_KINDS } from '../data/routeKinds'
import { CURRENT_REGION, PERSONA } from '../data/region'
import { pendingItems, useItems } from '../store/items'
import { pickToday, reasonFor } from '../lib/recommend'
import { subject } from '../lib/korean'
import { daysIdle } from '../types'
import s from './HomeScreen.module.css'

export function HomeScreen() {
  const navigate = useNavigate()
  const items = useItems((st) => st.items)

  const waiting = pendingItems(items)
  // 가장 오래된 것이 아니라 "오늘 당장 처리할 수 있는 것"을 권합니다
  const today = pickToday(items)

  return (
    <Screen title="비움 BIUM">
      <p className={s.hello}>
        <b>{PERSONA.name}</b> 님 · {CURRENT_REGION.name} {PERSONA.dong}
      </p>

      <section className={s.nudge}>
        <b>오늘 하나만 비워볼까요?</b>
        {today ? (
          <p>
            <b>{today.name}</b>
            {subject(today.name)} 오늘 하기 가장 쉽습니다 —{' '}
            {reasonFor(today)}. 등록한 지{' '}
            <b className="tnum">{daysIdle(today)}일</b>째 · 집에 남은 물건{' '}
            <b className="tnum">{waiting.length}개</b>.
          </p>
        ) : (
          <p>기다리는 물건이 없습니다. 오늘은 쉬어도 좋습니다.</p>
        )}
        {today ? (
          <button
            type="button"
            className={s.cta}
            onClick={() => navigate(`/result/${today.id}`)}
          >
            {today.name} 처리하기
          </button>
        ) : (
          <button
            type="button"
            className={s.cta}
            onClick={() => navigate('/capture')}
          >
            사진 한 장으로 판별하기
          </button>
        )}
      </section>

      <h2 className={s.sectionTitle}>네 가지 처리 경로</h2>
      <div className={s.routes}>
        {ROUTE_KINDS.map((r) => (
          <article key={r.id} className={s.route}>
            <div className={s.routeHead}>
              <i className={s.swatch} style={{ background: r.color }} />
              {r.label}
            </div>
            <p>{r.hint}</p>
          </article>
        ))}
      </div>

      <p className={s.callout}>
        <b className={s.burn}>종량제봉투는 네 경로 어디에도 없습니다.</b> 비움의
        목표는 “대신 버려주기”가 아니라 <b>종량제로 가는 물건을 줄이는 것</b>
        입니다.
      </p>
    </Screen>
  )
}
