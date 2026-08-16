import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { resilientLocalStorage } from './resilientStorage'
import { pushItem, removeItem as removeRemote } from '../lib/sync'
import type { Item, ItemStatus } from '../types'
import { daysIdle } from '../types'
import type { RouteId } from '../data/routeKinds'

const DAY = 86_400_000

/**
 * 시드 데이터 — 목업 ②의 7개 물건.
 * 방치일수는 하드코딩하지 않고 addedAt 을 과거로 잡아 매일 자동으로 늘어나게 했습니다.
 *
 * ⚠ 소파 수수료는 목업의 7,000원이 아니라 서대문구 실제 요금표의 15,000원입니다.
 *   (쇼파 3인용 · 15,000원 — sdmBulkFees.ts 참고)
 */
function seed(now: number): Item[] {
  const at = (d: number) => now - d * DAY
  return [
    {
      id: 'seed-battery',
      name: '폐건전지 12개',
      route: 'drop',
      fee: 0,
      addedAt: at(211),
      status: 'pending',
    },
    {
      id: 'seed-laptop',
      name: '노트북 (2016년형)',
      route: 'free',
      fee: 0,
      feeMatchedName: '노트북, 태블릿',
      addedAt: at(154),
      status: 'pending',
    },
    {
      id: 'seed-humidifier',
      name: '가습기',
      route: 'free',
      fee: 0,
      feeMatchedName: '가습기',
      feeSpec: '소형 (1M미만 가정용)',
      addedAt: at(128),
      status: 'pending',
    },
    {
      id: 'seed-carseat',
      name: '유아용 카시트',
      route: 'reuse',
      fee: 0,
      addedAt: at(89),
      status: 'pending',
    },
    {
      id: 'seed-blanket',
      name: '헌 이불 2채',
      route: 'reuse',
      fee: 0,
      feeMatchedName: '이불',
      addedAt: at(46),
      status: 'pending',
    },
    {
      id: 'seed-sofa',
      name: '3인용 소파',
      route: 'bulk',
      fee: 15000,
      feeMatchedName: '쇼파 3인용',
      feeSpec: '3인용',
      addedAt: at(23),
      status: 'pending',
    },
    {
      id: 'seed-books',
      name: '읽은 책 24권',
      route: 'reuse',
      fee: 0,
      addedAt: at(11),
      status: 'pending',
    },

    /* ── 지난달 처리 완료분 — 리포트 집계용 ──────────────────────
       목업 ④ 와 동일하게 6개 중 5개가 재사용·재활용(83%),
       세그먼트는 재사용 3 · 무상수거 2 · 대형폐기물 1 입니다.
       "아낀 수수료"는 하드코딩이 아니라 실제 요금표에서 역산합니다. */
    {
      id: 'done-blanket',
      name: '겨울 이불 2채',
      route: 'reuse',
      fee: 0,
      feeMatchedName: '이불',
      addedAt: at(62),
      status: 'done',
      disposedAt: at(24),
      destination: '아름다운가게 신촌점 · 판매 완료',
    },
    {
      id: 'done-table',
      name: '4인용 식탁',
      route: 'reuse',
      fee: 0,
      feeMatchedName: '식탁',
      feeSpec: '4인용 이하',
      addedAt: at(70),
      status: 'done',
      disposedAt: at(20),
      destination: '아름다운가게 신촌점 · 판매 완료',
    },
    {
      id: 'done-bike',
      name: '성인용 자전거',
      route: 'reuse',
      fee: 0,
      feeMatchedName: '자전거',
      feeSpec: '성인용(2발)',
      addedAt: at(55),
      status: 'done',
      disposedAt: at(16),
      destination: '지역 자전거 나눔센터 · 기증 완료',
    },
    {
      id: 'done-microwave',
      name: '구형 전자레인지',
      route: 'free',
      fee: 0,
      feeMatchedName: '전자렌지',
      addedAt: at(48),
      status: 'done',
      disposedAt: at(12),
      destination: '폐가전 재활용센터 · 부품 회수',
    },
    {
      id: 'done-fan',
      name: '선풍기 2대',
      route: 'free',
      fee: 0,
      feeMatchedName: '선풍기',
      feeSpec: '소형 (1M미만 가정용)',
      addedAt: at(44),
      status: 'done',
      disposedAt: at(9),
      destination: '폐가전 재활용센터 · 수거 완료',
    },
    {
      id: 'done-desk',
      name: '책상 (편수)',
      route: 'bulk',
      fee: 4000,
      feeMatchedName: '책상',
      feeSpec: '편수',
      addedAt: at(51),
      status: 'done',
      disposedAt: at(5),
      destination: '서대문구 처리장 · 배출 완료',
    },
  ]
}

