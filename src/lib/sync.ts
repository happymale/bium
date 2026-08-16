import type { Item, ItemStatus } from '../types'
import type { RouteId } from '../data/routeKinds'
import { ensureSession, supabase } from './supabase'

/**
 * localStorage ↔ Supabase 동기화.
 *
 * 설계: **localStorage 가 UI 의 진실**이고 Supabase 는 그 뒤에서 따라옵니다.
 *   - 화면은 항상 즉시 반응합니다 (네트워크를 기다리지 않음)
 *   - 비행기 모드에서도 목록을 보고 물건을 추가할 수 있습니다
 *   - 서버 왕복이 실패해도 앱이 멈추지 않습니다
 * 대신 "마지막에 쓴 기기가 이긴다" 수준의 단순한 충돌 처리만 합니다.
 * 한 사람이 폰과 PC 를 번갈아 쓰는 정도에는 충분합니다.
 */

type Row = {
  id: string
  name: string
  route: string
  fee: number
  fee_spec: string | null
  fee_matched_name: string | null
  photo_path: string | null
  confidence: number | null
  basis: string | null
  status: string
  added_at: string
  disposed_at: string | null
  destination: string | null
}

function rowToItem(r: Row): Item {
  return {
    id: r.id,
    name: r.name,
    route: r.route as RouteId,
    fee: r.fee,
    feeSpec: r.fee_spec ?? undefined,
    feeMatchedName: r.fee_matched_name ?? undefined,
    photoPath: r.photo_path ?? undefined,
    confidence: r.confidence ?? undefined,
    basis: r.basis ?? undefined,
    status: r.status as ItemStatus,
    addedAt: new Date(r.added_at).getTime(),
    disposedAt: r.disposed_at ? new Date(r.disposed_at).getTime() : undefined,
    destination: r.destination ?? undefined,
  }
}

function itemToRow(i: Item, userId: string) {
  return {
    id: i.id,
    user_id: userId,
    name: i.name,
    route: i.route,
    fee: i.fee,
    fee_spec: i.feeSpec ?? null,
    fee_matched_name: i.feeMatchedName ?? null,
    photo_path: i.photoPath ?? null,
    confidence: i.confidence ?? null,
    basis: i.basis ?? null,
    status: i.status,
    added_at: new Date(i.addedAt).toISOString(),
    disposed_at: i.disposedAt ? new Date(i.disposedAt).toISOString() : null,
    destination: i.destination ?? null,
  }
}

/** 시드 데이터는 올리지 않습니다 — 기기마다 중복 생성되기 때문입니다 */
function isSeed(item: Item) {
  return item.id.startsWith('seed-') || item.id.startsWith('done-')
}

/* ── 사진 ──────────────────────────────────────────────────── */

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * 판별에 쓴 원본(1024px)을 Storage 에 올립니다.
 * localStorage 에는 계속 320px 썸네일만 두고, 원본은 서버에 둡니다.
 * 실패해도 예외를 던지지 않습니다 — 사진 업로드가 물건 등록을 막으면 안 됩니다.
 */
export async function uploadPhoto(dataUrl: string): Promise<string | null> {
  if (!supabase) return null
  const userId = await ensureSession()
  if (!userId) return null

  // 경로 규칙이 곧 보안 경계입니다 (RLS: 첫 폴더명 == 본인 user id)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, dataUrlToBlob(dataUrl), {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    console.warn('[비움] 사진 업로드 실패:', error.message)
    return null
  }
  return path
}

/** 비공개 버킷이라 서명 URL 로만 읽습니다 (1시간 유효) */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

async function deletePhoto(path: string) {
  if (!supabase) return
  await supabase.storage.from('photos').remove([path])
}

/* ── 물건 ──────────────────────────────────────────────────── */

export async function pullItems(): Promise<Item[] | null> {
  if (!supabase) return null
  const userId = await ensureSession()
  if (!userId) return null

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('added_at', { ascending: false })

  if (error) {
    console.warn('[비움] 목록 불러오기 실패:', error.message)
    return null
  }
  return (data as Row[]).map(rowToItem)
}

export async function pushItem(item: Item): Promise<void> {
  if (!supabase || isSeed(item)) return
  const userId = await ensureSession()
  if (!userId) return

  const { error } = await supabase
    .from('items')
    .upsert(itemToRow(item, userId), { onConflict: 'id' })
  if (error) console.warn('[비움] 저장 실패:', error.message)
}

export async function removeItem(item: Item): Promise<void> {
  if (!supabase || isSeed(item)) return
  const userId = await ensureSession()
  if (!userId) return

  if (item.photoPath) await deletePhoto(item.photoPath)
  const { error } = await supabase.from('items').delete().eq('id', item.id)
  if (error) console.warn('[비움] 삭제 실패:', error.message)
}

/**
 * 앱 시작 시 1회. 서버 목록을 가져오고, 서버에 없는 로컬 물건은 올려 보냅니다.
 * (예: Supabase 를 붙이기 전에 이 기기에서 만든 물건들)
 */
export async function initialSync(local: Item[]): Promise<Item[] | null> {
  const remote = await pullItems()
  if (remote === null) return null

  const remoteIds = new Set(remote.map((i) => i.id))
  const localOnly = local.filter((i) => !isSeed(i) && !remoteIds.has(i.id))

  for (const item of localOnly) await pushItem(item)

  // 시드(시연용 더미)는 서버에 올리지 않지만 화면에서는 유지합니다.
  // 빼먹으면 Supabase 를 켜는 순간 목록과 리포트가 텅 비어 시연이 깨집니다.
  const seeds = local.filter(isSeed)

  const merged = [...remote, ...localOnly, ...seeds]
  merged.sort((a, b) => b.addedAt - a.addedAt)
  return merged
}
