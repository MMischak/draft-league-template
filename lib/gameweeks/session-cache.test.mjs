import assert from 'node:assert/strict'
import test from 'node:test'
import { loadGameweekOnce, readCachedGameweek, storeCachedGameweek } from './session-cache.ts'

function createStorage() {
  const entries = new Map()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

function payload(gameweekId, number = 2) {
  return {
    gameweekId,
    number,
    status: 'lineup',
    ratings: { player: 7.4 },
    initialPlayerIds: ['player'],
  }
}

test('loads a gameweek once and serves later visits from the session cache', async () => {
  const storage = createStorage()
  let loads = 0
  let misses = 0
  const options = {
    managerId: 'manager-cache-test',
    gameweekId: 'gameweek-cache-test',
    storage,
    load: async () => {
      loads += 1
      return payload('gameweek-cache-test')
    },
    onCacheMiss: () => { misses += 1 },
  }

  const first = await loadGameweekOnce(options)
  const second = await loadGameweekOnce(options)

  assert.equal(first.fromCache, false)
  assert.equal(second.fromCache, true)
  assert.equal(loads, 1)
  assert.equal(misses, 1)
  assert.deepEqual(second.payload, first.payload)
  assert.deepEqual(JSON.parse(storage.getItem('draft-league-gameweek:manager-cache-test:gameweek-cache-test')), first.payload)
})

test('keeps cached gameweeks isolated by manager and gameweek', () => {
  const storage = createStorage()
  storeCachedGameweek('manager-one', payload('gameweek-one', 1), storage)

  assert.equal(readCachedGameweek('manager-one', 'gameweek-two', storage), null)
  assert.equal(readCachedGameweek('manager-two', 'gameweek-one', storage), null)
  assert.equal(readCachedGameweek('manager-one', 'gameweek-one', storage)?.number, 1)
})

test('deduplicates two simultaneous requests for the same gameweek', async () => {
  const storage = createStorage()
  let loads = 0
  const options = {
    managerId: 'manager-pending-test',
    gameweekId: 'gameweek-pending-test',
    storage,
    load: async () => {
      loads += 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      return payload('gameweek-pending-test')
    },
  }

  const [first, second] = await Promise.all([
    loadGameweekOnce(options),
    loadGameweekOnce(options),
  ])

  assert.equal(loads, 1)
  assert.deepEqual(first.payload, second.payload)
})