type ItemsState = {
  items: Item[]
  add: (item: Omit<Item, 'id' | 'addedAt' | 'status'>) => string
  update: (id: string, patch: Partial<Item>) => void
  setStatus: (id: string, status: ItemStatus, destination?: string) => void
  remove: (id: string) => void
  resetToSeed: () => void
  /**
   * 서버에서 받아온 목록을 현재 상태에 병합합니다 (앱 시작 시 1회).
   *
   * ⚠ 통째로 교체하면 안 됩니다. 동기화가 네트워크를 다녀오는 몇 초 사이에
   *   사용자가 사진을 찍어 물건을 추가할 수 있고, 그러면 그 물건이 사라집니다.
   *   같은 id 는 서버 값을 쓰고, 서버에 없는 로컬 물건은 그대로 둡니다.
   */
  mergeRemote: (remote: Item[]) => void
}

/**
 * 서버 반영은 화면을 기다리게 하지 않습니다.
 * Supabase 미연동이면 아무 일도 일어나지 않습니다.
 */
function syncUp(item: Item | undefined) {
  if (item) void pushItem(item)
}

export const useItems = create<ItemsState>()(
  persist(
    (set, get) => ({
      items: seed(Date.now()),

      add: (draft) => {
        const id = crypto.randomUUID()
        const item: Item = {
          ...draft,
          id,
          addedAt: Date.now(),
          status: 'pending',
        }
        set((s) => ({ items: [item, ...s.items] }))
        syncUp(item)
        return id
      },

      update: (id, patch) => {
        let updated: Item | undefined
        set((s) => ({
          items: s.items.map((it) => {
            if (it.id !== id) return it
            updated = { ...it, ...patch }
            return updated
          }),
        }))
        syncUp(updated)
      },

      setStatus: (id, status, destination) => {
        let updated: Item | undefined
        set((s) => ({
          items: s.items.map((it) => {
            if (it.id !== id) return it
            updated = {
              ...it,
              status,
              destination: destination ?? it.destination,
              disposedAt: status === 'done' ? Date.now() : it.disposedAt,
            }
            return updated
          }),
        }))
        syncUp(updated)
      },

      remove: (id) => {
        const target = get().items.find((it) => it.id === id)
        set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
        if (target) void removeRemote(target)
      },

      resetToSeed: () => set({ items: seed(Date.now()) }),

      mergeRemote: (remote) =>
        set((s) => {
          const byId = new Map(s.items.map((i) => [i.id, i]))
          for (const r of remote) byId.set(r.id, r) // 서버 값 우선
          const merged = [...byId.values()]
          merged.sort((a, b) => b.addedAt - a.addedAt)
          return { items: merged }
        }),
    }),
    {
      name: 'bium.items',
      // v2: 리포트 집계를 위한 "처리 완료" 시드 6건 추가 + 소파 수수료를 실제 요금표 값으로 정정
      version: 2,
      migrate: () => ({ items: seed(Date.now()) }),
      // 용량이 넘치면 사진부터 버리고 물건 정보는 지킵니다
      storage: createJSONStorage(resilientLocalStorage),
    },
  ),
)

/* ── 파생 셀렉터 (컴포넌트에서 재사용) ─────────────────────────── */

export function pendingItems(items: Item[]): Item[] {
  return items.filter((i) => i.status !== 'done')
}

/** 방치일수 내림차순 — 오래 기다린 물건이 위로 */
export function byIdleDesc(items: Item[], now = Date.now()): Item[] {
  return [...items].sort((a, b) => daysIdle(b, now) - daysIdle(a, now))
}

export function countByRoute(items: Item[]): Record<RouteId, number> {
  const base: Record<RouteId, number> = { reuse: 0, free: 0, bulk: 0, drop: 0 }
  for (const it of items) base[it.route] += 1
  return base
}
