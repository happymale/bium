import { useNavigate, useParams } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { DESTINATION } from '../data/region'
import { ACTION_LINKS } from '../data/actionLinks'
import { NATIONWIDE, useActiveRegion } from '../lib/activeRegion'
import { useItems } from '../store/items'
import { formatWon, lookupFee } from '../lib/fees'
import { analytics } from '../lib/analytics'
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

/** 근거 문장 — AI 가 근거를 주지 않았을 때 요금표에서 생성합니다. */
function basisText(item: Item, regionName: string, supported: boolean): string {
  if (item.basis) return item.basis
  const hit = supported ? lookupFee(item.feeMatchedName ?? item.name) : null

  if (item.route === 'free') {
    return `모터·전기부품이 있는 폐가전입니다. 원형이 보전된 폐가전은 대형폐기물이 아니라 폐가전 무상방문수거로 처리하므로 수수료가 들지 않습니다.`
  }
  if (item.route === 'drop') {
    return `유해물질이 들어 있어 일반 배출이 불가능합니다. 전용 수거함으로만 배출할 수 있으며 비용은 들지 않습니다.`
  }
  if (item.route === 'reuse') {
    const cf = hit ? `대형폐기물로 신고하면 ${formatWon(hit.minFee)}이 들지만, ` : ''
    return `${cf}상태가 양호해 아직 쓸 수 있는 물건입니다. 기부·재사용 경로로 보내면 수거 비용 없이 다음 사용자에게 갑니다.`
  }
  if (!supported) {
    return `부피가 큰 비전자 폐기물이라 대형폐기물 신고 대상입니다. 다만 ${regionName} 요금표는 아직 확보하지 못해 정확한 수수료를 안내할 수 없습니다. 구청에 문의해 주세요.`
  }
  const spec = item.feeSpec ? ` · 규격 “${item.feeSpec}”` : ''
  return `${regionName} 대형폐기물 요금표의 “${item.feeMatchedName ?? item.name}”${spec} 항목에 해당합니다. 신고 후 배출 스티커 번호를 받아 부착해야 합니다.`
}

