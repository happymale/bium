import { useState } from 'react'
import { analytics } from '../lib/analytics'
import { useItems } from '../store/items'
import {
  IDLE_BEFORE_LABEL,
  TRIGGER_LABEL,
  type AcquiredAge,
  type IdleBefore,
  type Item,
  type Trigger,
} from '../types'
import s from './ItemContext.module.css'

/**
 * K0 · K7 · 카운터③ — 물건의 맥락을 묻는 선택 블록.
 *
 * 이 세 지표는 **사용자에게 묻지 않으면 알 수 없습니다.**
 * - K0 방치 개월: addedAt 은 "앱에 등록한 날"이라 방치 기간이 아닙니다.
 *   제안서의 "128일" 이 실재하는지 재려면 물어야 합니다.
 * - K7 트리거: 어떤 순간에 앱을 켜는지(§3-1 S1~S4)는 행동 기록에 안 남습니다.
 * - 카운터③ 취득 시점: 적체 재고와 "사서 금방 버리는" 패턴의 구분점입니다.
 *
 * 설계 규칙 — **질문이 제품을 해치지 않게.**
 * 계측을 늘리려고 필수 입력을 만들면 K5(60초)와 K2(전환율)가 나빠집니다.
 * 그래서 접힌 상태로 두고, 세 줄 다 건너뛸 수 있게 했습니다.
 * 답하지 않은 것도 데이터라서 건너뜀을 따로 셉니다.
 */

const IDLE_ORDER: IdleBefore[] = ['lt1m', 'm1to3', 'm3to6', 'm6to12', 'gt12m']
const TRIGGER_ORDER: Trigger[] = [
  'broken',
  'cleanup',
  'moving',
  'outgrown',
  'other',
]
const ACQUIRED: { id: AcquiredAge; label: string }[] = [
  { id: 'within12m', label: '1년 안에 샀어요' },
  { id: 'over12m', label: '1년보다 오래됐어요' },
]

export function ItemContext({ item }: { item: Item }) {
  const update = useItems((st) => st.update)
  const [open, setOpen] = useState(false)

  const answered =
    item.idleBefore != null ||
    item.trigger != null ||
    item.acquiredAge != null

  // 세 줄 다 채웠으면 더 물을 것이 없습니다
  const complete =
    item.idleBefore != null && item.trigger != null && item.acquiredAge != null

  if (item.contextDismissed && !answered) return null

  function dismiss() {
    update(item.id, { contextDismissed: true })
    analytics.itemContextSkipped(item.route)
  }

  /* ── 접힌 상태 ── */
  if (!open) {
    return (
      <div className={s.box}>
        <button type="button" className={s.opener} onClick={() => setOpen(true)}>
          <span className={s.q}>
            {complete
              ? '알려주신 내용 보기'
              : answered
                ? '조금 더 알려주기'
                : '이 물건, 얼마나 두셨어요?'}
          </span>
          <span className={s.tag}>{complete ? '완료' : '선택'}</span>
        </button>
        {!answered && (
          <button type="button" className={s.close} onClick={dismiss} aria-label="묻지 않기">
            ×
          </button>
        )}
      </div>
    )
  }

  /* ── 펼친 상태 ── */
  return (
    <div className={s.box}>
      <div className={s.head}>
        <span className={s.q}>이 물건에 대해 조금만 더</span>
        <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="접기">
          ×
        </button>
      </div>
      <p className={s.note}>
        세 줄 다 건너뛰어도 됩니다. 방치 기간이 실제로 얼마나 되는지 알아야
        “버리는 법을 몰라서”가 사실인지 확인할 수 있습니다.
      </p>

      <Row label="얼마나 두셨나요?">
        {IDLE_ORDER.map((k) => (
          <Chip
            key={k}
            on={item.idleBefore === k}
            onClick={() => {
              update(item.id, { idleBefore: k })
              analytics.itemContext({ field: 'idle_before', value: k, route: item.route })
            }}
          >
            {IDLE_BEFORE_LABEL[k]}
          </Chip>
        ))}
      </Row>

      <Row label="왜 지금 버리시나요?">
        {TRIGGER_ORDER.map((k) => (
          <Chip
            key={k}
            on={item.trigger === k}
            onClick={() => {
              update(item.id, { trigger: k })
              analytics.itemContext({ field: 'trigger', value: k, route: item.route })
            }}
          >
            {TRIGGER_LABEL[k]}
          </Chip>
        ))}
      </Row>

      <Row label="언제 산 물건인가요?">
        {ACQUIRED.map((a) => (
          <Chip
            key={a.id}
            on={item.acquiredAge === a.id}
            onClick={() => {
              update(item.id, { acquiredAge: a.id })
              analytics.itemContext({ field: 'acquired_age', value: a.id, route: item.route })
            }}
          >
            {a.label}
          </Chip>
        ))}
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <div className={s.chips}>{children}</div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" className={s.chip} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}
