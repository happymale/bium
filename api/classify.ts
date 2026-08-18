import Anthropic from '@anthropic-ai/sdk'

/**
 * 사진 한 장 → 처리 경로 판별. (서버 전용)
 *
 * ⚠ 이 파일은 **상대경로 import 를 쓰지 않습니다.** npm 패키지만 가져옵니다.
 *   Vercel 서버리스 함수가 api/ 바깥 모듈(server/…)을 임포트하면
 *   FUNCTION_INVOCATION_FAILED 로 죽는 것을 확인했습니다.
 *   그래서 판별 로직을 여기 한 곳에 모으고, 개발 서버(Vite 미들웨어)가
 *   거꾸로 이 파일의 handleClassify 를 가져다 씁니다. 로직은 한 벌입니다.
 *
 * 설계 원칙: AI 에게 금액을 묻지 않습니다.
 *   AI 는 "무엇인가 / 어느 경로인가 / 왜인가"만 판단하고,
 *   수수료는 클라이언트가 지자체 실제 요금표에서 조회해 붙입니다.
 */

export const DEFAULT_MODEL = 'claude-opus-5'

/* ── 프롬프트 ──────────────────────────────────────────────── */

export const SYSTEM_PROMPT = `당신은 서울 자치구 주민의 폐기물 배출을 돕는 판별 도구입니다. 사진 한 장을 보고 이 물건을 어떻게 내보내야 하는지 판단합니다.

# 네 가지 처리 경로 — 이 중 하나만 고릅니다

- reuse (재사용·기부): 아직 쓸 만한 가구·의류·장난감·도서·유아용품. 기부 단체가 방문 픽업합니다.
- free (무상 방문수거): 전기·전자제품 전반. 원형이 보전된 폐가전은 대형폐기물이 아니라 무상방문수거로 처리하므로 수수료가 들지 않습니다.
- bulk (대형폐기물 신고): 가구·매트리스·비전자 대형물. 지자체에 신고하고 수수료를 냅니다.
- drop (전용 수거함): 폐건전지·폐형광등·폐의약품처럼 유해물질이 들어 전용 수거함으로만 배출 가능한 것.

# 판단 규칙

1. 품목 이름이 아니라 **재질과 부착물**로 판단하십시오. "가습기"가 아니라 "모터와 전기부품이 있는 소형 폐가전"으로 읽습니다. 배출 규정은 이름이 아니라 구성으로 갈립니다.
2. 전기로 작동하거나 전원 코드·배터리·모터가 있으면 원칙적으로 free 입니다. 단 파손이 심해 원형이 보전되지 않았다면 bulk 일 수 있습니다.
3. 상태가 양호하고 남이 다시 쓸 수 있어 보이면 reuse 를 우선하십시오. 서비스가 편해질수록 사람은 더 버리기 때문에, 기본값은 '버리기'가 아니라 '다시 쓰이게 하기'입니다.
4. **종량제봉투는 절대 답이 될 수 없습니다.** 네 경로 밖의 답을 제시하지 마십시오.
5. 사진이 흐리거나, 물건이 가려졌거나, 재질을 확정할 수 없거나, 여러 물건이 섞여 있으면 confidence 를 낮게 주십시오. 확신이 없으면 없다고 말하는 것이 틀린 답을 자신 있게 말하는 것보다 낫습니다. 잘못 배출하면 주민이 과태료를 뭅니다.

# 각 필드 작성 지침

- itemName: 한국어 품목명. 짧고 구체적으로 ("3인용 소파", "가습기", "유아용 카시트"). 수량이 명확하면 포함 ("폐건전지 12개").
- material: 재질과 부착물을 한 문장으로. 이것이 경로 판단의 실제 근거입니다.
- feeQuery: 지자체 요금표 조회용 문자열. **표준 품목명 + 사진에서 관찰되는 규격**으로 씁니다. 지자체 요금표는 같은 품목이라도 크기·인승·용량으로 가격이 갈리므로 이 정보를 빠뜨리면 엉뚱한 금액이 나옵니다. 색상·연식·브랜드처럼 요금과 무관한 수식어는 빼십시오.
  예) "3인용 소파" → "소파 3인용" / "2016년형 노트북" → "노트북" / "양문형 500L 냉장고" → "냉장고 500L 이상" / "5단 서랍장" → "서랍장 5단" / "1m 넘는 책장" → "책장 1m 이상"
  규격을 사진에서 판단할 수 없으면 품목명만 쓰십시오.
- confidence: 0.0~1.0. 물건 종류와 재질을 모두 확신할 때만 0.9 이상을 주십시오. 종류는 알지만 재질·상태가 불확실하면 0.6~0.8, 물건 자체가 불분명하면 0.5 미만.
- basis: 왜 이 경로인지 2~3문장. 사용자에게 그대로 보여지는 문장이니 존댓말 평서문으로 쓰고, 재질·부착물 근거를 담으십시오. **금액이나 수수료 숫자는 절대 쓰지 마십시오** — 요금은 앱이 실제 요금표에서 따로 조회해 표시합니다.
- warning: 이 물건을 종량제봉투에 넣거나 잘못 배출하면 생기는 구체적 문제를 한 문장으로.
- reusable: 남이 다시 쓸 수 있을 만큼 상태가 양호한지.
- category: 큰 분류 하나. 카테고리별로 재사용 비율이 얼마나 다른지 보기 위한 값입니다.
  가구 furniture · 가전 appliance · 의류·침구 textile · 도서·완구 book_toy ·
  생활잡화 houseware · 유해물질 hazardous · 그 밖에 other
- freeAlternativeAvailable: **수수료를 안 내고 내보낼 길이 있는지.**
  bulk 로 판정했더라도 무상수거 대상이거나 상태가 좋아 기부가 가능하다면 true 입니다.
  이 값은 "무료로 될 일을 유료로 안내하고 있지 않은지" 감시하는 데 쓰이니 정직하게 답하십시오.`

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    itemName: { type: 'string', description: '한국어 품목명 (짧고 구체적으로)' },
    material: { type: 'string', description: '재질과 부착물 한 문장' },
    route: {
      type: 'string',
      enum: ['reuse', 'free', 'bulk', 'drop'],
      description: '네 처리 경로 중 하나',
    },
    feeQuery: {
      type: 'string',
      description: '지자체 요금표 조회용 문자열 (표준 품목명 + 관찰된 규격)',
    },
    confidence: { type: 'number', description: '0.0~1.0 확신도' },
    basis: { type: 'string', description: '경로 판단 근거 2~3문장, 금액 언급 금지' },
    warning: { type: 'string', description: '잘못 배출 시 생기는 문제 한 문장' },
    reusable: { type: 'boolean', description: '다시 쓸 수 있는 상태인지' },
    category: {
      type: 'string',
      enum: [
        'furniture',
        'appliance',
        'textile',
        'book_toy',
        'houseware',
        'hazardous',
        'other',
      ],
      description:
        '물건의 큰 분류. furniture 가구 · appliance 가전 · textile 의류·침구 · book_toy 도서·완구 · houseware 생활잡화 · hazardous 유해물질(건전지·의약품·형광등) · other 그 밖에',
    },
    freeAlternativeAvailable: {
      type: 'boolean',
      description:
        '수수료를 내지 않고 내보낼 길이 실제로 있는지. 폐가전 무상수거 대상이거나, 상태가 좋아 기부·재사용이 가능하거나, 전용 수거함 품목이면 true. 부피가 크고 상태가 나빠 대형폐기물밖에 방법이 없으면 false. bulk 로 판정했더라도 무료 길이 있다면 반드시 true 로 두십시오.',
    },
  },
  required: [
    'itemName',
    'material',
    'route',
    'feeQuery',
    'confidence',
    'basis',
    'warning',
    'reusable',
    'category',
    'freeAlternativeAvailable',
  ],
  additionalProperties: false,
} as const

