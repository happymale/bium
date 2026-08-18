import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { destinationFor } from '../data/region'
import { useActiveRegion } from '../lib/activeRegion'
import { useItems } from '../store/items'
import { formatWon } from '../lib/fees'
import { analytics } from '../lib/analytics'
import { daysIdle, originOf } from '../types'
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
  const regionOpt = useActiveRegion()
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
      sub: `${regionOpt.name} 요금표에서 “${item.feeMatchedName ?? item.name}”${
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
    <Screen title="신청 대행 (시연)" back>
      {/* 진짜 대행은 지자체와의 제휴·정산 계약이 있어야 가능합니다.
          이 화면은 "협약이 있다면 이렇게 된다" 를 보여주는 개념 시연입니다. */}
      <div className={s.prototype}>
        <b>이 화면은 개념 시연입니다.</b>
        <br />
        실제 신고와 결제는 일어나지 않습니다. 지자체마다 신고 시스템이 다르고,
        수수료를 대신 받아 납부하려면 구청과의 제휴·정산 계약이 필요합니다.
        지금 실제로 신고하시려면 이전 화면의 <b>“{regionOpt.name}에 직접
        신고하기”</b>를 이용해 주세요.
      </div>

      <div className={s.target}>
        <span className={s.thumb}>
          <i style={{ background: kind.color }} />
        </span>
        <div>
          <div className={s.nm}>{item.name}</div>
          <div className={s.sub}>
            {regionOpt.name} 대형폐기물 인터넷 신고
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
          <span>{regionOpt.name} 대형폐기물 수수료</span>
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
            <b>시연 완료 — 실제 신고는 접수되지 않았습니다.</b>
            <br />
            협약이 되어 있다면 여기서 결제가 이루어지고, 배출 스티커 번호가
            알림으로 오고, {dueDate} 저녁 8시에 배출 위치를 다시 안내합니다.
            실제 신고는 {regionOpt.name} 신고 사이트에서 해주세요.
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
            // 상태를 바꾸기 전에 읽어야 등록→신청까지의 일수가 나옵니다
            const origin = originOf(item)
            const idleDays = daysIdle(item)
            setStatus(
              item.id,
              'requested',
              destinationFor(item.route, regionOpt.name).reserved,
            )
            analytics.requestApproved(item.route, total)
            analytics.itemRequested({
              route: item.route,
              origin,
              daysSinceAdd: idleDays,
              secondsFromCapture: item.capturedAt
                ? (Date.now() - item.capturedAt) / 1000
                : undefined,
            })
          }}
        >
          승인하기 (시연 · 결제 없음)
        </button>
      )}
    </Screen>
  )
}
