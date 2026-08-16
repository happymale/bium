import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 앱 설정.
 *
 * demoMode: 켜면 API 키가 있어도 목업 응답을 씁니다.
 *   - 발표장에서 네트워크가 불안정해도 시연이 깨지지 않습니다
 *   - 결과가 항상 같아서 시나리오를 연습한 대로 보여줄 수 있습니다
 *   - 개발 중 UI 를 만질 때 비용이 들지 않습니다
 *
 * demoData: 켜면 시연용 예시 물건이 목록에 들어옵니다.
 *   처음 켰을 때 남의 물건이 차 있으면 자기 목록으로 느껴지지 않아
 *   기본값은 꺼짐입니다. 발표할 때만 켭니다.
 */
type SettingsState = {
  demoMode: boolean
  setDemoMode: (v: boolean) => void
  demoData: boolean
  setDemoData: (v: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      demoMode: false,
      setDemoMode: (demoMode) => set({ demoMode }),
      demoData: false,
      setDemoData: (demoData) => set({ demoData }),
    }),
    { name: 'bium.settings' },
  ),
)