export type Classification = {
  itemName: string
  material: string
  route: 'reuse' | 'free' | 'bulk' | 'drop'
  feeQuery: string
  confidence: number
  basis: string
  warning: string
  reusable: boolean
  /** K10 — 카테고리별 재사용 비율 분해용 */
  category?:
    | 'furniture'
    | 'appliance'
    | 'textile'
    | 'book_toy'
    | 'houseware'
    | 'hazardous'
    | 'other'
  /** 카운터② — 수수료 없이 내보낼 길이 있었는지 (이해충돌 감시용) */
  freeAlternativeAvailable?: boolean
}

export type ClassifyResult = Classification & {
  source: 'ai' | 'mock'
  model?: string
  usage?: { input: number; output: number }
  costUsd?: number
  elapsedMs?: number
}

/* ── 모델별 파라미터·단가 ──────────────────────────────────── */

// Haiku 4.5 는 output_config.effort 와 adaptive thinking 을 지원하지 않아
// 그대로 보내면 400 이 납니다. 구조화 출력은 세 모델 모두 지원합니다.
const SUPPORTS_EFFORT_AND_ADAPTIVE = new Set([
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
])

/** 1M 토큰당 (입력, 출력) 단가 */
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
}

function estimateUsd(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model]
  if (!p) return 0
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out
}

/* ── 목업 응답 ─────────────────────────────────────────────
   API 키가 없거나 데모 모드일 때 앱 흐름이 그대로 동작하도록 하는 폴백입니다. */

