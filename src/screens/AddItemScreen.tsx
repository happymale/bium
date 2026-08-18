import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_KINDS, type RouteId } from '../data/routeKinds'
import { useActiveRegion } from '../lib/activeRegion'
import { formatWon, lookupFee } from '../lib/fees'
import type { FeeRow } from '../data/sdmBulkFees'
import { useItems } from '../store/items'
import s from './AddItemScreen.module.css'

/**
 * 사진 없이 직접 추가.
 *
 * 이름을 치면 우리 구 요금표에서 후보를 찾아 보여줍니다. 규격까지 고르면
 * 사진 판별과 똑같이 **실제 고시 금액**이 붙습니다.
 * 요금표에 없는 물건도 등록할 수 있습니다 — 경로만 고르면 됩니다.
 */
export function AddItemScreen() {
  const navigate = useNavigate()
  const addItem = useItems((st) => st.add)
  const regionOpt = useActiveRegion()

  const [name, setName] = useState('')
  const [picked, setPicked] = useState<FeeRow | null>(null)
  const [route, setRoute] = useState<RouteId | null>(null)

  const query = name.trim()
  const candidates = useMemo(() => {
    if (query.length < 1 || !regionOpt.fees) return []
    return lookupFee(query)?.matched.slice(0, 6) ?? []
  }, [query, regionOpt.fees])

  /** 요금표를 고르면 경로를 제안합니다 — 0원 항목은 폐가전이라 무상수거입니다 */
  function choose(row: FeeRow) {
    const same = picked?.name === row.name && picked?.spec === row.spec
    if (same) {
      setPicked(null)
      return
    }
    setPicked(row)
    if (!route || route === 'free' || route === 'bulk') {
      setRoute(row.fee === 0 ? 'free' : 'bulk')
    }
  }

  const fee = route === 'bulk' && picked ? picked.fee : 0
  const canSave = query.length > 0 && route !== null

  function save() {
    if (!route) return
    const id = addItem({
      name: query,
      route,
      fee,
      feeSpec: picked?.spec || undefined,
      feeMatchedName: picked?.name,
      // 판별을 거치지 않았으므로 K2 분모에서 빠집니다
      origin: 'manual',
    })
    navigate(`/result/${id}`)
  }

  return (
    <Screen title="직접 추가" back>
      <label className={s.label} htmlFor="itemName">
        무엇을 비우시나요?
      </label>
      <input
        id="itemName"
        className={s.input}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setPicked(null)
        }}
        placeholder="예: 3인용 소파, 폐건전지 12개"
        maxLength={40}
        autoFocus
      />

      {/* ── 요금표 후보 ── */}
      {query.length > 0 && regionOpt.fees && (
        <div className={s.section}>
          <span className={s.label}>
            {regionOpt.name} 요금표{' '}
            <span className={s.hint}>
              · 해당하는 규격을 고르면 정확한 금액이 붙습니다
            </span>
          </span>

          {candidates.length > 0 ? (
            <div className={s.candidates}>
              {candidates.map((row) => {
                const on = picked?.name === row.name && picked?.spec === row.spec
                return (
                  <button
                    key={`${row.name}|${row.spec}`}
                    type="button"
                    className={s.cand}
                    aria-pressed={on}
                    onClick={() => choose(row)}
                  >
                    <span>
                      <span className={s.candName}>{row.name}</span>
                      <span className={s.candSpec}>{row.spec || '규격 구분 없음'}</span>
                    </span>
                    <span
                      className={`${s.candFee} tnum ${row.fee === 0 ? s.free : s.paid}`}
                    >
                      {formatWon(row.fee)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className={s.none}>
              요금표에서 찾지 못했습니다. 경로만 고르셔도 등록됩니다 — 금액은
              구청 확인이 필요합니다.
            </p>
          )}
        </div>
      )}

      {query.length > 0 && !regionOpt.fees && (
        <p className={s.none}>
          {regionOpt.name}는 요금표가 아직 없습니다. 경로만 고르시면 등록되고,
          금액은 구청 문의로 안내됩니다.
        </p>
      )}

      {/* ── 경로 ── */}
      <div className={s.section}>
        <span className={s.label}>
          어떻게 내보내실 건가요?{' '}
          <span className={s.hint}>· 상태가 좋으면 재사용을 먼저 봐주세요</span>
        </span>
        <div className={s.routes}>
          {ROUTE_KINDS.map((r) => {
            const on = route === r.id
            return (
              <button
                key={r.id}
                type="button"
                className={s.route}
                aria-pressed={on}
                style={on ? { background: r.color } : undefined}
                onClick={() => setRoute(r.id)}
              >
                <span className={s.routeName}>
                  <i className={s.dot} style={{ background: r.color }} />
                  {r.label}
                </span>
                <span className={s.routeSub}>
                  {r.id === 'bulk' ? '수수료 발생' : '0원'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {canSave && (
        <p className={s.summary}>
          <b>{query}</b>
          {picked && (
            <>
              {' '}
              · 요금표 “{picked.name}
              {picked.spec ? ` / ${picked.spec}` : ''}”
            </>
          )}
          <br />
          {route === 'bulk' ? (
            picked ? (
              <>
                대형폐기물 신고 · <b className="tnum">{formatWon(fee)}</b>
              </>
            ) : (
              <>대형폐기물 신고 · 금액은 구청 확인 필요</>
            )
          ) : (
            <>
              {ROUTE_KINDS.find((r) => r.id === route)?.label} · <b>0원</b>
            </>
          )}
        </p>
      )}

      <button
        type="button"
        className={s.cta}
        disabled={!canSave}
        onClick={save}
      >
        {canSave ? '비움 목록에 추가' : '품목과 경로를 골라주세요'}
      </button>
    </Screen>
  )
}
