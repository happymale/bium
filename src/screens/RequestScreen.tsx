import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { CURRENT_REGION, DESTINATION } from '../data/region'
import { useItems } from '../store/items'
import { formatWon } from '../lib/fees'
import { analytics } from '../lib/analytics'
import s from './RequestScreen.module.css'

/** 비움 대행 수수료 (목업 ③ 기준) */
const AGENT_FEE = 1900

/** 배출 예정일 — 오늘로부터 가장 가까운 금요일 */
function nextFriday(from = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  return d
}

function fmtDate(d: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`
}

export function RequestScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const item = useItems((st) => st.items.find((i) => i.id === id))
  const setStatus = useItems((st) => st.setStatus)
  const [approved, setApproved] = useState(false)

  if (!item) {
    return (
      <Screen title="신청 대행" back>
        <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '48px 0' }}>
          물건을 찾을 수 없습니다.
        </p>
      </Screen>
    )
  }

  const kind = ROUTE_BY_ID[item.route]
  const dueDate = fmtDate(nextFriday())
  const isApproved = approved || item.status !== 'pending'

  const steps = [
    {
      title: '품목 매칭',
      sub: `${CURRENT_REGION.name} 요금표에서 “${item.feeMatchedName ?? item.name}”${
        item.feeSpec ? ` · ${item.feeSpec}` : ''
      } 확인 · 수수료 ${formatWon(item.fee)}`,
      state: 'done' as const,
    },
    {
      title: '신고서 자동 작성',
      sub: `주소·배출 장소·배출 예정일 ${dueDate} 입력 완료`,
      state: 'done' as const,
    },
    {
      title: '사용자 승인 대기',
      sub: '결제 전 금액과 항목을 확인하세요',
      state: isApproved ? ('done' as const) : ('now' as const),
    },
    {
      title: '수수료 결제 및 신고 제출',
      sub: '승인 후 즉시',
      state: isApproved ? ('done' as const) : ('wait' as const),
    },
    {
      title: '배출 스티커 번호 수령',
      sub: '약 1분 · 종이 스티커 구매 불필요',
      state: isApproved ? ('done' as const) : ('wait' as const),
    },
    {
      title: '배출일 알림',
      sub: `${dueDate} 저녁 8시 · 배출 위치 사진 안내`,
      state: 'wait' as const,
    },
  ]

  const total = item.fee + AGENT_FEE

  return (
    <Screen title="신청 대행" back>
      <div className={s.target}>
        <span className={s.thumb}>
          <i style={{ background: kind.color }} />
        </span>
        <div>
          <div className={s.nm}>{item.name}</div>
          <div className={s.sub}>
            {CURRENT_REGION.name} 대형폐기물 인터넷 신고
          </div>
        </div>
      </div>

      <ul className={s.steps}>
        {steps.map((st, i) => (
          <li key={st.title}>
            <span className={`${s.st} ${s[st.state]}`}>
              {st.state === 'done' ? '✓' : st.state === 'now' ? '▶' : i + 1}
            </span>
            <div className={s.tx}>
              {st.title}
              <em>{st.sub}</em>
            </div>
          </li>
        ))}
      </ul>

      <div className={s.bill}>
        <div className={s.row}>
          <span>{CURRENT_REGION.name} 대형폐기물 수수료</span>
          <span className="tnum">{formatWon(item.fee)}</span>
        </div>
        <div className={s.row}>
          <span>비움 대행 수수료</span>
          <span className="tnum">{formatWon(AGENT_FEE)}</span>
        </div>
        <div className={`${s.row} ${s.total}`}>
          <span>합계</span>
          <span className="tnum">{formatWon(total)}</span>
        </div>
        <p className={s.note}>
          승인 없이는 어떤 결제도 일어나지 않습니다. 신고 취소 시 수수료는 전액
          환불됩니다.
        </p>
      </div>

      {isApproved ? (
        <>
          <div className={s.approved}>
            <b>승인 완료 · 신고가 접수됐습니다.</b>
            <br />
            배출 스티커 번호는 알림으로 보내드립니다. {dueDate} 저녁 8시에 배출
            위치를 다시 안내합니다.
          </div>
          <button
            type="button"
            className={s.cta}
            onClick={() => navigate('/list')}
          >
            목록으로 돌아가기
          </button>
        </>
      ) : (
        <button
          type="button"
          className={s.cta}
          onClick={() => {
            setApproved(true)
            setStatus(item.id, 'requested', DESTINATION[item.route].reserved)
            analytics.requestApproved(item.route, total)
          }}
        >
          승인하고 {formatWon(total)} 결제하기
        </button>
      )}
    </Screen>
  )
}
