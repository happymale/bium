import { DEFAULT_MODEL } from '../server/classify'

/**
 * 판별 모드 확인용. 키 값 자체는 절대 내려보내지 않고 있음/없음만 알려줍니다.
 * 설정 화면이 "실제 AI / 데모"를 표시하는 데 씁니다.
 */

type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

export default function handler(_req: unknown, res: Res) {
  res.setHeader('cache-control', 'no-store')
  res.status(200).json({
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.BIUM_MODEL || DEFAULT_MODEL,
  })
}
