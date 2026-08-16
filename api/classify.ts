import { DEFAULT_MODEL } from '../server/classify'
import { handleClassify } from '../server/handler'

/**
 * 배포용 서버리스 함수 (Vercel).
 *
 * 개발 중에는 Vite dev 미들웨어(server/vitePlugin.ts)가 같은 일을 합니다.
 * 판별 로직은 server/ 에 한 벌만 두고 여기서는 HTTP 껍데기만 씌웁니다.
 *
 * 환경변수는 배포 대시보드에 설정합니다 (.env.local 은 배포되지 않습니다):
 *   ANTHROPIC_API_KEY  — 필수
 *   BIUM_MODEL         — 선택 (미설정 시 claude-opus-5)
 */

type Req = {
  method?: string
  body?: unknown
}

type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 만 허용됩니다.' })
    return
  }

  // Vercel 은 JSON 본문을 미리 파싱해 줍니다. 문자열로 올 때도 대비합니다.
  const raw =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})

  const { status, body } = await handleClassify(
    raw,
    process.env.ANTHROPIC_API_KEY,
    process.env.BIUM_MODEL || DEFAULT_MODEL,
  )

  res.setHeader('cache-control', 'no-store')
  res.status(status).json(body)
}
