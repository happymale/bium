/**
 * 판별 모드 확인용. 키 값 자체는 절대 내려보내지 않고 있음/없음만 알려줍니다.
 *
 * ⚠ 이 파일은 **의도적으로 아무것도 import 하지 않습니다.**
 *   서버리스 번들러가 api/ 바깥(server/) 모듈을 제대로 묶지 못해
 *   FUNCTION_INVOCATION_FAILED 가 나는 사례가 있어, 진단과 안정성을 위해
 *   자립형으로 둡니다. 모델 기본값만 server/classify.ts 와 맞춰주세요.
 */

const FALLBACK_MODEL = 'claude-opus-5'

type Res = {
  status: (code: number) => Res
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

export default function handler(_req: unknown, res: Res) {
  res.setHeader('cache-control', 'no-store')
  res.status(200).json({
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.BIUM_MODEL || FALLBACK_MODEL,
    // 어느 경로로 응답했는지 (배포 진단용)
    runtime: 'vercel',
  })
}
