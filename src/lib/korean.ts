/**
 * 한국어 조사 자동 선택.
 * 품목명이 AI 판별 결과로 들어오기 때문에 "은(는)" 같은 표기를 피하려면 필요합니다.
 */

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/**
 * 조사를 정할 때 기준이 되는 마지막 글자.
 *
 * 품목명은 "노트북 (2016년형)", "헌 이불 2채", "소파 — 3인용" 처럼
 * 괄호·따옴표·문장부호로 끝나는 경우가 많습니다. 그대로 마지막 글자를 보면
 * ")" 를 읽고 받침이 없다고 판단해 "노트북 (2016년형)가" 같은 문장이 나옵니다.
 * 그래서 의미 없는 꼬리를 걷어낸 뒤 판단합니다.
 */
function lastMeaningfulChar(word: string): string {
  const trimmed = word.replace(/[\s)\]}>」』】”’"'.,!?~\-–—·]+$/u, '').trim()
  return trimmed[trimmed.length - 1] ?? ''
}

/** 마지막 글자에 받침이 있는지 */
export function hasFinalConsonant(word: string): boolean {
  const ch = lastMeaningfulChar(word)
  if (!ch) return false
  const code = ch.charCodeAt(0)

  if (code >= HANGUL_START && code <= HANGUL_END) {
    return (code - HANGUL_START) % 28 !== 0
  }

  // 숫자로 끝나는 경우 — 읽는 소리 기준
  // 0,1,3,6,7,8 은 받침 있음(영·일·삼·육·칠·팔) / 2,4,5,9 는 없음(이·사·오·구)
  if (/[0-9]/.test(ch)) return '013678'.includes(ch)

  // 영문·기타는 받침 없는 것으로 처리
  return false
}

/** 은/는 */
export function topic(word: string): string {
  return hasFinalConsonant(word) ? '은' : '는'
}

/** 이/가 */
export function subject(word: string): string {
  return hasFinalConsonant(word) ? '이' : '가'
}

/** 을/를 */
export function object(word: string): string {
  return hasFinalConsonant(word) ? '을' : '를'
}

/** 으로/로 — 'ㄹ' 받침은 '로' */
export function direction(word: string): string {
  const ch = lastMeaningfulChar(word)
  if (!ch) return '로'
  const code = ch.charCodeAt(0)
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const jong = (code - HANGUL_START) % 28
    if (jong === 0 || jong === 8) return '로' // 받침 없음 또는 ㄹ
  }
  return hasFinalConsonant(word) ? '으로' : '로'
}
