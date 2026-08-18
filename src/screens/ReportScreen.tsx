import { Screen } from '../components/Screen'
import { BURN_COLOR, ROUTE_BY_ID } from '../data/routeKinds'
import type { RouteId } from '../data/routeKinds'
import { isDemo, useItems } from '../store/items'
import { summarize } from '../lib/report'
import { formatWon } from '../lib/fees'
import s from './ReportScreen.module.css'

/** 막대·범례에 쓸 색과 이름. 'burn' 은 판별 경로가 아니라 실제 행선지입니다. */
function segStyle(route: RouteId | 'burn'): { color: string; label: string } {
  if (route === 'burn') return { color: BURN_COLOR, label: '종량제(소각)' }
  const kind = ROUTE_BY_ID[route]
  return { color: kind.color, label: kind.label }
}

export function ReportScreen() {
  const items = useItems((st) => st.items)
  const r = summarize(items)
  const demoCount = r.done.filter(isDemo).length

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
        {/* 이 숫자는 "실제 도달"이 아니라 사용자가 표시한 값입니다.
            과장하지 않으려면 화면에 적혀 있어야 합니다. */}
        <div className={s.disclosure}>
          직접 표시하신 기록을 셉니다 — 수거처의 실제 도착 확인은 아직 연동되지
          않았습니다.
          {demoCount > 0 && (
            <>
              {' '}
              시연용 예시 <span className="tnum">{demoCount}</span>건이 포함된
              숫자입니다.
            </>
          )}
        </div>
      </div>

      <div className={s.segbar}>
        {r.segments.map((seg) => (
          <div
            key={seg.route}
            className={s.seg}
            style={{ flex: seg.count, background: segStyle(seg.route).color }}
          >
            {seg.count}
          </div>
        ))}
      </div>

      <div className={s.legend}>
        {r.segments.map((seg) => (
          <span key={seg.route}>
            <i style={{ background: segStyle(seg.route).color }} />
            {segStyle(seg.route).label} {seg.count}
          </span>
        ))}
      </div>

      {r.wasteBag > 0 && (
        <div className={s.wasteBag}>
          이 중 <b className="tnum">{r.wasteBag}개</b>는 종량제봉투로 갔습니다.
          안내가 어디서 안 통했는지 보는 지표로 씁니다 — 비난이 아닙니다.
        </div>
      )}

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
