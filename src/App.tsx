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
import { AddItemScreen } from './screens/AddItemScreen'
import { NotFoundScreen } from './screens/PlaceholderScreens'
import { MetricsScreen } from './screens/MetricsScreen'
import { ConsentBanner } from './components/ConsentBanner'
import {
  initAnalytics,
  pageview,
  setExperimentGroup,
  setSegment,
} from './lib/analytics'
import { supabaseEnabled } from './lib/supabase'
import { initialSync } from './lib/sync'
import { useItems } from './store/items'
import { pullProfile, useProfile } from './store/profile'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { applyTheme, useTheme } from './store/theme'
import { METRICS_VISIBLE, readGroupFromUrl } from './lib/experiment'

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
  const onboarded = useProfile((s) => s.onboarded)
  useEffect(() => applyTheme(theme), [theme])
  // 이미 동의한 사용자라면 여기서 gtag 를 로드합니다 (미동의면 아무 일도 없음)
  // 실험 참가 코드는 로드 직후에 심어야 첫 이벤트부터 그룹이 붙습니다.
  useEffect(() => {
    initAnalytics()
    const p = useProfile.getState()

    // 초대 링크(?g=A / ?g=B)로 들어왔다면 참가군을 그때 심습니다.
    // 이미 온보딩을 마친 사람에게도 링크만 보내면 배정됩니다.
    // 사용자 화면에는 이 값이 어디에도 보이지 않습니다.
    const fromLink = readGroupFromUrl()
    if (fromLink && fromLink !== p.experimentGroup) {
      useProfile.getState().setProfile({ experimentGroup: fromLink })
    }

    setExperimentGroup(fromLink || p.experimentGroup)
    setSegment(p.segment)
  }, [])

  // Supabase 가 연결돼 있으면 서버 목록을 가져오고, 이 기기에만 있던 물건은 올려 보냅니다.
  // 미연동이면 아무 일도 하지 않고 localStorage 로만 동작합니다.
  useEffect(() => {
    if (!supabaseEnabled) return
    let cancelled = false
    void pullProfile()
    void initialSync(useItems.getState().items).then((merged) => {
      // 교체가 아니라 병합입니다 — 동기화 중에 추가된 물건을 지우지 않기 위해서입니다
      if (!cancelled && merged) useItems.getState().mergeRemote(merged)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 지역을 모르면 요금·전화번호·규정을 안내할 수 없습니다. 온보딩을 먼저 받습니다.
  if (!onboarded) {
    return (
      <div className="app-shell">
        <OnboardingScreen />
      </div>
    )
  }

  return (
    <HashRouter>
      <RouteEffects />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/list" element={<ListScreen />} />
          <Route path="/capture" element={<CaptureScreen />} />
          <Route path="/add" element={<AddItemScreen />} />
          <Route path="/result/:id" element={<ResultScreen />} />
          <Route path="/request/:id" element={<RequestScreen />} />
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          {/* 운영자용 계측 점검. 어디에도 링크가 없고, 배포본에서는
              VITE_SHOW_METRICS=1 빌드에만 라우트가 생깁니다. */}
          {METRICS_VISIBLE && (
            <Route path="/metrics" element={<MetricsScreen />} />
          )}
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
        <TabBar />
        <ConsentBanner />
      </div>
    </HashRouter>
  )
}
