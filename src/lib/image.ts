/**
 * 업로드 전 이미지 축소.
 *
 * 원본 사진은 12MP 이상이라 그대로 보내면 이미지 토큰이 크게 늘고 느려집니다.
 * 소파·가전 정도를 알아보는 데 1024px 이면 충분해서 긴 변 기준으로 줄입니다.
 * (Claude 는 최대 2576px 까지 받지만, 고해상도는 장당 토큰이 최대 3배까지 늘어납니다.)
 */

const MAX_EDGE = 1024
const QUALITY = 0.85

export type PreparedImage = {
  /** 판별 전송·촬영 직후 미리보기용 (1024px) */
  dataUrl: string
  /** 저장용 썸네일 (320px) — localStorage 용량을 아끼기 위해 분리 */
  thumbDataUrl: string
  /** 전송용 (data URL 접두사 제외) */
  base64: string
  mediaType: 'image/jpeg'
  width: number
  height: number
  /** 판별용 이미지의 대략적인 바이트 수 */
  bytes: number
  /** 저장용 썸네일의 대략적인 바이트 수 */
  thumbBytes: number
}

/**
 * 저장용 썸네일 크기.
 *
 * 판별에 쓴 1024px 원본을 그대로 저장하면 실사 사진 기준 장당 약 400KB(base64)라
 * localStorage 5MB 한도에 **12장이면 꽉 찹니다.** 넘치면 QuotaExceededError 로
 * 저장이 통째로 실패합니다.
 * 화면에서 사진이 가장 크게 쓰이는 곳이 판별결과의 200px 영역이라
 * 320px 이면 충분하고, 장당 약 25KB 로 줄어 150장 이상 들어갑니다.
 */
const THUMB_EDGE = 320
const THUMB_QUALITY = 0.72

function render(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): { dataUrl: string; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)

  // 판별용 — 해상도를 살립니다
  const full = render(bitmap, MAX_EDGE, QUALITY)
  // 저장용 — 목록·결과 화면 표시에만 쓰므로 작게
  const thumb = render(bitmap, THUMB_EDGE, THUMB_QUALITY)
  bitmap.close()

  const base64 = full.dataUrl.slice(full.dataUrl.indexOf(',') + 1)

  return {
    dataUrl: full.dataUrl,
    thumbDataUrl: thumb.dataUrl,
    base64,
    mediaType: 'image/jpeg',
    width: full.width,
    height: full.height,
    bytes: Math.round((base64.length * 3) / 4),
    thumbBytes: Math.round((thumb.dataUrl.length * 3) / 4),
  }
}
