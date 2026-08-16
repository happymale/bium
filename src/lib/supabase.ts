import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 연결.
 *
 * 환경변수가 없으면 `supabase` 가 null 이고, 앱은 지금까지처럼
 * localStorage 만으로 동작합니다. 설정 전후로 화면이 달라지지 않습니다.
 *
 * 여기 쓰이는 키는 publishable(구 anon) 키입니다 — 브라우저에 노출되는 것이
 * 정상 설계이며, 실제 보호는 DB 의 RLS 정책이 합니다.
 * (sb_secret / service_role 키는 절대 클라이언트에 넣지 않습니다)
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabaseEnabled = Boolean(URL && KEY)

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'bium.auth',
      },
    })
  : null

/**
 * 익명 세션 확보.
 *
 * 가입 화면 없이 기기마다 계정이 하나 생깁니다. RLS 가 이 user id 로
 * 데이터를 격리하므로, 남의 물건은 조회 자체가 되지 않습니다.
 * 나중에 이메일을 연결하면 같은 id 를 유지한 채 정식 계정으로 승격됩니다.
 */
/**
 * 진행 중인 세션 확보를 하나로 묶습니다.
 *
 * ⚠ 이게 없으면 앱 시작 시 목록 동기화·사진 업로드·물건 저장이 동시에
 *   ensureSession() 을 부르면서 **익명 계정이 여러 개 만들어집니다.**
 *   그러면 A 계정으로 저장한 물건을 B 계정으로 조회하게 되어
 *   "저장은 됐는데 목록에 없는" 상태가 됩니다. (실제로 3개까지 생기는 걸 확인)
 */
let sessionOnce: Promise<string | null> | null = null

async function resolveSession(): Promise<string | null> {
  const { data } = await supabase!.auth.getSession()
  if (data.session?.user) return data.session.user.id

  const { data: signed, error } = await supabase!.auth.signInAnonymously()
  if (error) {
    // 대시보드에서 Anonymous Sign-Ins 를 켜지 않으면 여기로 옵니다
    console.warn(
      '[비움] 익명 로그인 실패 — Supabase 대시보드에서 Anonymous Sign-Ins 를 켰는지 확인하세요.',
      error.message,
    )
    sessionOnce = null // 실패는 캐시하지 않습니다 (나중에 다시 시도 가능)
    return null
  }
  return signed.user?.id ?? null
}

export function ensureSession(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null)
  if (!sessionOnce) {
    sessionOnce = resolveSession().catch((err) => {
      sessionOnce = null
      console.warn('[비움] 세션 확보 실패:', err)
      return null
    })
  }
  return sessionOnce
}

/** 테스트·로그아웃 시 메모를 비웁니다 */
export function resetSession() {
  sessionOnce = null
}

/** 설정 화면 표시용 상태 */
export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error'
