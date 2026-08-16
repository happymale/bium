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
 * 서대문구 표에서 수수료 0원 항목은 전부 전기·전자제품이며,
 * 이는 원형이 보전된 폐가전이 대형폐기물이 아니라 무상방문수거로 가기 때문입니다.
 * 따라서 요금표만으로 free / bulk 를 가를 수 있습니다.
 * (reuse / drop 은 요금표가 아니라 물건의 상태·종류로 판단 — 4단계 AI 판별의 몫)
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
 * 구청 표기와 일상 표기가 다른 품목의 별칭.
 * 예) 구청은 "쇼파"·"씽크대"·"메트리스"로 적지만 사람과 AI 는 "소파"·"싱크대"·"매트리스"라고 씁니다.
 * 좌변(일상 표기) → 우변(요금표 표기)
 */
const ALIASES: Record<string, string> = {
  소파: '쇼파',
  쇼파베드: '쇼파',
  싱크대: '씽크대',
  매트리스: '메트리스',
  러닝머신: '런닝머신',
  트레드밀: '런닝머신',
  전자레인지: '전자렌지',
  전자레인지대: '전자렌지',
  에어콘: '에어컨',
  카페트: '카펫트',
  카펫: '카펫트',
  tv: '텔레비전',
  티비: '텔레비전',
  티브이: '텔레비전',
  텔레비젼: '텔레비전',
  모니터: '컴퓨터류',
  데스크탑: '컴퓨터류',
  데스크톱: '컴퓨터류',
  컴퓨터: '컴퓨터류',
  본체: '컴퓨터류',
  프린터: '컴퓨터류프린터',
  복합기: '컴퓨터류프린터',
  소화기: '분말소화기',
  책꽂이: '책장',
  옷걸이대: '옷걸이',
  행거: '옷걸이',
  자전거헬스: '헬스자전거',
  실내자전거: '헬스자전거',
  전기장판: '옥장판',
  전기매트: '옥장판',
  스탠드: '스탠드조명',
  선반: '진열대',
  거울: '거울유리',
  유모차유아: '유모차',
  아기침대: '침대아기침대',
  건조기: '의류건조기',
}

/** 별칭을 요금표 표기로 치환 */
function canonical(q: string): string {
  const n = normalize(q)
  if (ALIASES[n]) return ALIASES[n]
  // 부분 포함 별칭 ("3인용 소파" → "쇼파")
  for (const [from, to] of Object.entries(ALIASES)) {
    if (from.length >= 2 && n.includes(from)) return to
  }
  return n
}

/** 품목명으로 요금표를 조회합니다. 별칭 치환 + 부분 일치(양방향)까지 허용. */
export function lookupFee(query: string): FeeLookup | null {
  const q = canonical(query)
  if (!q) return null

  const exact = feeRows().filter((r) => normalize(r.name) === q)
  const partial = feeRows().filter((r) => {
    const n = normalize(r.name)
    return n.includes(q) || q.includes(n)
  })

  const matched = exact.length ? exact : partial
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
