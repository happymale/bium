import { Screen, Stub } from '../components/Screen'

export function NotFoundScreen() {
  return (
    <Screen title="없는 화면" back>
      <Stub step="—">요청하신 주소를 찾을 수 없습니다.</Stub>
    </Screen>
  )
}
