import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSeasonStatistics } from './season.ts'

test('parses the compact season statistics payload', () => {
  const statistics = parseSeasonStatistics({
    managerCount: 5,
    playedGameweeks: 2,
    scoredLineups: 10,
    topLineups: [{ managerId: 'a', managerName: 'Anna', gameweekNumber: 2, score: 82.4 }],
    bottomLineups: [{ managerId: 'b', managerName: 'Ben', gameweekNumber: 1, score: 41.2 }],
    managers: [{ managerId: 'a', managerName: 'Anna', played: 2, total: 140, average: 70, benchPoints: 24, efficiency: 85.4, deviation: 4.2, wins: 1 }],
    players: [{ playerId: 'p', playerName: 'Player', clubCode: 'ARS', position: 'MID', managerId: 'a', managerName: 'Anna', points: 17.5, gameweeks: 2 }],
    records: {
      mostWins: { managerId: 'a', managerName: 'Anna', value: 1 },
      mostConsistent: { managerId: 'a', managerName: 'Anna', value: 4.2 },
      bestPlayerGameweek: { playerId: 'p', playerName: 'Player', clubCode: 'ARS', managerId: 'a', managerName: 'Anna', gameweekNumber: 2, score: 9.1 },
    },
  })

  assert.equal(statistics.topLineups[0].score, 82.4)
  assert.equal(statistics.managers[0].efficiency, 85.4)
  assert.equal(statistics.records.bestPlayerGameweek?.gameweekNumber, 2)
})

test('uses safe empty defaults for missing statistics', () => {
  const statistics = parseSeasonStatistics(null)

  assert.equal(statistics.playedGameweeks, 0)
  assert.deepEqual(statistics.topLineups, [])
  assert.deepEqual(statistics.managers, [])
  assert.equal(statistics.records.mostConsistent, null)
})
