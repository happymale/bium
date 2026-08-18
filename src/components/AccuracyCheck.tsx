import { useState } from 'react'
import { analytics, confidenceBucket } from '../lib/analytics'
import { useItems } from '../store/items'
import type { AccuracyNote, Item } from '../types'
import { originOf } from '../types'
import s from './AccuracyCheck.module.css'

/**
 * K1 — 판별 정확도를 재기 위한 한 줄 질문.
 *
 * 제안서 §6-2 는 K1 을 "사용자 확인 기준 정답률"로 정의하고
 * *"이게 무너지면 나머지가 전부 무의미"* 라고 적었습니다. 그런데 물어보는
 * 장치가 없으면 영영 0건입니다.
 *
 * 설계 규칙 — **답은 의무가 아닙니다.**
 * - 모달이 아닙니다. 다음 단계를 막지 않습니다.
 * - 언제든 ×로 닫을 수 있고, 닫으면 같은 물건에 다시 묻지 않습니다.
 * - "무엇이 틀렸는지"는 한 번 더 선택일 뿐, 건너뛰어도 답은 이미 기록됩니다.
 *
 * 답하지 않은 것도 데이터입니다. 응답률을 함께 재야 표본을 믿을 수 있어서
 * 건너뜀도 이벤트로 남깁니다.
 */

const NOTES: { id: AccuracyNote; label: string }[] = [
  { id: 'item', label: '품목이 달라요' },
  { id: 'route', label: '버리는 방법이 달라요' },
  { id: 'fee', label: '금액이 달라요' },
  { id: 'other', label: '그 밖에' },
]

export function AccuracyCheck({ item }: { item: Item }) {
  const update = useItems((st) => st.update)
  // "아니에요" 직후에만 사유를 묻습니다. 새로고침하면 다시 묻지 않습니다.
  const [askingNote, setAskingNote] = useState(false)

  // 판별을 거치지 않은 물건에는 물을 것이 없습니다 (직접 추가 · 시연용 예시)
  if (originOf(item) !== 'ai') return null
  if (item.accuracyDismissed) return null

  const bucket =
    item.confidence != null ? confidenceBucket(item.confidence) : 'unknown'

  function answer(verdict: 'correct' | 'wrong') {
    update(item.id, { accuracy: verdict })
    analytics.classifyFeedback({ verdict, route: item.route, confidenceBucket: bucket })
    setAskingNote(verdict === 'wrong')
  }

  function pickNote(note: AccuracyNote) {
    update(item.id, { accuracyNote: note })
    analytics.classifyFeedbackNote(note, item.route)
    setAskingNote(false)
  }

  function dismiss() {
    update(item.id, { accuracyDismissed: true })
    analytics.classifyFeedbackSkipped(item.route)
  }

  /* ── 이미 답한 뒤 ── */
  if (item.accuracy && !askingNote) {
    return (
      <div className={`${s.box} ${s.thanks}`}>
        <b>알려주셔서 고맙습니다.</b>{' '}
        {item.accuracy === 'wrong' ? (
          <>
            판별을 고치는 데 씁니다. 실제로 어떻게 버려야 하는지는 아래{' '}
            <b>구청에 물어보기</b>로 확인해 주세요.
          </>
        ) : (
          <>판별 정확도를 재는 데만 씁니다.</>
        )}
      </div>
    )
  }

  /* ── 무엇이 틀렸는지 (한 번 더 선택 — 건너뛰어도 됩니다) ── */
  if (askingNote) {
    return (
      <div className={s.box}>
        <div className={s.head}>
          <span className={s.q}>무엇이 달랐나요?</span>
          <span className={s.tag}>선택</span>
        </div>
        <div className={s.chips}>
          {NOTES.map((n) => (
            <button
              key={n.id}
              type="button"
              className={s.chip}
              onClick={() => pickNote(n.id)}
            >
              {n.label}
            </button>
          ))}
        </div>
        <button type="button" className={s.skip} onClick={() => setAskingNote(false)}>
          답하지 않고 닫기
        </button>
      </div>
    )
  }

  /* ── 처음 묻는 상태 ── */
  return (
    <div className={s.box}>
      <div className={s.head}>
        <span className={s.q}>이 판별이 맞나요?</span>
        <button
          type="button"
          className={s.close}
          onClick={dismiss}
          aria-label="묻지 않기"
        >
          ×
        </button>
      </div>
      <p className={s.note}>
        답하지 않아도 됩니다. 다음 단계는 그대로 진행됩니다.
      </p>
      <div className={s.btns}>
        <button type="button" className={s.btn} onClick={() => answer('correct')}>
          맞아요
        </button>
        <button type="button" className={s.btn} onClick={() => answer('wrong')}>
          아니에요
        </button>
      </div>
    </div>
  )
}
