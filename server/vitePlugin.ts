import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { DEFAULT_MODEL, handleClassify } from '../api/classify'

/**
 * 개발 서버에 POST /api/classify 와 GET /api/status 를 붙입니다.
 *
 * 판별 로직은 api/classify.ts 한 곳에만 있습니다.
 * 배포본은 그 파일이 서버리스 함수로 그대로 실행되고, 개발 중에는
 * 이 미들웨어가 같은 handleClassify 를 호출합니다.
 * (반대 방향 — api/ 가 server/ 를 임포트 — 로 두면 Vercel 함수가 죽습니다)
 *
 * API 키는 이 Node 프로세스 안에서만 읽히고 브라우저로 나가지 않습니다.
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
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
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

      // 배포본의 api/status.ts 와 같은 응답을 돌려줍니다
      server.middlewares.use('/api/status', (_req, res) => {
        json(res, 200, {
          hasApiKey: Boolean(apiKey),
          model,
          runtime: 'vite-dev',
        })
      })
    },
  }
}
