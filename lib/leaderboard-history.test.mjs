import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLeaderboardHistory } from './leaderboard-history.ts'

const managers = [
  { managerId: 'a', displayName: 'Anna', isViewer: true },
  { managerId: 'b', displayName: 'Ben', isViewer: false },
  { managerId: 'c', displayName: 'Chris', isViewer: false },
]

test('builds cumulative rank and score history in gameweek order', () => {
  const history = buildLeaderboardHistory(
    managers,
    [{ id: 'gw2', number: 2 }, { id: 'gw1', number: 1 }],
    [
      { managerId: 'a', gameweekId: 'gw1', score: 8 },
      { managerId: 'b', gameweekId: 'gw1', score: 10 },
      { managerId: 'c', gameweekId: 'gw1', score: 6 },
      { managerId: 'a', gameweekId: 'gw2', score: 7 },
      { managerId: 'b', gameweekId: 'gw2', score: 2 },
      { managerId: 'c', gameweekId: 'gw2', score: 10 },
    ],
  )

  assert.deepEqual(history[0].points, [
    { gameweekId: 'gw1', gameweekNumber: 1, score: 8, total: 8, rank: 2 },
    { gameweekId: 'gw2', gameweekNumber: 2, score: 7, total: 15, rank: 2 },
  ])
  assert.equal(history[1].points[1].rank, 3)
  assert.equal(history[2].points[1].rank, 1)
})

test('uses zero for missing manager scores and keeps competition ranks for ties', () => {
  const history = buildLeaderboardHistory(
    managers,
    [{ id: 'gw1', number: 1 }],
    [{ managerId: 'a', gameweekId: 'gw1', score: 5 }],
  )

  assert.equal(history[0].points[0].rank, 1)
  assert.equal(history[1].points[0].score, 0)
  assert.equal(history[1].points[0].rank, 2)
  assert.equal(history[2].points[0].rank, 2)
})

test('omits gameweeks without any calculated score', () => {
  const history = buildLeaderboardHistory(
    managers,
    [{ id: 'gw1', number: 1 }, { id: 'gw2', number: 2 }],
    [{ managerId: 'a', gameweekId: 'gw1', score: 5 }],
  )

  assert.equal(history[0].points.length, 1)
  assert.equal(history[0].points[0].gameweekId, 'gw1')
})
