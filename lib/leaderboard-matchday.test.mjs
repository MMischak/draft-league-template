import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCurrentMatchdayRows } from './leaderboard-matchday.ts'

const managers = [
  { managerId: 'a', displayName: 'Anna', score: 14, isViewer: true },
  { managerId: 'b', displayName: 'Ben', score: 18, isViewer: false },
  { managerId: 'c', displayName: 'Chris', score: 14, isViewer: false },
]

test('orders managers by current score and assigns competition ranks', () => {
  const rows = buildCurrentMatchdayRows(managers, [], [])

  assert.deepEqual(rows.map((row) => [row.managerId, row.rank]), [['b', 1], ['a', 2], ['c', 2]])
})

test('counts only starters whose club still has an unfinished fixture', () => {
  const rows = buildCurrentMatchdayRows(managers, [{
    managerId: 'a',
    players: [
      { playerId: 'starter-open', clubCode: 'ARS', isStarter: true },
      { playerId: 'bench-open', clubCode: 'ARS', isStarter: false },
      { playerId: 'starter-done', clubCode: 'CHE', isStarter: true },
    ],
  }], [
    { homeClubCode: 'ARS', awayClubCode: 'LIV', kickoffAt: '2026-08-31T19:00:00Z', finished: false },
    { homeClubCode: 'CHE', awayClubCode: 'MCI', kickoffAt: '2026-08-30T14:00:00Z', finished: true },
  ], Date.parse('2026-08-31T20:00:00Z'))

  assert.equal(rows.find((row) => row.managerId === 'a')?.remainingPlayers, 1)
})

test('counts a starter only once across duplicate or double-gameweek fixtures', () => {
  const rows = buildCurrentMatchdayRows(managers, [{
    managerId: 'b',
    players: [
      { playerId: 'same-player', clubCode: 'LIV', isStarter: true },
      { playerId: 'same-player', clubCode: 'LIV', isStarter: true },
    ],
  }], [
    { homeClubCode: 'LIV', awayClubCode: 'ARS', kickoffAt: '2026-08-31T19:00:00Z', finished: false },
    { homeClubCode: 'CHE', awayClubCode: 'LIV', kickoffAt: '2026-09-03T19:00:00Z', finished: false },
  ], Date.parse('2026-08-31T20:00:00Z'))

  assert.equal(rows.find((row) => row.managerId === 'b')?.remainingPlayers, 1)
})

test('does not keep players open forever when a stale fixture flag was never refreshed', () => {
  const rows = buildCurrentMatchdayRows(managers, [{
    managerId: 'a',
    players: [{ playerId: 'starter', clubCode: 'ARS', isStarter: true }],
  }], [{
    homeClubCode: 'ARS',
    awayClubCode: 'CHE',
    kickoffAt: '2026-08-28T19:00:00Z',
    finished: false,
  }], Date.parse('2026-08-29T01:00:00Z'))

  assert.equal(rows.find((row) => row.managerId === 'a')?.remainingPlayers, 0)
})
