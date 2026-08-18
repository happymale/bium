import type { FeeRow } from '../data/sdmBulkFees'
import type { RouteId } from '../data/routeKinds'
import { getActiveRegion } from './activeRegion'

/**
 * 현재 선택된 지역의 요금표.
 * 요금표가 없는 지역이면 빈 배열이라 모든 조회가 "매칭 없음" 이 됩니다 —
 * 다른 구의 요금이 새어 들어가지 않도록 하기 위한 기본값입니다.
 */
function feeRows(): FeeRow[] {
  return getActiveRegion().fees?.rows ?? []
}

/**
 * 요금표 조회.
 *
 * 수수료 0원으로 고시된 항목은 전부 전기·전자제품입니다. 원형이 보전된 폐가전은
 * 대형폐기물이 아니라 무상방문수거로 가기 때문입니다. 그래서 0원 행이 있는 구에서는
 * 요금표만으로 free / bulk 를 한 번 더 검증할 수 있습니다.
 *
 * ⚠ 다만 **0원 행을 아예 두지 않는 구가 절반쯤 됩니다.** 그런 구의 표는 폐가전을
 *   아예 싣지 않거나 유상으로 적어두므로, 요금표發 free 보정이 걸리지 않습니다.
 *   폐가전 판단의 1차 책임은 AI 에 있고 요금표는 보조 검증일 뿐입니다.
 *
 * (reuse / drop 은 요금표가 아니라 물건의 상태·종류로 판단 — AI 판별의 몫)
 */

export type FeeLookup = {
  matched: FeeRow[]
  /** 후보 중 가장 저렴한 값 (규격 미상일 때의 표시용) */
  minFee: number
  maxFee: number
  /** 요금표가 함의하는 경로 */
  impliedRoute: Extract<RouteId, 'free' | 'bulk'>
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[\s()·.,\-–—/]/g, '')
}

/**
 * 같은 물건을 가리키는 표기 묶음.
 *
 * ⚠ 한쪽 방향으로 고정하면 안 됩니다.
 *   서울 25개 구를 넣고 보니 **18개 구는 "소파", 5개 구는 "쇼파"** 로 적습니다.
 *   예전처럼 소파 → 쇼파 로만 치환하면 "소파" 표기를 쓰는 18개 구에서
 *   조회가 통째로 실패합니다 (치환한 "쇼파" 가 표에 없으므로).
 *   그래서 묶음 안의 표기를 **전부 시도**하고, 먼저 걸리는 것을 씁니다.
 */
const VARIANTS: string[][] = [
  ['소파', '쇼파', '쇼파베드', '소파베드'],
  ['싱크대', '씽크대'],
  ['매트리스', '메트리스'],
  ['러닝머신', '런닝머신', '트레드밀'],
  ['전자레인지', '전자렌지'],
  ['에어컨', '에어콘'],
  ['카펫', '카펫트', '카페트'],
  ['텔레비전', 'tv', '티비', '티브이', '텔레비젼'],
  ['컴퓨터류', '컴퓨터', '데스크탑', '데스크톱', '모니터', '본체', 'pc'],
  ['컴퓨터류프린터', '프린터', '복합기'],
  ['분말소화기', '소화기'],
  ['책장', '책꽂이'],
  ['옷걸이', '옷걸이대', '행거'],
  ['헬스자전거', '실내자전거', '자전거헬스'],
  ['옥장판', '전기장판', '전기매트'],
  ['스탠드조명', '스탠드'],
  ['진열대', '선반'],
  ['거울유리', '거울'],
  ['유모차', '유모차유아'],
  ['의류건조기', '건조기'],
]

/**
 * 조회에 시도해 볼 표기들. 원문이 항상 첫 번째입니다 —
 * 우리 구 표기가 이미 맞다면 굳이 치환할 이유가 없습니다.
 */
function candidateQueries(query: string): string[] {
  const n = normalize(query)
  if (!n) return []
  const out = [n]
  for (const group of VARIANTS) {
    const hit = group.find((v) => n.includes(normalize(v)))
    if (!hit) continue
    for (const v of group) {
      const swapped = n.split(normalize(hit)).join(normalize(v))
      if (!out.includes(swapped)) out.push(swapped)
      // 품목명만으로도 시도 ("3인용소파" → "소파")
      const bare = normalize(v)
      if (!out.includes(bare)) out.push(bare)
    }
  }
  return out
}

