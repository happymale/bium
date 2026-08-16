import { resetSession, supabase } from './supabase'

/**
 * 계정.
 *
 * 기본은 익명입니다 — 가입 없이 바로 쓰기 위해서입니다.
 * 이메일을 연결하면 **같은 계정 id 를 유지한 채** 정식 계정으로 승격되므로
 * 지금까지 등록한 물건과 사진이 그대로 따라옵니다.
 */

export type AccountState = {
  signedIn: boolean
  anonymous: boolean
  email: string | null
  /** 이메일을 넣었지만 아직 확인 메일을 클릭하지 않은 상태 */
  pendingEmail: string | null
}

export const ANONYMOUS: AccountState = {
  signedIn: false,
  anonymous: true,
  email: null,
  pendingEmail: null,
}

export async function getAccount(): Promise<AccountState> {
  if (!supabase) return ANONYMOUS
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return ANONYMOUS
  return {
    signedIn: true,
    anonymous: Boolean(u.is_anonymous),
    email: u.email ?? null,
    pendingEmail: u.new_email ?? null,
  }
}

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string }

/** 사람이 읽을 수 있는 문구로 바꿉니다 */
function humanize(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 맞지 않습니다.'
    case 'weak_password':
      return '비밀번호가 너무 짧습니다. 6자 이상으로 해주세요.'
    case 'over_email_send_rate_limit':
      return '메일을 너무 자주 보냈습니다. 잠시 뒤 다시 시도해 주세요.'
    case 'email_address_invalid':
      return '이메일 형식이 올바르지 않습니다.'
    default:
      return fallback
  }
}

/**
 * 익명 계정에 이메일·비밀번호를 붙여 정식 계정으로 승격합니다.
 * 데이터는 그대로 유지됩니다 (계정 id 가 바뀌지 않기 때문입니다).
 */
export async function linkEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: '클라우드 연동이 꺼져 있습니다.' }

  const { error } = await supabase.auth.updateUser({ email, password })
  if (error) return { ok: false, message: humanize(error.code, error.message) }

  return {
    ok: true,
    message: `${email} 로 확인 메일을 보냈습니다. 메일의 링크를 눌러야 계정이 완성됩니다.`,
  }
}

/** 다른 기기에서 기존 계정으로 들어오기 */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: '클라우드 연동이 꺼져 있습니다.' }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: humanize(error.code, error.message) }

  resetSession() // 세션 메모를 비워 새 계정으로 다시 잡게 합니다
  return { ok: true }
}

/**
 * 로그아웃.
 * 익명 계정에서 로그아웃하면 그 계정으로는 다시 못 들어옵니다
 * (이메일이 없어 되찾을 방법이 없기 때문). 그래서 화면에서 경고합니다.
 */
export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
  resetSession()
}
