import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 앱 설정.
 *
 * demoMode: 켜면 API 키가 있어도 목업 응답을 씁니다.
 *   - 발표장에서 네트워크가 불안정해도 시연이 깨지지 않습니다
 *   - 결과가 항상 같아서 시나리오를 연습한 대로 보여줄 수 있습니다
 *   - 개발 중 UI 를 만질 때 비용이 들지 않습니다
 */
type SettingsState = {
  demoMode: boolean
  setDemoMode: (v: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      demoMode: false,
      setDemoMode: (demoMode) => set({ demoMode }),
    }),
    { name: 'bium.settings' },
  ),
)
