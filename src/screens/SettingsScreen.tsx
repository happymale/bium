import { useEffect, useState } from 'react'
import { Screen, Stub } from '../components/Screen'
import { AccountSection } from '../components/AccountSection'
import { REGION_OPTIONS } from '../data/regions'
import { CONFIDENCE_THRESHOLD, modelLabel } from '../lib/classify'
import { NATIONWIDE, useActiveRegion } from '../lib/activeRegion'
import { supabaseEnabled } from '../lib/supabase'
import { useItems } from '../store/items'
import { SEGMENT_LABEL, useProfile } from '../store/profile'
import { useSettings } from '../store/settings'
import { useTheme } from '../store/theme'
import s from './SettingsScreen.module.css'

export function SettingsScreen() {
  const theme = useTheme((st) => st.theme)
  const toggle = useTheme((st) => st.toggle)
  const items = useItems((st) => st.items)
  const loadDemoData = useItems((st) => st.loadDemoData)
  const clearDemoData = useItems((st) => st.clearDemoData)
  const clearAll = useItems((st) => st.clearAll)
  const demoMode = useSettings((st) => st.demoMode)
  const setDemoMode = useSettings((st) => st.setDemoMode)
  const demoData = useSettings((st) => st.demoData)
  const setDemoData = useSettings((st) => st.setDemoData)

  const { nickname, dong, regionId, segment } = useProfile()
  const setProfile = useProfile((st) => st.setProfile)
  const regionOpt = useActiveRegion()
  const fees = regionOpt.fees

  // API 키가 서버에 있는지 — 키 값 자체는 절대 내려오지 않고 있음/없음만 받습니다
  // 키 값 자체는 내려오지 않고 있음/없음과 모델 이름만 받습니다
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [serverModel, setServerModel] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((j) => {
        setHasKey(Boolean(j.hasApiKey))
        setServerModel(typeof j.model === 'string' ? j.model : null)
      })
      .catch(() => setHasKey(false))
  }, [])

  return (
    <Screen title="설정">
      {/* ── 프로필 ── */}
      <h2 className={s.groupTitle}>내 정보</h2>
      <div className={s.group}>
        <label className={s.stack}>
          <span className={s.rowLabel}>이름</span>
          <input
            className={s.input}
            value={nickname}
            maxLength={20}
            onChange={(e) => setProfile({ nickname: e.target.value })}
          />
        </label>

        <label className={s.stack}>
          <span className={s.rowLabel}>사는 지역</span>
          <span className={s.rowSub}>
            배출 규정·수수료·문의처가 이 값을 따릅니다
          </span>
          <select
            className={s.select}
            value={regionId}
            onChange={(e) => setProfile({ regionId: e.target.value })}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {!regionOpt.supported && (
            <p className={`${s.msg} ${s.msgErr}`}>
              {regionOpt.name} 요금표는 아직 없습니다. 처리 경로는 판별되지만
              대형폐기물 <b>수수료는 금액 대신 구청 문의로 안내</b>됩니다.
            </p>
          )}
        </label>

        <label className={s.stack}>
          <span className={s.rowLabel}>사는 형태</span>
          <span className={s.rowSub}>
            서비스 개선 통계에만 씁니다. 답하지 않아도 됩니다.
          </span>
          <select
            className={s.select}
            value={segment}
            onChange={(e) =>
              setProfile({ segment: e.target.value as typeof segment })
            }
          >
            <option value="">답하지 않음</option>
            <option value="solo_new">{SEGMENT_LABEL.solo_new}</option>
            <option value="solo_veteran">{SEGMENT_LABEL.solo_veteran}</option>
            <option value="family">{SEGMENT_LABEL.family}</option>
          </select>
        </label>

        <label className={s.stack}>
          <span className={s.rowLabel}>동</span>
          <input
            className={s.input}
            value={dong}
            maxLength={20}
            placeholder="예: 신촌동"
            onChange={(e) => setProfile({ dong: e.target.value })}
          />
        </label>
      </div>

      {/* ── 계정 ── */}
      <AccountSection />

      {/* ── 배출 규정 ── */}
      <h2 className={s.groupTitle}>배출 규정</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>대형폐기물 요금표</div>
            <div className={s.rowSub}>
              {fees
                ? `${fees.source.authority} · ${fees.source.rowCount}개 규격${
                    fees.source.effectiveOn ? ` · 시행 ${fees.source.effectiveOn}` : ''
                  }`
                : `${regionOpt.name} 요금표 미확보`}
            </div>
          </div>
          <span className={`${s.rowValue} tnum`}>
            {fees ? `확인 ${fees.source.checkedOn}` : '준비 중'}
          </span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>폐가전 무상방문수거</div>
            <div className={s.rowSub}>{NATIONWIDE.operator} · 전국 공통</div>
          </div>
          <span className={`${s.rowValue} tnum`}>{NATIONWIDE.phone}</span>
        </div>
        {fees && (
          <div className={s.row}>
            <div>
              <div className={s.rowLabel}>대형폐기물 신고 문의</div>
              <div className={s.rowSub}>{fees.source.authority}</div>
            </div>
            <span className={`${s.rowValue} tnum`}>{fees.phone}</span>
          </div>
        )}
      </div>

      {/* ── AI 판별 ── */}
      <h2 className={s.groupTitle}>AI 판별</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>판별 모드</div>
            <div className={s.rowSub}>
              {hasKey == null
                ? '확인 중…'
                : hasKey
                  ? `${modelLabel(serverModel)} · 실제 사진을 판별합니다`
                  : 'API 키가 없습니다. 로컬은 .env.local, 배포본은 호스팅 환경변수에 넣어주세요'}
            </div>
          </div>
          <span className={s.rowValue}>
            {hasKey == null ? '—' : hasKey ? '실제 AI' : '데모'}
          </span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>데모 모드</div>
            <div className={s.rowSub}>
              켜면 API 를 호출하지 않고 준비된 예시로 시연합니다. 비용이 들지
              않고 네트워크가 끊겨도 동작합니다.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={demoMode}
            aria-label="데모 모드"
            className={s.switch}
            onClick={() => setDemoMode(!demoMode)}
          >
            <span className={s.knob} />
          </button>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>확신도 기준</div>
            <div className={s.rowSub}>
              이 아래면 결과를 확정하지 않고 구청 문의로 안내합니다
            </div>
          </div>
          <span className={`${s.rowValue} tnum`}>
            {Math.round(CONFIDENCE_THRESHOLD * 100)}%
          </span>
        </div>
      </div>

      {/* ── 화면 ── */}
      <h2 className={s.groupTitle}>화면</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>다크모드</div>
            <div className={s.rowSub}>
              끄면 시스템 설정과 무관하게 라이트로 고정됩니다
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="다크모드"
            className={s.switch}
            onClick={toggle}
          >
            <span className={s.knob} />
          </button>
        </div>
      </div>

      {/* ── 데이터 ── */}
      <h2 className={s.groupTitle}>데이터</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>저장 위치</div>
            <div className={s.rowSub}>
              {supabaseEnabled
                ? '클라우드에 저장되어 다른 기기에서도 이어집니다'
                : '이 기기에만 저장됩니다. 브라우저 데이터를 지우면 사라집니다'}
            </div>
          </div>
          <span className={s.rowValue}>
            {supabaseEnabled ? '클라우드 동기화' : '기기 전용'}
          </span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>시연용 예시 데이터</div>
            <div className={s.rowSub}>
              발표·시연을 위해 예시 물건 13개(처리 완료 6건 포함)를 넣습니다.
              끄면 예시만 사라지고 직접 등록한 물건은 남습니다.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={demoData}
            aria-label="시연용 예시 데이터"
            className={s.switch}
            onClick={() => {
              const next = !demoData
              setDemoData(next)
              if (next) loadDemoData()
              else clearDemoData()
            }}
          >
            <span className={s.knob} />
          </button>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>목록 전체 비우기</div>
            <div className={s.rowSub}>
              저장된 물건 <span className="tnum">{items.length}</span>개를 모두
              지웁니다. 되돌릴 수 없습니다.
            </div>
          </div>
          <button
            type="button"
            className={s.reset}
            onClick={() => {
              if (confirm('물건을 모두 지울까요? 되돌릴 수 없습니다.')) {
                clearAll()
                setDemoData(false)
              }
            }}
          >
            비우기
          </button>
        </div>
      </div>

      <Stub step="다음">전용 수거함 실제 위치 데이터 · 자치구 요금표 자동 갱신</Stub>

      <p className={s.foot}>
        비움 BIUM · 버리는 법을 몰라서, 아직 집에 있습니다
        <br />
        「신인류 AI 사피엔스 경험디자인」 기말 팀프로젝트
      </p>
    </Screen>
  )
}
