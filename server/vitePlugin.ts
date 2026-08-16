import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { DEFAULT_MODEL, classify, mockClassify } from './classify'

/**
 * 개발 서버에 POST /api/classify 를 붙입니다.
 *
 * API 키는 이 Node 프로세스 안에서만 읽히고 브라우저로 나가지 않습니다.
 * 배포 시에는 같은 handleClassify 를 서버리스 함수로 옮기면 됩니다.
 */

const MAX_BODY = 12 * 1024 * 1024 // 12MB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('이미지가 너무 큽니다.'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(payload)
}

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

export function classifyApi(
  apiKey: string | undefined,
  model: string = DEFAULT_MODEL,
): Plugin {
  return {
    name: 'bium-classify-api',
    configureServer(server) {
      server.middlewares.use('/api/classify', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const raw = await readBody(req)
          const { status, body } = await handleClassify(raw, apiKey, model)
          json(res, status, body)
        } catch (err) {
          json(res, 400, {
            error: err instanceof Error ? err.message : '요청 처리 실패',
          })
        }
      })

      // 앱이 켜질 때 현재 모드를 알 수 있게 하는 상태 엔드포인트
      server.middlewares.use('/api/status', (_req, res) => {
        json(res, 200, { hasApiKey: Boolean(apiKey), model })
      })
    },
  }
}
