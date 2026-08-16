import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Screen } from '../components/Screen'
import { ROUTE_BY_ID } from '../data/routeKinds'
import { CURRENT_REGION } from '../data/region'
import { useItems } from '../store/items'
import { useSettings } from '../store/settings'
import {
  CONFIDENCE_THRESHOLD,
  classifyImage,
  type ClassifyOutcome,
} from '../lib/classify'
import { prepareImage, type PreparedImage } from '../lib/image'
import { formatWon } from '../lib/fees'
import { analytics, confidenceBucket } from '../lib/analytics'
import { supabaseEnabled } from '../lib/supabase'
import { uploadPhoto } from '../lib/sync'
import s from './CaptureScreen.module.css'

type Phase = 'idle' | 'working' | 'done' | 'error'

export function CaptureScreen() {
  const navigate = useNavigate()
  const addItem = useItems((st) => st.add)
  const updateItem = useItems((st) => st.update)
  const demoMode = useSettings((st) => st.demoMode)

  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [outcome, setOutcome] = useState<ClassifyOutcome | null>(null)
  const [error, setError] = useState<string>('')

  async function onPick(file: File | undefined, source: 'camera' | 'album') {
    if (!file) return
    setError('')
    setOutcome(null)
    setPhase('working')
    analytics.classifyStart(source)
    try {
      const prepared = await prepareImage(file)
      setImage(prepared)
      const result = await classifyImage(prepared, { forceMock: demoMode })
      setOutcome(result)
      setPhase('done')

      const c = result.classification
      const bucket = confidenceBucket(c.confidence)
      analytics.classifyDone({
        route: result.draft.route,
        confidenceBucket: bucket,
        uncertain: result.uncertain,
        aiSource: c.source,
        elapsedMs: c.elapsedMs ?? 0,
      })
      if (result.uncertain) analytics.lowConfidenceBlocked(bucket)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '판별에 실패했습니다.'
      setError(message)
      setPhase('error')
      analytics.classifyError(message.slice(0, 60))
    }
  }

  function reset() {
    setPhase('idle')
    setImage(null)
    setOutcome(null)
    setError('')
  }

  function save() {
    if (!outcome) return
    analytics.itemAdded(outcome.draft.route, outcome.uncertain)
    const id = addItem(outcome.draft)
    navigate(`/result/${id}`)

    // 원본 사진은 서버에 따로 올립니다 (로컬엔 320px 썸네일만 둡니다).
    // 화면 전환을 막지 않도록 뒤에서 처리하고, 실패해도 무시합니다.
    if (supabaseEnabled && image) {
      void uploadPhoto(image.dataUrl).then((path) => {
        if (path) updateItem(id, { photoPath: path })
      })
    }
  }

  const kind = outcome ? ROUTE_BY_ID[outcome.draft.route] : null
  const pct = outcome ? Math.round(outcome.classification.confidence * 100) : 0

  return (
    <Screen title="사진으로 판별" back>
      {phase === 'idle' && (
        <p className={s.intro}>
          버리려는 물건을 <b>한 개만</b> 프레임에 담아 찍어주세요. 상표나
          라벨이 보이면 판별이 정확해집니다.
        </p>
      )}

      <div className={s.preview}>
        {image ? (
          <img src={image.dataUrl} alt="촬영한 물건" />
        ) : (
          <p className={s.placeholder}>
            아직 사진이 없습니다.
            <br />
            촬영하거나 앨범에서 골라주세요.
          </p>
        )}
        {phase === 'working' && (
          <div className={s.spinner}>
            <span className={s.dot} />
            재질과 부착물을 보는 중…
          </div>
        )}
      </div>

      {phase === 'error' && (
        <div className={`${s.alert} ${s.alertError}`}>
          <div>
            <b>판별하지 못했습니다.</b>
            <br />
            {error}
          </div>
        </div>
      )}

      {phase === 'done' && outcome && kind && (
        <>
          {outcome.classification.source === 'mock' && (
            <div className={`${s.alert} ${s.alertWarn}`}>
              <div>
                {outcome.classification.reason === 'demo-mode' ? (
                  <>
                    <b>데모 모드입니다.</b> 실제 사진을 판별하지 않고 준비된
                    예시를 보여주고 있습니다. 설정에서 데모 모드를 끄면 실제
                    판별로 전환됩니다.
                  </>
                ) : (
                  <>
                    <b>API 키가 없습니다.</b> 미리 준비된 예시 응답을 보여주고
                    있습니다. <code>.env.local</code>에 키를 넣으면 실제 사진을
                    판별합니다.
                  </>
                )}
              </div>
            </div>
          )}

          {outcome.uncertain && (
            <div className={`${s.alert} ${s.alertWarn}`}>
              <div>
                <b>확신이 부족합니다 ({pct}%).</b> 기준({
                  Math.round(CONFIDENCE_THRESHOLD * 100)
                }%)에 못 미쳐 이 결과를 확정하지 않았습니다. 잘못 배출하면
                과태료가 나올 수 있으니 구청에 확인하거나 다시 찍어주세요.
              </div>
            </div>
          )}

          <div className={s.card}>
            <span className={s.kind} style={{ background: kind.color }}>
              {kind.label}
            </span>
            <div className={s.name}>
              {outcome.draft.name}
              {outcome.classification.source === 'ai' && (
                <span className={s.badge}>AI 판별</span>
              )}
            </div>
            <div
              className={`${s.cost} ${outcome.draft.fee > 0 ? s.costPaid : ''}`}
            >
              {outcome.draft.fee > 0
                ? `${formatWon(outcome.draft.fee)} · ${CURRENT_REGION.name} 요금표`
                : '0원'}
              {outcome.feeUnknown && ' · 요금표에 없는 품목'}
            </div>
            <p className={s.material}>{outcome.classification.material}</p>

            <div className={s.meter}>
              확신도
              <span className={s.track}>
                <span
                  className={`${s.fill} ${outcome.uncertain ? s.fillLow : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="tnum">{pct}%</span>
            </div>
          </div>

          {outcome.uncertain ? (
            <div className={s.actions}>
              <button type="button" className={`${s.btn} ${s.wide}`}>
                구청에 물어보기 · {CURRENT_REGION.bulk.phone}
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.ghost}`}
                onClick={reset}
              >
                다시 찍기
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.ghost}`}
                onClick={save}
              >
                그래도 추가
              </button>
            </div>
          ) : (
            <div className={s.actions}>
              <button
                type="button"
                className={`${s.btn} ${s.wide}`}
                onClick={save}
              >
                비움 목록에 추가
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.ghost} ${s.wide}`}
                onClick={reset}
              >
                다시 찍기
              </button>
            </div>
          )}
        </>
      )}

      {(phase === 'idle' || phase === 'error') && (
        <div className={s.actions}>
          <button
            type="button"
            className={s.btn}
            onClick={() => cameraRef.current?.click()}
          >
            촬영하기
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.ghost}`}
            onClick={() => albumRef.current?.click()}
          >
            앨범에서 고르기
          </button>
        </div>
      )}

      <input
        ref={cameraRef}
        className={s.hidden}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onPick(e.target.files?.[0], 'camera')}
      />
      <input
        ref={albumRef}
        className={s.hidden}
        type="file"
        accept="image/*"
        onChange={(e) => onPick(e.target.files?.[0], 'album')}
      />
    </Screen>
  )
}
