import { useState } from 'react'
import {
  DEFAULT_REGION_ID,
  REGION_OPTIONS,
  findRegionOption,
} from '../data/regions'
import { SEGMENT_LABEL, useProfile, type Segment } from '../store/profile'
import { readGroupFromUrl } from '../lib/experiment'
import s from './OnboardingScreen.module.css'

/**
 * 첫 실행 화면.
 *
 * 지역을 받는 이유는 인사말을 만들기 위해서가 아니라
 * **요금표·전화번호·신고 경로가 자치구마다 다르기 때문**입니다.
 * 그래서 건너뛸 수 없게 두었습니다.
 */
export function OnboardingScreen() {
  const complete = useProfile((st) => st.completeOnboarding)

  const [nickname, setNickname] = useState('')
  const [regionId, setRegionId] = useState(DEFAULT_REGION_ID)
  const [dong, setDong] = useState('')
  const [segment, setSegment] = useState<Segment>('')

  const picked = findRegionOption(regionId)
  const canStart = nickname.trim().length > 0

  return (
    <div className={s.wrap}>
      <span className={s.mark}>비</span>

      <h1 className={s.title}>
        버리는 법을 몰라서,
        <br />
        아직 집에 있습니다
      </h1>
      <p className={s.lead}>
        사진 한 장이면 어떻게 내보내야 하는지 알려드립니다. 시작하기 전에 두
        가지만 알려주세요.
      </p>

      <div className={s.field}>
        <label className={s.label} htmlFor="nickname">
          어떻게 부를까요?
        </label>
        <input
          id="nickname"
          className={s.input}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="예: 수현"
          maxLength={20}
          autoComplete="nickname"
        />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="region">
          사는 지역{' '}
          <span className={s.hint}>· 배출 규정과 수수료의 기준이 됩니다</span>
        </label>
        <select
          id="region"
          className={s.select}
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
        >
          {REGION_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.supported ? '' : ' (요금표 준비 중)'}
            </option>
          ))}
        </select>

        {picked.fees ? (
          <p className={`${s.notice} ${s.noticeOk}`}>
            <b>{picked.name}</b> 요금표{' '}
            <b className="tnum">{picked.fees.source.rowCount}개 품목</b>을 갖추고
            있습니다. 품목별 정확한 수수료를 안내해 드립니다.
            <br />
            <span className={s.hint}>
              구청 고시 기준 · 확인일 {picked.fees.source.checkedOn}
            </span>
          </p>
        ) : (
          <p className={`${s.notice} ${s.noticeWarn}`}>
            <b>{picked.name}</b>의 요금표는 아직 수집하지 못했습니다. 처리 경로
            판별과 재사용·무상수거 안내는 그대로 되지만,{' '}
            <b>대형폐기물 수수료는 금액 대신 구청 문의로 안내</b>됩니다.
            <br />
            <span className={s.hint}>
              지자체마다 요금과 신고 경로가 달라 임의로 대체하지 않습니다.
            </span>
          </p>
        )}
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="dong">
          동 <span className={s.hint}>· 선택. 수거함 안내에 쓰입니다</span>
        </label>
        <input
          id="dong"
          className={s.input}
          value={dong}
          onChange={(e) => setDong(e.target.value)}
          placeholder="예: 신촌동"
          maxLength={20}
        />
      </div>

      {/* 세그먼트별 전환율(K6) 측정용. 선택 입력입니다 —
          필수로 만들면 온보딩 이탈이 늘어납니다. */}
      <div className={s.field}>
        <label className={s.label} htmlFor="segment">
          지금 사는 형태{' '}
          <span className={s.hint}>· 선택. 서비스 개선 통계에만 씁니다</span>
        </label>
        <select
          id="segment"
          className={s.select}
          value={segment}
          onChange={(e) => setSegment(e.target.value as Segment)}
        >
          <option value="">답하지 않음</option>
          <option value="solo_new">{SEGMENT_LABEL.solo_new}</option>
          <option value="solo_veteran">{SEGMENT_LABEL.solo_veteran}</option>
          <option value="family">{SEGMENT_LABEL.family}</option>
        </select>
      </div>

      <div className={s.spacer} />

      <button
        type="button"
        className={s.cta}
        disabled={!canStart}
        onClick={() =>
          complete({
            nickname: nickname.trim(),
            regionId,
            dong: dong.trim(),
            // 참가군은 초대 링크(?g=A / ?g=B)로만 배정됩니다 —
            // 사용자가 자기 그룹을 알면 §6-4 의 A/B 비교가 무의미해집니다
            experimentGroup: readGroupFromUrl(),
            segment,
          })
        }
      >
        시작하기
      </button>
      <p className={s.foot}>
        가입 없이 바로 시작합니다. 나중에 설정에서 계정을 만들면 다른 기기에서도
        이어서 쓸 수 있습니다.
      </p>
    </div>
  )
}
