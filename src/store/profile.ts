import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_REGION_ID } from '../data/regions'
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
export type Profile = {
  nickname: string
  regionId: string
  dong: string
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
      onboarded: false,

      setProfile: (p) => {
        set(p)
        void pushProfile({ ...get(), ...p })
      },

      completeOnboarding: (p) => {
        const next = { ...p, onboarded: true }
        set(next)
        void pushProfile(next)
      },

      hydrate: (p) => set(p),
    }),
    { name: 'bium.profile', version: 1 },
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
    .select('nickname, region_id, dong, onboarded_at')
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
    onboarded: true,
  })
}
