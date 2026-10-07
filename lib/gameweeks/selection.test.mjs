import assert from 'node:assert/strict'
import test from 'node:test'
import { selectGameweek } from './selection.ts'

const gameweeks = [
  { id: 'one', number: 1, status: 'live' },
  { id: 'two', number: 2, status: 'pending' },
  { id: 'three', number: 3, status: 'pending' },
]

test('selects an explicitly requested future gameweek', () => {
  assert.equal(selectGameweek(gameweeks, '3')?.id, 'three')
})

test('falls back to the first unfinished gameweek', () => {
  assert.equal(selectGameweek(gameweeks, undefined)?.id, 'one')
  assert.equal(selectGameweek(gameweeks, '99')?.id, 'one')
})

test('falls back to the latest gameweek after the season', () => {
  assert.equal(selectGameweek(gameweeks.map((gameweek) => ({ ...gameweek, status: 'final' })), undefined)?.id, 'three')
})
