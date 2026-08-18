import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_REGION_ID } from '../data/regions'
import { setExperimentGroup, setSegment } from '../lib/analytics'
import { ensureSession, supabase } from '../lib/supabase'

/**
 * 사용자 프로필 — 이름과 사는 지역.
 *
 * 지역은 화면 문구용 장식이 아니라 **요금표·전화번호·규정의 기준**입니다.
 * 그래서 온보딩에서 반드시 한 번 받습니다.
 *
 * 저장은 items 와 같은 방식입니다: localStorage 가 즉시 반영되고
 * Supabase 는 뒤에서 따라옵니다. 미연동이면 로컬로만 동작합니다.
 */
/**
 * K6 — 세그먼트별 전환율.
 * 제안서 §2-1 의 1순위 고객은 "자취 3년 이내 20~30대" 입니다.
 * 타깃의 K2 가 비타깃 대비 1.3배 이상인지 보려면 이 값이 있어야 합니다.
 */
export type Segment =
  /** 자취 3년 이내 — 1순위(Beachhead) */
  | 'solo_new'
  /** 자취 3년 초과 */
  | 'solo_veteran'
  /** 가족·동거 */
  | 'family'
  /** 답하지 않음 */
  | ''

export const SEGMENT_LABEL: Record<Exclude<Segment, ''>, string> = {
  solo_new: '혼자 산 지 3년 이내',
  solo_veteran: '혼자 산 지 3년 넘음',
  family: '가족·룸메이트와 함께',
}

export type Profile = {
  nickname: string
  regionId: string
  dong: string
  /**
   * 4주 실험 참가 코드 (제안서 §6-4).
   *
   * 'A' = 판별만 그룹 · 'B' = 판별+대행 그룹 · '' = 미참가.
   * 성공 기준이 **두 그룹의 K2 차이**라서, 이 값이 없으면 지표를 다 모아도
   * 그룹별로 쪼갤 수 없습니다. 모든 GA 이벤트에 파라미터로 붙습니다.
   */
  experimentGroup: string
  /** K6 — 고객 세그먼트 (선택 입력) */
  segment: Segment
  /**
   * K0 의 기준점 — 온보딩을 마친 시각.
   * "가입 14일 내 등록 개수 ≥3개" 를 재려면 가입일이 있어야 합니다.
   */
  joinedAt?: number
  /** 온보딩을 마쳤는지 — 안 마쳤으면 첫 화면에서 입력을 받습니다 */
  onboarded: boolean
}

type ProfileState = Profile & {
  setProfile: (p: Partial<Profile>) => void
  completeOnboarding: (p: Omit<Profile, 'onboarded'>) => void
  /** 서버 값으로 덮어쓰기 (앱 시작 시 1회) */
  hydrate: (p: Partial<Profile>) => void
}

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      nickname: '',
      regionId: DEFAULT_REGION_ID,
      dong: '',
      experimentGroup: '',
      segment: '',
      onboarded: false,

      setProfile: (p) => {
        set(p)
        if (p.experimentGroup !== undefined) {
          setExperimentGroup(p.experimentGroup)
        }
        if (p.segment !== undefined) setSegment(p.segment)
        void pushProfile({ ...get(), ...p })
      },

      completeOnboarding: (p) => {
        // 가입 시각은 여기서 한 번만 찍습니다 (K0 의 14일 창의 시작점)
        const next = { ...p, onboarded: true, joinedAt: Date.now() }
        set(next)
        setExperimentGroup(next.experimentGroup)
        setSegment(next.segment)
        void pushProfile(next)
      },

      hydrate: (p) => set(p),
    }),
    {
      name: 'bium.profile',
      // v2: 실험 참가 코드 추가 (기존 사용자는 미참가)
      // v3: K6 세그먼트 · K0 가입 시각 추가.
      //     기존 사용자의 가입 시각은 알 수 없어 비워 둡니다 (K0 분모에서 제외).
      version: 3,
      migrate: (persisted) => ({
        experimentGroup: '',
        segment: '' as Segment,
        ...(persisted as Partial<Profile>),
      }),
    },
  ),
)

/* ── Supabase 동기화 ───────────────────────────────────────── */

async function pushProfile(p: Profile) {
  if (!supabase) return
  const uid = await ensureSession()
  if (!uid) return

  const { error } = await supabase.from('profiles').upsert(
    {
      id: uid,
      nickname: p.nickname,
      region_id: p.regionId,
      dong: p.dong,
      experiment_group: p.experimentGroup,
      segment: p.segment,
      joined_at: p.joinedAt ? new Date(p.joinedAt).toISOString() : null,
      onboarded_at: p.onboarded ? new Date().toISOString() : null,
    },
    { onConflict: 'id' },
  )
  if (error) console.warn('[비움] 프로필 저장 실패:', error.message)
}

/** 앱 시작 시 서버 프로필을 가져옵니다. 로컬이 비어 있을 때만 덮어씁니다. */
export async function pullProfile(): Promise<void> {
  if (!supabase) return
  const uid = await ensureSession()
  if (!uid) return

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'nickname, region_id, dong, experiment_group, segment, joined_at, onboarded_at',
    )
    .eq('id', uid)
    .maybeSingle()

  if (error || !data) return

  const local = useProfile.getState()
  // 이미 이 기기에서 온보딩을 마쳤으면 로컬을 존중합니다
  // (다른 기기에서 로그인한 경우에만 서버 값을 가져옵니다)
  if (local.onboarded) return
  if (!data.onboarded_at) return

  useProfile.getState().hydrate({
    nickname: data.nickname ?? '',
    regionId: data.region_id ?? DEFAULT_REGION_ID,
    dong: data.dong ?? '',
    experimentGroup: data.experiment_group ?? '',
    segment: (data.segment as Segment) ?? '',
    joinedAt: data.joined_at ? new Date(data.joined_at).getTime() : undefined,
    onboarded: true,
  })
}
