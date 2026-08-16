import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ListScreen } from './screens/ListScreen'
import { ResultScreen } from './screens/ResultScreen'
import { RequestScreen } from './screens/RequestScreen'
import { ReportScreen } from './screens/ReportScreen'
import { CaptureScreen } from './screens/CaptureScreen'
import { NotFoundScreen } from './screens/PlaceholderScreens'
import { ConsentBanner } from './components/ConsentBanner'
import { initAnalytics, pageview } from './lib/analytics'
import { applyTheme, useTheme } from './store/theme'

/** 화면 전환 시 스크롤을 맨 위로 + 페이지뷰 전송 */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    pageview(pathname)
  }, [pathname])
  return null
}

export default function App() {
  const theme = useTheme((s) => s.theme)
  useEffect(() => applyTheme(theme), [theme])
  // 이미 동의한 사용자라면 여기서 gtag 를 로드합니다 (미동의면 아무 일도 없음)
  useEffect(() => initAnalytics(), [])

  return (
    <HashRouter>
      <RouteEffects />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/list" element={<ListScreen />} />
          <Route path="/capture" element={<CaptureScreen />} />
          <Route path="/result/:id" element={<ResultScreen />} />
          <Route path="/request/:id" element={<RequestScreen />} />
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
        <TabBar />
        <ConsentBanner />
      </div>
    </HashRouter>
  )
}
