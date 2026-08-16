import { useEffect, useState } from 'react'
import { Screen } from '../components/Screen'
import { CONFIDENCE_THRESHOLD, MODEL_LABEL } from '../lib/classify'
import { CURRENT_REGION, PERSONA } from '../data/region'
import { SDM_FEE_SOURCE } from '../data/sdmBulkFees'
import { useItems } from '../store/items'
import { useSettings } from '../store/settings'
import { useTheme } from '../store/theme'
import s from './SettingsScreen.module.css'

export function SettingsScreen() {
  const theme = useTheme((st) => st.theme)
  const toggle = useTheme((st) => st.toggle)
  const items = useItems((st) => st.items)
  const resetToSeed = useItems((st) => st.resetToSeed)
  const demoMode = useSettings((st) => st.demoMode)
  const setDemoMode = useSettings((st) => st.setDemoMode)

  // API 키가 서버에 있는지 — 키 값 자체는 절대 내려오지 않고 있음/없음만 받습니다
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((j) => setHasKey(Boolean(j.hasApiKey)))
      .catch(() => setHasKey(false))
  }, [])

  return (
    <Screen title="설정">
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

      <h2 className={s.groupTitle}>지역 · 배출 규정</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>우리 동네</div>
            <div className={s.rowSub}>배출 규정과 수수료의 기준이 됩니다</div>
          </div>
          <span className={s.rowValue}>{PERSONA.label}</span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>대형폐기물 요금표</div>
            <div className={s.rowSub}>
              {CURRENT_REGION.name}청 고시 ·{' '}
              <span className="tnum">{SDM_FEE_SOURCE.rowCount}</span>개 품목
            </div>
          </div>
          <span className={`${s.rowValue} tnum`}>
            확인 {CURRENT_REGION.bulk.checkedOn}
          </span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>폐가전 무상방문수거</div>
            <div className={s.rowSub}>{CURRENT_REGION.freePickup.operator}</div>
          </div>
          <span className={`${s.rowValue} tnum`}>
            {CURRENT_REGION.freePickup.phone}
          </span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>대형폐기물 신고 문의</div>
            <div className={s.rowSub}>{CURRENT_REGION.name}청 청소행정과</div>
          </div>
          <span className={`${s.rowValue} tnum`}>
            {CURRENT_REGION.bulk.phone}
          </span>
        </div>
      </div>

      <h2 className={s.groupTitle}>데이터</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>비움 목록 초기화</div>
            <div className={s.rowSub}>
              저장된 물건 <span className="tnum">{items.length}</span>개를 지우고
              시연용 기본값으로 되돌립니다
            </div>
          </div>
          <button type="button" className={s.reset} onClick={resetToSeed}>
            초기화
          </button>
        </div>
      </div>

      <h2 className={s.groupTitle}>AI 판별</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>판별 모드</div>
            <div className={s.rowSub}>
              {hasKey == null
                ? '확인 중…'
                : hasKey
                  ? `${MODEL_LABEL} · 실제 사진을 판별합니다`
                  : '.env.local 에 API 키를 넣으면 실제 판별로 전환됩니다'}
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

      <p className={s.foot}>
        비움 BIUM · 버리는 법을 몰라서, 아직 집에 있습니다
        <br />
        「신인류 AI 사피엔스 경험디자인」 기말 팀프로젝트
      </p>
    </Screen>
  )
}
