/**
 * 한국어 조사 자동 선택.
 * 품목명이 AI 판별 결과로 들어오기 때문에 "은(는)" 같은 표기를 피하려면 필요합니다.
 */

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** 마지막 글자에 받침이 있는지 */
export function hasFinalConsonant(word: string): boolean {
  const trimmed = word.trim()
  if (!trimmed) return false
  const ch = trimmed[trimmed.length - 1]
  const code = ch.charCodeAt(0)

  if (code >= HANGUL_START && code <= HANGUL_END) {
    return (code - HANGUL_START) % 28 !== 0
  }

  // 숫자로 끝나는 경우 (예: "선풍기 2대"는 한글이지만 "노트북 2"는 숫자)
  if (/[0-9]/.test(ch)) {
    // 0,1,3,6,7,8 은 받침 있음(영,일,삼,육,칠,팔) / 2,4,5,9 는 없음(이,사,오,구)
    return '013678'.includes(ch)
  }

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

/** 으로/로 */
export function direction(word: string): string {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  // 'ㄹ' 받침은 '로'
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const jong = (code - HANGUL_START) % 28
    if (jong === 0 || jong === 8) return '로'
  }
  return hasFinalConsonant(word) ? '으로' : '로'
}
