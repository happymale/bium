import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { useItems } from '../store/items'
import { summarize } from '../lib/report'
import { formatWon } from '../lib/fees'
import s from './ReportScreen.module.css'

export function ReportScreen() {
  const items = useItems((st) => st.items)
  const r = summarize(items)

  const month = new Date().getMonth() + 1

  if (r.total === 0) {
    return (
      <Screen title={`${month}월 비움 리포트`}>
        <p className={s.empty}>
          아직 비운 물건이 없습니다.
          <br />
          하나를 처리하면 여기에 행선지가 기록됩니다.
        </p>
      </Screen>
    )
  }

  // 대표 지표를 "버린 개수"가 아니라 "다시 쓰이게 된 비율"로 둡니다 (목업 ④ 설계 의도 1)
  return (
    <Screen title={`${month}월 비움 리포트`}>
      <div className={s.hero}>
        <div className={`${s.big} tnum`}>{r.rate}%</div>
        <div className={s.cap}>다시 쓰이게 된 비율</div>
        <div className={s.sub}>
          이번 달 비운 {r.total}개 중 {r.recirculated}개가 재사용·재활용으로
          갔습니다
        </div>
      </div>

      <div className={s.segbar}>
        {r.segments.map((seg) => (
          <div
            key={seg.route}
            className={s.seg}
            style={{
              flex: seg.count,
              background: ROUTE_BY_ID[seg.route].color,
            }}
          >
            {seg.count}
          </div>
        ))}
      </div>

      <div className={s.legend}>
        {r.segments.map((seg) => (
          <span key={seg.route}>
            <i style={{ background: ROUTE_BY_ID[seg.route].color }} />
            {ROUTE_BY_ID[seg.route].label} {seg.count}
          </span>
        ))}
      </div>

      <div className={s.counter}>
        몰라서 종량제봉투에 넣었다면{' '}
        <b>이 중 {r.recirculated}개가 그대로 소각</b>됐을 것입니다.
        {r.avoidedFee > 0 && (
          <>
            <br />
            무상·재사용 경로로 대체해{' '}
            <b className={s.save}>아낀 수수료 {formatWon(r.avoidedFee)}</b>
            {r.paidFee > 0 && (
              <> · 실제로 낸 대형폐기물 수수료 {formatWon(r.paidFee)}</>
            )}
            .
          </>
        )}
      </div>

      <div className={s.trace}>
        <h3>어디로 갔는지</h3>
        {r.done
          .slice()
          .sort((a, b) => (b.disposedAt ?? 0) - (a.disposedAt ?? 0))
          .map((it) => {
            const [place, state] = (it.destination ?? '').split(' · ')
            return (
              <div key={it.id} className={s.t}>
                <i style={{ background: ROUTE_BY_ID[it.route].color }} />
                <b>{it.name}</b> → {place || '기록 없음'}
                {state && <span>{state}</span>}
              </div>
            )
          })}
      </div>
    </Screen>
  )
}
