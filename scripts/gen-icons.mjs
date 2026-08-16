/**
 * PWA 아이콘 생성기.
 *
 * 외부 의존성 없이 Node 내장 zlib 만으로 PNG 를 씁니다.
 * (sharp / canvas 같은 네이티브 모듈을 넣지 않으려는 선택입니다)
 *
 *   node scripts/gen-icons.mjs
 *
 * 목업 로고와 같은 형태 — 브랜드 그린 배경에 흰색 "비".
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/** 라이트 테마 --brand */
const BRAND = [15, 122, 85]
const WHITE = [255, 255, 255]

/* ── PNG 인코딩 ─────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** rgba: Uint8Array(size*size*4) → PNG Buffer */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // 10,11,12 = compression / filter / interlace = 0

  // 각 스캔라인 앞에 필터 바이트(0) 를 붙입니다
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const off = y * (size * 4 + 1)
    raw[off] = 0
    rgba.copy
      ? rgba.copy(raw, off + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, off + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ── 드로잉 (안티에일리어싱: 4x4 슈퍼샘플링) ──────────────────── */

const SS = 4

function draw(size, { radius, glyphScale }) {
  const buf = Buffer.alloc(size * size * 4)

  // 배경 라운드 사각형 판정 (단위 좌표 0..1)
  const inBg = (x, y) => {
    if (radius <= 0) return true
    const r = radius
    const cx = Math.min(Math.max(x, r), 1 - r)
    const cy = Math.min(Math.max(y, r), 1 - r)
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= r * r
  }

  // "비" — ㅂ(좌) + ㅣ(우). 사각형 조합으로 그립니다.
  const S = glyphScale
  const c = 0.5
  const at = (v) => c + (v - 0.5) * S // 중심 기준 스케일
  const bars = [
    // ㅂ: 좌 세로 / 우 세로 / 중간 가로 / 아래 가로
    [0.26, 0.28, 0.318, 0.725],
    [0.462, 0.28, 0.52, 0.725],
    [0.26, 0.468, 0.52, 0.526],
    [0.26, 0.667, 0.52, 0.725],
    // ㅣ: 세로 한 획
    [0.632, 0.235, 0.69, 0.77],
  ].map(([x0, y0, x1, y1]) => [at(x0), at(y0), at(x1), at(y1)])

  const inGlyph = (x, y) =>
    bars.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0
      let fgHits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          if (inBg(x, y)) {
            bgHits++
            if (inGlyph(x, y)) fgHits++
          }
        }
      }
      const total = SS * SS
      const alpha = bgHits / total
      const fg = fgHits / total

      const i = (py * size + px) * 4
      if (alpha === 0) continue
      // 배경 위에 흰 글자를 합성
      const mix = fg / Math.max(alpha, 1e-6)
      buf[i] = Math.round(BRAND[0] * (1 - mix) + WHITE[0] * mix)
      buf[i + 1] = Math.round(BRAND[1] * (1 - mix) + WHITE[1] * mix)
      buf[i + 2] = Math.round(BRAND[2] * (1 - mix) + WHITE[2] * mix)
      buf[i + 3] = Math.round(alpha * 255)
    }
  }
  return buf
}

/* ── 출력 ──────────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true })

const targets = [
  // 일반 아이콘 — 라운드 사각형
  { file: 'icon-192.png', size: 192, radius: 0.2, glyphScale: 1 },
  { file: 'icon-512.png', size: 512, radius: 0.2, glyphScale: 1 },
  // maskable — 꽉 찬 사각형 + 안전영역(80%) 안으로 글자 축소
  { file: 'icon-maskable-512.png', size: 512, radius: 0, glyphScale: 0.62 },
  // iOS 는 자체 마스크를 씌우므로 꽉 찬 사각형
  { file: 'apple-touch-icon.png', size: 180, radius: 0, glyphScale: 0.86 },
  { file: 'favicon-64.png', size: 64, radius: 0.2, glyphScale: 1.05 },
]

for (const t of targets) {
  const png = encodePng(t.size, draw(t.size, t))
  writeFileSync(join(OUT, t.file), png)
  console.log(`${t.file.padEnd(24)} ${t.size}x${t.size}  ${(png.length / 1024).toFixed(1)}KB`)
}
