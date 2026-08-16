import Anthropic from '@anthropic-ai/sdk'
import {
  CLASSIFY_SCHEMA,
  SYSTEM_PROMPT,
  type Classification,
} from './prompt'

/**
 * 사진 한 장 → 처리 경로 판별.
 *
 * 이 모듈은 **서버 쪽에서만** 실행됩니다 (Vite dev 미들웨어 / 배포 시 서버리스 함수).
 * API 키가 브라우저 번들에 들어가지 않도록 하기 위한 분리입니다.
 */

/**
 * 판별 모델.
 *
 * .env.local 의 BIUM_MODEL 로 바꿀 수 있습니다.
 * 개발·테스트는 저렴한 haiku, 발표·실사용은 정확한 opus 를 쓰는 용도입니다.
 */
export const DEFAULT_MODEL = 'claude-opus-5'

/**
 * 모델마다 받는 파라미터가 다릅니다.
 * Haiku 4.5 는 output_config.effort 와 adaptive thinking 을 지원하지 않아
 * 그대로 보내면 400 이 납니다. 구조화 출력(format)은 세 모델 모두 지원합니다.
 */
const SUPPORTS_EFFORT_AND_ADAPTIVE = new Set([
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
])

/** 1M 토큰당 (입력, 출력) 단가 — 응답에 예상 비용을 붙이기 위한 표 */
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

export type ClassifyResult = Classification & {
  /** 실제 AI 판별인지, 키가 없어 목업으로 대체된 것인지 */
  source: 'ai' | 'mock'
  model?: string
  usage?: { input: number; output: number }
  /** 이번 호출의 예상 비용 (USD) */
  costUsd?: number
  /** 응답까지 걸린 시간 (ms) */
  elapsedMs?: number
}

/* ── 목업 응답 ────────────────────────────────────────────────
   API 키가 없을 때 앱 전체 흐름이 그대로 동작하도록 하는 폴백입니다.
   시연에서 항상 같은 결과가 나오는 것이 오히려 유리한 경우에도 씁니다. */
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
  },
]

let mockCursor = 0

export function mockClassify(): ClassifyResult {
  const m = MOCKS[mockCursor % MOCKS.length]
  mockCursor += 1
  return { ...m, source: 'mock' }
}

/* ── 실제 판별 ────────────────────────────────────────────── */

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

  // 모델별로 지원 파라미터가 달라 요청을 나눕니다.
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
        // Haiku 4.5 등: effort / adaptive thinking 미지원. 구조화 출력만 사용.
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