export function ResultScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const item = useItems((st) => st.items.find((i) => i.id === id))
  const setStatus = useItems((st) => st.setStatus)
  const remove = useItems((st) => st.remove)
  const regionOpt = useActiveRegion()
  const fees = regionOpt.fees ?? null
  const action = ACTION_LINKS[item?.route ?? 'free']

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
  const cf = regionOpt.supported
    ? lookupFee(item.feeMatchedName ?? item.name)
    : null
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
        {basisText(item, regionOpt.name, regionOpt.supported)}
        <span className={s.stamp}>
          {fees
            ? `근거: ${regionOpt.name} 대형폐기물 요금표 · 규정 확인일 ${fees.source.checkedOn}`
            : `${regionOpt.name} 요금표 미확보 · 금액은 구청 확인이 필요합니다`}
        </span>
      </div>

      <div className={s.warn}>
        <span className={s.warnMark}>✕</span>
        <div>
          <b>종량제봉투에 넣으면 안 됩니다.</b> 소각 시 유해물질이 나오고, 안에
          든 금속·플라스틱도 회수되지 않습니다.
        </div>
      </div>

      {/* 상태에 따라 다음 할 일이 달라집니다: 대기 → 예약/신청 → 배출 완료 */}
      {item.status === 'done' ? (
        <div className={s.doneBox}>
          <b>처리 완료</b>
          <br />
          {item.destination}
        </div>
      ) : item.status === 'requested' ? (
        <>
          <div className={s.doneBox}>
            <b>{item.route === 'bulk' ? '신고 접수됨' : '예약 완료'}</b>
            <br />
            {item.destination}
          </div>
          <button
            type="button"
            className={s.cta}
            onClick={() => {
              setStatus(item.id, 'done', DESTINATION[item.route].completed)
              analytics.itemDisposed(item.route)
              navigate('/report')
            }}
          >
            배출 완료 표시하기
          </button>
        </>
      ) : item.route === 'bulk' && fees ? (
        <>
          {/* 실제로 신고가 이루어지는 곳 */}
          <a
            className={`${s.cta} ${s.linkBtn}`}
            href={fees.reportUrl}
            target="_blank"
            rel="noreferrer"
          >
            {regionOpt.name}에 직접 신고하기 ↗
          </a>
          <p className={s.alt}>
            신고와 결제는 구청 시스템에서 이루어집니다. 배출 스티커 번호를 받아
            부착하세요.
          </p>
          {/* 개념 시연 — 실제 대행은 지자체 협약이 필요합니다 */}
          <button
            type="button"
            className={`${s.cta} ${s.ghost}`}
            onClick={() => navigate(`/request/${item.id}`)}
          >
            신청 대행이 어떻게 되는지 보기 (시연)
          </button>
          <button
            type="button"
            className={`${s.cta} ${s.ghost}`}
            onClick={() =>
              setStatus(item.id, 'requested', DESTINATION[item.route].reserved)
            }
          >
            신고했어요
          </button>
        </>
      ) : item.route === 'bulk' ? (
        // 요금표가 없는 지역은 대행 신청을 걸 수 없습니다 —
        // 얼마를 결제할지 모르는 채로 승인 화면을 띄우면 안 됩니다.
        <div className={s.doneBox}>
          <b>{regionOpt.name}는 아직 요금표가 없습니다.</b>
          <br />
          처리 경로는 대형폐기물이 맞지만, 정확한 수수료는 구청에서 확인해
          주세요. 요금표가 확보되면 신청 대행이 열립니다.
        </div>
      ) : (
        <>
          {/* 우리가 대신 신청해 주는 게 아니라, 실제 창구로 보냅니다 */}
          <a
            className={`${s.cta} ${s.linkBtn}`}
            href={action.url(regionOpt)}
            target="_blank"
            rel="noreferrer"
          >
            {action.goLabel} ↗
          </a>
          <p className={s.alt}>{action.note}</p>
          {action.phone && (
            <a
              className={`${s.cta} ${s.ghost} ${s.linkBtn}`}
              href={`tel:${action.phone.replace(/-/g, '')}`}
            >
              전화로 예약 · {action.phone}
            </a>
          )}
          <button
            type="button"
            className={`${s.cta} ${s.ghost}`}
            onClick={() => {
              if (action.hasReservation) {
                setStatus(item.id, 'requested', DESTINATION[item.route].reserved)
                analytics.requestApproved(item.route, 0)
              } else {
                // 수거함은 예약 단계가 없습니다 — 넣고 오면 그걸로 끝입니다
                setStatus(item.id, 'done', DESTINATION[item.route].completed)
                analytics.itemDisposed(item.route)
                navigate('/report')
              }
            }}
          >
            {action.doneLabel}
          </button>
        </>
      )}

      {fees ? (
        <a
          className={`${s.cta} ${s.ghost} ${s.linkBtn}`}
          href={`tel:${fees.phone.replace(/-/g, '')}`}
        >
          확실하지 않아요 · 구청에 물어보기
        </a>
      ) : (
        <a
          className={`${s.cta} ${s.ghost} ${s.linkBtn}`}
          href={`https://www.google.com/search?q=${encodeURIComponent(regionOpt.name + ' 대형폐기물 신고')}`}
          target="_blank"
          rel="noreferrer"
        >
          {regionOpt.name} 대형폐기물 신고처 찾기
        </a>
      )}

      <button
        type="button"
        className={s.remove}
        onClick={() => {
          if (confirm(`"${item.name}"을(를) 목록에서 지울까요?`)) {
            remove(item.id)
            navigate('/list')
          }
        }}
      >
        목록에서 삭제
      </button>

      {showCounterfactual && (
        <p className={s.alt}>
          대형폐기물로 신고했다면 <b>{formatWon(cf.minFee)}</b>을 냈을
          물건입니다
        </p>
      )}
      {item.route === 'bulk' && fees && (
        <p className={s.alt}>
          {regionOpt.name}청 신고 문의 <b>{fees.phone}</b>
        </p>
      )}
      {/* 폐가전 무상방문수거는 전국 공통이라 지역과 무관하게 안내할 수 있습니다 */}
      {item.route === 'free' && (
        <p className={s.alt}>
          {NATIONWIDE.operator} <b>{NATIONWIDE.phone}</b>
        </p>
      )}
    </Screen>
  )
}
