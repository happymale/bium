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
  /** 화면 미리보기용 */
  dataUrl: string
  /** 전송용 (data URL 접두사 제외) */
  base64: string
  mediaType: 'image/jpeg'
  width: number
  height: number
  /** 축소 후 대략적인 바이트 수 */
  bytes: number
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  return {
    dataUrl,
    base64,
    mediaType: 'image/jpeg',
    width,
    height,
    bytes: Math.round((base64.length * 3) / 4),
  }
}
