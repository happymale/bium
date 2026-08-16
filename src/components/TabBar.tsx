import { NavLink, useNavigate } from 'react-router'
import {
  CameraIcon,
  HomeIcon,
  ListIcon,
  ReportIcon,
  SettingsIcon,
} from './icons'
import s from './TabBar.module.css'

const TABS = [
  { to: '/', label: '홈', Icon: HomeIcon, end: true },
  { to: '/list', label: '비움 목록', Icon: ListIcon, end: false },
  { to: '/report', label: '리포트', Icon: ReportIcon, end: false },
  { to: '/settings', label: '설정', Icon: SettingsIcon, end: false },
]

export function TabBar() {
  const navigate = useNavigate()
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)]

  return (
    <nav className={s.bar} aria-label="주요 화면">
      {left.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={s.tab}>
          <Icon />
          {label}
        </NavLink>
      ))}

      <div className={s.fabSlot}>
        <button
          type="button"
          className={s.fab}
          onClick={() => navigate('/capture')}
          aria-label="사진으로 판별하기"
        >
          <CameraIcon size={25} />
        </button>
        <span className={s.fabLabel}>판별</span>
      </div>

      {right.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={s.tab}>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