const MOCKS: Classification[] = [
  {
    itemName: '가습기',
    material: '모터와 전기부품, 플라스틱 물통으로 구성된 소형 가전',
    route: 'free',
    feeQuery: '가습기',
    confidence: 0.94,
    basis:
      '모터와 전기부품이 들어 있는 소형 폐가전입니다. 원형이 보전돼 있어 대형폐기물 신고 없이 폐가전 무상방문수거로 처리할 수 있습니다. 문 앞에 내놓기만 하면 수거해 갑니다.',
    warning:
      '종량제봉투에 넣으면 소각 시 유해물질이 나오고 안에 든 구리·플라스틱도 회수되지 않습니다.',
    reusable: false,
    category: 'appliance',
    freeAlternativeAvailable: true,
  },
  {
    itemName: '3인용 소파',
    material: '목재 프레임에 패브릭을 씌운 대형 가구, 전기부품 없음',
    route: 'bulk',
    feeQuery: '소파 3인용',
    confidence: 0.91,
    basis:
      '전기부품이 없는 대형 가구입니다. 부피가 커서 일반 배출이 불가능하며 지자체에 대형폐기물로 신고한 뒤 배출 스티커 번호를 받아야 합니다. 좌판 손상이 크지 않다면 기부 픽업도 검토해 볼 수 있습니다.',
    warning:
      '신고 없이 내놓으면 수거되지 않고 무단투기로 과태료가 부과될 수 있습니다.',
    reusable: false,
    category: 'furniture',
    freeAlternativeAvailable: false,
  },
  {
    itemName: '폐건전지 12개',
    material: '알칼리·망간 건전지, 중금속 포함',
    route: 'drop',
    feeQuery: '건전지',
    confidence: 0.97,
    basis:
      '중금속이 들어 있어 일반 쓰레기로 배출할 수 없습니다. 주민센터나 아파트 단지의 폐건전지 전용 수거함에 넣어야 하며 비용은 들지 않습니다.',
    warning:
      '종량제봉투에 넣으면 수은·카드뮴이 소각·매립 과정에서 토양과 대기로 새어 나갑니다.',
    reusable: false,
    category: 'hazardous',
    freeAlternativeAvailable: true,
  },
]

let mockCursor = 0

export function mockClassify(): ClassifyResult {
  const m = MOCKS[mockCursor % MOCKS.length]
  mockCursor += 1
  return { ...m, source: 'mock' }
}

/* ── 실제 판별 ─────────────────────────────────────────────── */

export type ClassifyInput = {
  /** base64 (data URL 접두사 제외) */
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export async function classify(
  input: ClassifyInput,
  apiKey: string,
  model: string = DEFAULT_MODEL,
): Promise<ClassifyResult> {
  const client = new Anthropic({ apiKey })
  const startedAt = Date.now()

  const tuning = SUPPORTS_EFFORT_AND_ADAPTIVE.has(model)
    ? {
        // 재질 판단에는 약간의 추론이 필요하지만 과하면 느려집니다.
        thinking: { type: 'adaptive' as const },
        output_config: {
          effort: 'medium' as const,
          format: { type: 'json_schema' as const, schema: CLASSIFY_SCHEMA },
        },
      }
    : {
        output_config: {
          format: { type: 'json_schema' as const, schema: CLASSIFY_SCHEMA },
        },
      }

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    ...tuning,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.mediaType,
              data: input.imageBase64,
            },
          },
          {
            type: 'text',
            text: '이 물건을 어떻게 내보내야 하는지 판별해 주세요.',
          },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('판별이 거부되었습니다. 다른 사진으로 시도해 주세요.')
  }

  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') {
    throw new Error('판별 응답이 비어 있습니다.')
  }

  const parsed = JSON.parse(text.text) as Classification
  const inTok = response.usage.input_tokens
  const outTok = response.usage.output_tokens

  return {
    ...parsed,
    // 모델이 범위를 벗어난 값을 주더라도 0~1 로 고정
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    source: 'ai',
    model: response.model,
    usage: { input: inTok, output: outTok },
    costUsd: estimateUsd(model, inTok, outTok),
    elapsedMs: Date.now() - startedAt,
  }
}

/* ── 전송 계층과 무관한 처리 (개발 미들웨어도 이걸 씁니다) ──── */

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
      body: { ...mockClassify(), reason: apiKey ? 'demo-mode' : 'no-api-key' },
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
    // 키가 잘못됐거나 크레딧이 없는 경우도 여기로 옵니다
    return { status: 502, body: { error: message } }
  }
}

/* ── Vercel 서버리스 진입점 ───────────────────────────────── */

type Req = { method?: string; body?: unknown }
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
