export type CachedGameweek = {
  gameweekId: string
  number: number
  status: string
  ratings: Record<string, number>
  initialPlayerIds: string[]
}

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const memoryCache = new Map<string, CachedGameweek>()
const pendingLoads = new Map<string, Promise<CachedGameweek>>()

function cacheKey(managerId: string, gameweekId: string) {
  return `draft-league-gameweek:${managerId}:${gameweekId}`
}

function isCachedGameweek(value: unknown, gameweekId: string): value is CachedGameweek {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<CachedGameweek>
  return payload.gameweekId === gameweekId
    && Number.isInteger(payload.number)
    && typeof payload.status === 'string'
    && !!payload.ratings
    && typeof payload.ratings === 'object'
    && !Array.isArray(payload.ratings)
    && Array.isArray(payload.initialPlayerIds)
    && payload.initialPlayerIds.every((playerId) => typeof playerId === 'string')
}

export function readCachedGameweek(managerId: string, gameweekId: string, storage: SessionStore) {
  const key = cacheKey(managerId, gameweekId)
  const memoryValue = memoryCache.get(key)
  if (memoryValue) return memoryValue

  try {
    const storedValue: unknown = JSON.parse(storage.getItem(key) ?? 'null')
    if (!isCachedGameweek(storedValue, gameweekId)) return null
    memoryCache.set(key, storedValue)
    return storedValue
  } catch {
    try {
      storage.removeItem(key)
    } catch {
      // A blocked sessionStorage still leaves the in-memory cache available.
    }
    return null
  }
}

export function storeCachedGameweek(managerId: string, payload: CachedGameweek, storage: SessionStore) {
  const key = cacheKey(managerId, payload.gameweekId)
  memoryCache.set(key, payload)
  try {
    storage.setItem(key, JSON.stringify(payload))
  } catch {
    // The in-memory cache still covers navigation within the open page.
  }
}

export async function loadGameweekOnce({
  managerId,
  gameweekId,
  storage,
  load,
  onCacheMiss,
}: {
  managerId: string
  gameweekId: string
  storage: SessionStore
  load: () => Promise<CachedGameweek>
  onCacheMiss?: () => void
}) {
  const cached = readCachedGameweek(managerId, gameweekId, storage)
  if (cached) return { payload: cached, fromCache: true as const }

  const key = cacheKey(managerId, gameweekId)
  const pending = pendingLoads.get(key)
  if (pending) return { payload: await pending, fromCache: false as const }

  onCacheMiss?.()
  const pendingLoad = load().then((payload) => {
    if (!isCachedGameweek(payload, gameweekId)) throw new Error('Ungültige Gameweek-Daten empfangen.')
    storeCachedGameweek(managerId, payload, storage)
    return payload
  })
  pendingLoads.set(key, pendingLoad)
  try {
    return { payload: await pendingLoad, fromCache: false as const }
  } finally {
    pendingLoads.delete(key)
  }
}
