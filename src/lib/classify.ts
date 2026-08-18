import type { RouteId } from '../data/routeKinds'
import type { Category, Item } from '../types'
import { lookupFee, resolveFee } from './fees'
import { getActiveRegion } from './activeRegion'
import type { PreparedImage } from './image'

/**
 * 판별 요청 + 요금표 병합.
 *
 * ★ AI 는 금액을 말하지 않습니다. 경로와 품목만 판단하고,
 *   수수료는 여기서 서대문구 실제 요금표를 조회해 채웁니다.
 */

/** 이 값 미만이면 결과를 확정하지 않고 구청 문의로 유도합니다. */
export const CONFIDENCE_THRESHOLD = 0.85

/**
 * 설정 화면 표기용 모델 이름.
 * 서버가 실제로 쓰는 모델 id 를 받아 사람이 읽을 이름으로 바꿉니다.
 * (코드에 이름을 박아두면 .env 를 바꿔도 화면이 따라오지 않습니다)
 */
export function modelLabel(id: string | null): string {
  switch (id) {
    case 'claude-opus-5':
      return 'Claude Opus 5'
    case 'claude-sonnet-5':
      return 'Claude Sonnet 5'
    case 'claude-haiku-4-5':
      return 'Claude Haiku 4.5'
    default:
      return id ?? '알 수 없는 모델'
  }
}

export type Classification = {
  itemName: string
  material: string
  route: RouteId
  feeQuery: string
  confidence: number
  basis: string
  warning: string
  reusable: boolean
  /** K10 — 카테고리별 재사용 비율 분해용 */
  category?: Category
  /** 카운터② — 수수료 없이 내보낼 길이 있었는지 */
  freeAlternativeAvailable?: boolean
  source: 'ai' | 'mock'
  model?: string
  usage?: { input: number; output: number }
  /** 서버가 측정한 API 왕복 시간 (ms) */
  elapsedMs?: number
  /** 이번 호출의 예상 비용 (USD) */
  costUsd?: number
  reason?: 'no-api-key' | 'demo-mode'
}

export type ClassifyOutcome = {
  classification: Classification
  /** 저장소에 넣을 물건 초안 (요금 병합 완료) */
  draft: Omit<Item, 'id' | 'addedAt' | 'status'>
  /** 확신도가 기준에 못 미쳐 확정을 보류해야 하는지 */
  uncertain: boolean
  /** 요금표에서 찾지 못한 품목인지 */
  feeUnknown: boolean
}

export async function classifyImage(
  image: PreparedImage,
  opts: { forceMock?: boolean } = {},
): Promise<ClassifyOutcome> {
  const res = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      imageBase64: image.base64,
      mediaType: image.mediaType,
      forceMock: opts.forceMock,
    }),
  })

  const body = await res.json()
  if (!res.ok) {
    throw new Error(body?.error ?? '판별에 실패했습니다.')
  }

  const c = body as Classification
  // 저장에는 썸네일만 씁니다 — 원본은 판별에만 쓰고 버립니다.
  // (원본을 저장하면 localStorage 가 사진 12장에서 넘칩니다)
  return merge(c, image.thumbDataUrl)
}

/** AI 판단 + 실제 요금표 → 저장 가능한 물건 초안 */
export function merge(c: Classification, photo?: string): ClassifyOutcome {
  // 요금표를 갖춘 지역에서만 금액을 계산합니다.
  // 다른 구 요금을 대신 보여주면 사용자가 틀린 금액을 믿고 배출하게 됩니다.
  const regionSupported = getActiveRegion().supported
  if (!regionSupported) {
    return {
      classification: c,
      draft: {
        name: c.itemName,
        route: c.route,
        fee: 0,
        photo,
        confidence: c.confidence,
        basis: c.basis,
        origin: 'ai',
        category: c.category,
        freeAlternativeAvailable: c.freeAlternativeAvailable,
      },
      uncertain: c.confidence < CONFIDENCE_THRESHOLD,
      feeUnknown: true,
    }
  }

  const hit = lookupFee(c.feeQuery || c.itemName)

  // 요금표가 이 품목을 무상(0원)으로 고시했는데 AI 가 bulk 라고 했다면,
  // 요금표가 더 신뢰할 만한 1차 자료이므로 free 로 정정합니다.
  let route: RouteId = c.route
  if (hit && hit.impliedRoute === 'free' && route === 'bulk') {
    route = 'free'
  }

  // 규격 토큰까지 반영해 후보 중 실제 해당 행을 고릅니다.
  const resolved = resolveFee(c.feeQuery || c.itemName)

  let fee = 0
  let feeSpec: string | undefined
  let feeMatchedName: string | undefined

  if (resolved) {
    feeMatchedName = resolved.row.name
    feeSpec = resolved.row.spec || undefined
    if (route === 'bulk') fee = resolved.row.fee
  }

  return {
    classification: c,
    draft: {
      name: c.itemName,
      route,
      fee,
      feeSpec,
      feeMatchedName,
      photo,
      confidence: c.confidence,
      basis: c.basis,
      // 이 물건은 판별을 거쳤습니다 — K2 의 분모에 들어갑니다
      origin: 'ai',
      // K10 · 카운터② — AI 가 판단해 주므로 사용자에게 묻지 않습니다
      category: c.category,
      freeAlternativeAvailable: c.freeAlternativeAvailable,
    },
    uncertain: c.confidence < CONFIDENCE_THRESHOLD,
    feeUnknown: !hit,
  }
}
