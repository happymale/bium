import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID, ROUTE_KINDS, type RouteId } from '../data/routeKinds'
import { NATIONWIDE } from '../lib/activeRegion'
import { byIdleDesc, pendingItems, useItems } from '../store/items'
import { daysIdle, type Item } from '../types'
import { formatWon } from '../lib/fees'
import { subject, topic } from '../lib/korean'
import { pickToday } from '../lib/recommend'
import s from './ListScreen.module.css'

type Filter = 'all' | RouteId

/** 목록 부제: 경로 이름 · 비용 (신청 완료된 물건은 그 사실을 먼저 알립니다) */
function subtitle(item: Item): string {
  const kind = ROUTE_BY_ID[item.route]
  if (item.status === 'requested') return `${kind.label} · 신청 완료 · 배출 대기`
  if (item.route === 'bulk') return `${kind.label} · ${formatWon(item.fee)}`
  if (item.route === 'reuse') return `${kind.label} · 픽업 가능`
  return `${kind.label} · 0원`
}

export function ListScreen() {
  const navigate = useNavigate()
  const items = useItems((st) => st.items)
  const [filter, setFilter] = useState<Filter>('all')

  const waiting = byIdleDesc(pendingItems(items))
  const shown = filter === 'all' ? waiting : waiting.filter((i) => i.route === filter)

  // 홈과 같은 추천 로직을 씁니다 (lib/recommend.ts)
  const easiest = pickToday(items)

  return (
    <Screen
      title="우리 집 비움 목록"
      action={
        <button
          type="button"
          className={s.addBtn}
          onClick={() => navigate('/add')}
        >
          + 직접 추가
        </button>
      }
    >
      {easiest && (
        <section className={s.nudge}>
          <b>오늘 하나만 비워볼까요?</b>
          <p>
            {easiest.route === 'drop' ? (
              <>
                <b>{easiest.name}</b>
                {topic(easiest.name)} 전용 수거함에 넣기만 하면 됩니다. 주민센터
                · 아파트 단지 수거함에서 <b>0원</b>.
              </>
            ) : easiest.route === 'free' ? (
              <>
                <b>{easiest.name}</b>
                {topic(easiest.name)} 문 앞에 두면 무상으로 가져갑니다. 수수료{' '}
                <b>0원</b> · {NATIONWIDE.phone}
              </>
            ) : (
              <>
                <b>{easiest.name}</b>
                {subject(easiest.name)} 가장 오래 기다렸습니다.
              </>
            )}
          </p>
        </section>
      )}

      <div className={s.chips}>
        <button
          type="button"
          className={s.chip}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          전체 <span className="tnum">{waiting.length}</span>
        </button>
        {ROUTE_KINDS.map((r) => {
          const n = waiting.filter((i) => i.route === r.id).length
          if (n === 0) return null
          return (
            <button
              key={r.id}
              type="button"
              className={s.chip}
              aria-pressed={filter === r.id}
              onClick={() => setFilter(filter === r.id ? 'all' : r.id)}
            >
              <i style={{ background: r.color }} />
              {r.short} <span className="tnum">{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className={s.empty}>
          {filter === 'all' ? (
            <>
              아직 등록한 물건이 없습니다.
              <br />
              사진을 찍거나 직접 추가해 보세요.
              <span className={s.emptyActions}>
                <button
                  type="button"
                  className={s.emptyCta}
                  onClick={() => navigate('/capture')}
                >
                  사진으로 판별
                </button>
                <button
                  type="button"
                  className={`${s.emptyCta} ${s.emptyGhost}`}
                  onClick={() => navigate('/add')}
                >
                  직접 추가
                </button>
              </span>
            </>
          ) : (
            <>
              이 경로로 기다리는 물건이 없습니다.
              <br />
              다른 칩을 눌러 보세요.
            </>
          )}
        </p>
      ) : (
        shown.map((item) => {
          const d = daysIdle(item)
          return (
            <button
              key={item.id}
              type="button"
              className={s.item}
              onClick={() => navigate(`/result/${item.id}`)}
            >
              <span className={s.thumb}>
                {item.photo ? (
                  <img src={item.photo} alt="" />
                ) : (
                  <i style={{ background: ROUTE_BY_ID[item.route].color }} />
                )}
              </span>
              <span>
                <span className={s.nm}>{item.name}</span>
                <span
                  className={`${s.sub} ${item.status === 'requested' ? s.requested : ''}`}
                >
                  {subtitle(item)}
                </span>
              </span>
              <span className={`${s.days} ${d >= 100 ? s.old : ''}`}>
                <b className="tnum">{d}일</b>
                <span>방치</span>
              </span>
            </button>
          )
        })
      )}
    </Screen>
  )
}
