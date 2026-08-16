import { useNavigate, useParams } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { CURRENT_REGION } from '../data/region'
import { useItems } from '../store/items'
import { formatWon, lookupFee } from '../lib/fees'
import type { Item } from '../types'
import s from './ResultScreen.module.css'

const HEADLINE: Record<string, string> = {
  free: '이건 무료로\n가져가 줍니다',
  reuse: '아직 쓸 수 있는\n물건입니다',
  bulk: '신고하고\n배출해야 합니다',
  drop: '전용 수거함에\n넣어주세요',
}

const EMOJI: Record<string, string> = {
  reuse: '🟢',
  free: '🔵',
  bulk: '🟠',
  drop: '🔴',
}

function costLine(item: Item): { text: string; paid: boolean } {
  switch (item.route) {
    case 'bulk':
      return { text: `${formatWon(item.fee)} · 스티커 번호 부착`, paid: true }
    case 'reuse':
      return { text: '0원 · 방문 픽업', paid: false }
    case 'drop':
      return { text: '0원 · 직접 투입', paid: false }
    default:
      return { text: '0원 · 문 앞 배출', paid: false }
  }
}

/** 근거 문장 — AI 판별(4단계) 전까지는 요금표에서 생성합니다. */
function basisText(item: Item): string {
  if (item.basis) return item.basis
  const hit = lookupFee(item.feeMatchedName ?? item.name)

  if (item.route === 'free') {
    return `모터·전기부품이 있는 폐가전입니다. ${CURRENT_REGION.name}는 원형이 보전된 폐가전을 대형폐기물이 아니라 무상방문수거로 처리하기 때문에 요금표에도 0원으로 고시돼 있습니다.`
  }
  if (item.route === 'drop') {
    return `유해물질이 들어 있어 일반 배출이 불가능합니다. 전용 수거함으로만 배출할 수 있으며 비용은 들지 않습니다.`
  }
  if (item.route === 'reuse') {
    const cf = hit ? `대형폐기물로 신고하면 ${formatWon(hit.minFee)}이 들지만, ` : ''
    return `${cf}상태가 양호해 아직 쓸 수 있는 물건입니다. 기부·재사용 경로로 보내면 수거 비용 없이 다음 사용자에게 갑니다.`
  }
  const spec = item.feeSpec ? ` · 규격 “${item.feeSpec}”` : ''
  return `${CURRENT_REGION.name} 대형폐기물 요금표의 “${item.feeMatchedName ?? item.name}”${spec} 항목에 해당합니다. 신고 후 배출 스티커 번호를 받아 부착해야 합니다.`
}

export function ResultScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const item = useItems((st) => st.items.find((i) => i.id === id))

  if (!item) {
    return (
      <Screen title="판별 결과" back>
        <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '48px 0' }}>
          물건을 찾을 수 없습니다.
        </p>
      </Screen>
    )
  }

  const kind = ROUTE_BY_ID[item.route]
  const cost = costLine(item)
  const cf = lookupFee(item.feeMatchedName ?? item.name)
  const showCounterfactual = item.route !== 'bulk' && cf && cf.minFee > 0

  return (
    <Screen title="판별 결과" back>
      <div className={s.photo}>
        {item.photo ? (
          <img src={item.photo} alt={item.name} />
        ) : (
          <svg
            width="96"
            height="128"
            viewBox="0 0 96 128"
            fill="none"
            stroke="#8d938f"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <rect x="20" y="30" width="56" height="82" rx="10" />
            <rect x="32" y="14" width="32" height="18" rx="6" />
            <path d="M44 6c0 4 8 4 8 8" strokeLinecap="round" />
            <line x1="32" y1="54" x2="64" y2="54" />
            <circle cx="48" cy="80" r="12" />
          </svg>
        )}
        <div className={s.bbox} style={{ borderColor: kind.color }}>
          <span style={{ background: kind.color }}>
            {item.name} · {kind.label}
          </span>
        </div>
        {item.confidence != null && (
          <div className={s.conf}>확신도 {Math.round(item.confidence * 100)}%</div>
        )}
      </div>

      <div className={s.verdict}>
        <span className={s.kind} style={{ background: kind.color }}>
          {EMOJI[item.route]} {kind.label}
        </span>
        <h2 style={{ whiteSpace: 'pre-line' }}>{HEADLINE[item.route]}</h2>
        <div className={`${s.cost} ${cost.paid ? s.costPaid : ''}`}>
          {cost.text}
        </div>
      </div>

      <div className={s.basis}>
        {basisText(item)}
        <span className={s.stamp}>
          근거: {CURRENT_REGION.name} 대형폐기물 요금표 · 규정 확인일{' '}
          {CURRENT_REGION.bulk.checkedOn}
        </span>
      </div>

      <div className={s.warn}>
        <span className={s.warnMark}>✕</span>
        <div>
          <b>종량제봉투에 넣으면 안 됩니다.</b> 소각 시 유해물질이 나오고, 안에
          든 금속·플라스틱도 회수되지 않습니다.
        </div>
      </div>

      {item.route === 'bulk' ? (
        <button
          type="button"
          className={s.cta}
          onClick={() => navigate(`/request/${item.id}`)}
        >
          신청 대행 맡기기
        </button>
      ) : (
        <button type="button" className={s.cta}>
          {item.route === 'free'
            ? '무상수거 예약하기'
            : item.route === 'reuse'
              ? '기부 픽업 예약하기'
              : '가까운 수거함 찾기'}
        </button>
      )}
      <button type="button" className={`${s.cta} ${s.ghost}`}>
        확실하지 않아요 · 구청에 물어보기
      </button>

      {showCounterfactual && (
        <p className={s.alt}>
          대형폐기물로 신고했다면 <b>{formatWon(cf.minFee)}</b>을 냈을
          물건입니다
        </p>
      )}
      {item.route === 'bulk' && (
        <p className={s.alt}>
          {CURRENT_REGION.name}청 신고 문의 <b>{CURRENT_REGION.bulk.phone}</b>
        </p>
      )}
      {item.route === 'free' && (
        <p className={s.alt}>
          {CURRENT_REGION.freePickup.operator}{' '}
          <b>{CURRENT_REGION.freePickup.phone}</b>
        </p>
      )}
    </Screen>
  )
}
