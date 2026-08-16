import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import s from './Screen.module.css'

type ScreenProps = {
  title: string
  /** 뒤로가기 화살표 노출 (탭 최상위 화면은 false) */
  back?: boolean
  /** 우측 상단 액션 */
  action?: ReactNode
  children?: ReactNode
}

export function Screen({ title, back = false, action, children }: ScreenProps) {
  const navigate = useNavigate()

  return (
    <>
      <header className={s.navbar}>
        {back && (
          <button
            type="button"
            className={s.back}
            onClick={() => navigate(-1)}
            aria-label="뒤로"
          >
            ‹
          </button>
        )}
        <h1 className={s.title}>{title}</h1>
        <span className={s.spacer} />
        {action}
      </header>
      <main className={s.body}>{children}</main>
    </>
  )
}

/** 후속 단계에서 채울 화면 자리표시자 */
export function Stub({ step, children }: { step: string; children: ReactNode }) {
  return (
    <div className={s.stub}>
      <b>{step}에서 구현 예정</b>
      {children}
    </div>
  )
}