function matchRows(q: string): FeeRow[] {
  const exact = feeRows().filter((r) => normalize(r.name) === q)
  if (exact.length) return exact
  return feeRows().filter((r) => {
    const n = normalize(r.name)
    return n.includes(q) || q.includes(n)
  })
}

/** 품목명으로 요금표를 조회합니다. 표기 변형 + 부분 일치(양방향)까지 허용. */
export function lookupFee(query: string): FeeLookup | null {
  let matched: FeeRow[] = []
  for (const q of candidateQueries(query)) {
    matched = matchRows(q)
    if (matched.length) break
  }
  if (!matched.length) return null

  const fees = matched.map((r) => r.fee)
  const minFee = Math.min(...fees)
  const maxFee = Math.max(...fees)

  return {
    matched,
    minFee,
    maxFee,
    // 후보 중 하나라도 유료면 대형폐기물 신고 대상으로 봅니다 (보수적)
    impliedRoute: maxFee === 0 ? 'free' : 'bulk',
  }
}

/**
 * 규격까지 반영한 최종 선택.
 *
 * 요금표는 같은 품목이라도 규격별로 가격이 갈립니다("쇼파 1인용/2인용/3인용").
 * 판별 결과의 "소파 3인용" 같은 문자열에서 규격 토큰을 뽑아 후보에 점수를 매기고
 * 가장 잘 맞는 행을 고릅니다. 근거가 없으면 최저가를 고릅니다(보수적).
 */
export function resolveFee(
  query: string,
): { row: FeeRow; ambiguous: boolean } | null {
  const tokens = specTokens(query)

  // 품목명 매칭에는 규격 토큰을 뺀 문자열을 씁니다.
  // ("책장 1m 이상" 을 통째로 넣으면 요금표의 "책장(책꽂이)" 와 겹치지 않습니다)
  const nameOnly = stripSpecTokens(query)
  const hit = lookupFee(nameOnly) ?? lookupFee(query)
  if (!hit) return null
  if (hit.matched.length === 1) return { row: hit.matched[0], ambiguous: false }

  if (tokens.length === 0) {
    const cheapest = hit.matched.reduce((a, b) => (b.fee < a.fee ? b : a))
    return { row: cheapest, ambiguous: true }
  }

  // 토큰이 붙어 있는 그대로 등장하면 가산점.
  // "42인치 이상" 이 "25인치 이상~42인치 미만" 에도 토큰 단위로는 다 걸리기 때문에
  // 연속 구절이 일치하는 행을 우선해야 올바른 구간을 고릅니다.
  const phrase = tokens.join('')

  let best = hit.matched[0]
  let bestScore = -1
  for (const row of hit.matched) {
    const hay = normalize(`${row.name} ${row.spec}`)
    let score = tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0)
    if (tokens.length > 1 && hay.includes(phrase)) score += tokens.length
    // 동점이면 더 저렴한 쪽 (보수적)
    if (score > bestScore || (score === bestScore && row.fee < best.fee)) {
      best = row
      bestScore = score
    }
  }
  return { row: best, ambiguous: bestScore === 0 }
}

const SPEC_NUM = /\d+(?:인용|단|자|kg|l|m|㎝|cm|㎡|인치|리터|ℓ)/g
const SPEC_WORDS = ['소형', '중형', '대형', '미만', '이상', '이하']

/** 규격을 가리키는 토큰만 추출: 3인용, 500l, 120㎝, 10kg, 1m, 4단, 5자 … */
function specTokens(query: string): string[] {
  const n = normalize(query)
  const out: string[] = []
  for (const m of n.matchAll(SPEC_NUM)) {
    if (!out.includes(m[0])) out.push(m[0])
  }
  for (const w of SPEC_WORDS) {
    if (n.includes(w) && !out.includes(w)) out.push(w)
  }
  return out
}

/** 규격 토큰을 걷어내고 품목명만 남깁니다 */
function stripSpecTokens(query: string): string {
  let n = normalize(query).replace(SPEC_NUM, '')
  for (const w of SPEC_WORDS) n = n.split(w).join('')
  return n
}

/** 규격까지 특정된 정확한 수수료 */
export function exactFee(name: string, spec: string): number | null {
  const n = normalize(name)
  const s = normalize(spec)
  const hit = feeRows().find(
    (r) => normalize(r.name) === n && normalize(r.spec) === s,
  )
  return hit ? hit.fee : null
}

export function formatWon(won: number): string {
  return won === 0 ? '0원' : `${won.toLocaleString('ko-KR')}원`
}
