import { DEFAULT_MODEL, classify, mockClassify } from './classify'

/**
 * 판별 요청 처리 — 전송 계층과 무관한 순수 함수.
 *
 * 개발 중에는 Vite 미들웨어(vitePlugin.ts)가, 배포 후에는 서버리스 함수(api/)가
 * 이 함수를 호출합니다. 두 경로가 같은 코드를 쓰므로 동작이 갈리지 않습니다.
 * Vite 에 의존하지 않아 서버리스 번들에 플러그인 코드가 딸려가지 않습니다.
 */
export async function handleClassify(
  raw: string,
  apiKey: string | undefined,
  model: string = DEFAULT_MODEL,
): Promise<{ status: number; body: unknown }> {
  let parsed: { imageBase64?: string; mediaType?: string; forceMock?: boolean }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 400, body: { error: '잘못된 요청 형식입니다.' } }
  }

  // 키가 없거나 사용자가 데모 모드를 고른 경우 → 목업 응답
  if (!apiKey || parsed.forceMock) {
    return {
      status: 200,
      body: {
        ...mockClassify(),
        reason: apiKey ? 'demo-mode' : 'no-api-key',
      },
    }
  }

  if (!parsed.imageBase64 || !parsed.mediaType) {
    return { status: 400, body: { error: '이미지가 없습니다.' } }
  }

  try {
    const result = await classify(
      {
        imageBase64: parsed.imageBase64,
        mediaType: parsed.mediaType as 'image/jpeg',
      },
      apiKey,
      model,
    )
    return { status: 200, body: result }
  } catch (err) {
    const message = err instanceof Error ? err.message : '판별에 실패했습니다.'
    // 키가 잘못됐거나 크레딧이 없는 경우도 여기로 옵니다 — 앱이 멈추지 않도록 이유를 그대로 전달
    return { status: 502, body: { error: message } }
  }
}
