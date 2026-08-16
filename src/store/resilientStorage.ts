import type { StateStorage } from 'zustand/middleware'

/**
 * 용량 초과에 견디는 localStorage 어댑터.
 *
 * 사진을 썸네일로 줄여도 수백 장을 쌓으면 결국 5MB 한도에 닿습니다.
 * 기본 localStorage 는 그 순간 QuotaExceededError 를 던지고, zustand persist 는
 * 이를 잡지 않아 **저장이 조용히 실패**합니다. 사용자는 앱을 껐다 켜기 전까지
 * 데이터가 날아간 걸 모릅니다.
 *
 * 그래서 넘칠 때 사진부터 버립니다. 우선순위:
 *   1) 이미 처리 완료된 물건의 사진   — 다시 볼 일이 가장 적음
 *   2) 오래된 물건의 사진             — 목록 아래쪽
 *   3) 전부                            — 최후
 * 물건 자체(이름·경로·요금·이력)는 절대 지우지 않습니다. 사진은 부가정보입니다.
 */

type Item = {
  photo?: string
  status?: string
  addedAt?: number
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' ||
      // Firefox
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22)
  )
}

/** 사진을 몇 장 버린 새 JSON 문자열을 만듭니다. 더 버릴 게 없으면 null. */
function dropPhotos(raw: string, stage: number): string | null {
  let parsed: { state?: { items?: Item[] } }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const items = parsed.state?.items
  if (!Array.isArray(items)) return null

  const withPhoto = items.filter((i) => i.photo)
  if (withPhoto.length === 0) return null

  let victims: Item[]
  if (stage === 0) {
    victims = items.filter((i) => i.photo && i.status === 'done')
  } else if (stage === 1) {
    // 오래된 순으로 절반
    const sorted = withPhoto
      .slice()
      .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))
    victims = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
  } else {
    victims = withPhoto
  }

  if (victims.length === 0) return null
  for (const v of victims) delete v.photo
  return JSON.stringify(parsed)
}

export function resilientLocalStorage(): StateStorage {
  return {
    getItem: (name) => localStorage.getItem(name),
    removeItem: (name) => localStorage.removeItem(name),
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value)
        return
      } catch (err) {
        if (!isQuotaError(err)) throw err
      }

      // 사진을 단계적으로 버리며 재시도
      let current = value
      for (let stage = 0; stage <= 2; stage++) {
        const reduced = dropPhotos(current, stage)
        if (!reduced) continue
        current = reduced
        try {
          localStorage.setItem(name, current)
          console.warn(
            `[비움] 저장 공간이 부족해 사진 일부를 정리했습니다 (${stage + 1}단계). 물건 정보는 그대로입니다.`,
          )
          return
        } catch (err) {
          if (!isQuotaError(err)) throw err
        }
      }

      // 사진을 다 버려도 안 들어가면 여기까지 옵니다
      console.error('[비움] 저장 공간이 부족합니다. 목록을 정리해 주세요.')
    },
  }
}
