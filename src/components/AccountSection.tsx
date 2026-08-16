import { useEffect, useState } from 'react'
import {
  ANONYMOUS,
  getAccount,
  linkEmail,
  signIn,
  signOut,
  type AccountState,
} from '../lib/auth'
import { supabaseEnabled } from '../lib/supabase'
import s from '../screens/SettingsScreen.module.css'

/**
 * 계정 섹션.
 *
 * 기본은 익명이고, 이메일을 연결하면 **같은 계정 id 를 유지한 채** 정식 계정이
 * 됩니다. 그래서 지금까지 등록한 물건과 사진이 그대로 따라옵니다.
 */
export function AccountSection() {
  const [account, setAccount] = useState<AccountState>(ANONYMOUS)
  const [mode, setMode] = useState<'none' | 'link' | 'signin'>('none')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    void getAccount().then(setAccount)
  }, [])

  if (!supabaseEnabled) {
    return (
      <>
        <h2 className={s.groupTitle}>계정</h2>
        <div className={s.group}>
          <div className={s.row}>
            <div>
              <div className={s.rowLabel}>계정 없음</div>
              <div className={s.rowSub}>
                클라우드 연동이 꺼져 있어 이 기기에만 저장됩니다
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  async function submit() {
    setBusy(true)
    setMsg(null)
    const r =
      mode === 'link'
        ? await linkEmail(email.trim(), password)
        : await signIn(email.trim(), password)
    setBusy(false)
    setMsg({ ok: r.ok, text: r.ok ? (r.message ?? '완료했습니다.') : r.message })
    if (r.ok) {
      setPassword('')
      setAccount(await getAccount())
      if (mode === 'signin') setMode('none')
    }
  }

  const valid = email.includes('@') && password.length >= 6

  return (
    <>
      <h2 className={s.groupTitle}>계정</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>
              {account.anonymous ? '익명으로 사용 중' : (account.email ?? '계정')}
            </div>
            <div className={s.rowSub}>
              {account.anonymous
                ? '가입 없이 쓰는 중입니다. 이 기기에서만 이어집니다'
                : '다른 기기에서도 같은 목록을 볼 수 있습니다'}
            </div>
          </div>
          <span className={s.rowValue}>
            {account.anonymous ? '익명' : '연결됨'}
          </span>
        </div>

        {account.pendingEmail && (
          <div className={s.stack}>
            <p className={`${s.msg} ${s.msgOk}`} style={{ marginTop: 0 }}>
              <b>{account.pendingEmail}</b> 로 보낸 확인 메일의 링크를 눌러야
              계정 연결이 끝납니다.
            </p>
          </div>
        )}

        {mode === 'none' ? (
          <div className={s.stack}>
            {account.anonymous ? (
              <>
                <div className={s.rowLabel}>다른 기기에서도 쓰려면</div>
                <div className={s.rowSub}>
                  이메일을 연결하면 지금까지 등록한 물건과 사진이 그대로
                  따라옵니다. 새로 시작하지 않습니다.
                </div>
                <button
                  type="button"
                  className={s.action}
                  onClick={() => {
                    setMode('link')
                    setMsg(null)
                  }}
                >
                  이메일로 계정 만들기
                </button>
                <button
                  type="button"
                  className={s.linkish}
                  onClick={() => {
                    setMode('signin')
                    setMsg(null)
                  }}
                >
                  이미 계정이 있어요 · 로그인
                </button>
              </>
            ) : (
              <button
                type="button"
                className={s.linkish}
                onClick={async () => {
                  if (
                    confirm(
                      '로그아웃하면 이 기기의 목록이 보이지 않습니다. 계속할까요?',
                    )
                  ) {
                    await signOut()
                    setAccount(await getAccount())
                    location.reload()
                  }
                }}
              >
                로그아웃
              </button>
            )}
          </div>
        ) : (
          <div className={s.stack}>
            <div className={s.rowLabel}>
              {mode === 'link' ? '이메일로 계정 만들기' : '로그인'}
            </div>
            {mode === 'signin' && (
              <div className={`${s.rowSub} ${s.warnText}`}>
                로그인하면 이 기기에 익명으로 담아둔 물건은 보이지 않게 됩니다.
              </div>
            )}
            <input
              className={s.input}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className={s.input}
              type="password"
              autoComplete={
                mode === 'link' ? 'new-password' : 'current-password'
              }
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className={s.action}
              disabled={!valid || busy}
              onClick={submit}
            >
              {busy
                ? '처리 중…'
                : mode === 'link'
                  ? '계정 만들기'
                  : '로그인'}
            </button>
            <button
              type="button"
              className={s.linkish}
              onClick={() => {
                setMode('none')
                setMsg(null)
              }}
            >
              취소
            </button>
          </div>
        )}

        {msg && (
          <div className={s.stack}>
            <p
              className={`${s.msg} ${msg.ok ? s.msgOk : s.msgErr}`}
              style={{ marginTop: 0 }}
            >
              {msg.text}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
