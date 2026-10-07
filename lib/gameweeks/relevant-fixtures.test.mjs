import assert from 'node:assert/strict'
import test from 'node:test'
import { rankRelevantFixtures } from './relevant-fixtures.ts'

const fixture = (id, home, away, kickoff) => ({
  id,
  home_club_code: home,
  away_club_code: away,
  kickoff_at: kickoff,
  home_score: null,
  away_score: null,
})

test('ranks fixtures by involved squad players and then kickoff', () => {
  const fixtures = [
    fixture('late', 'LIV', 'TOT', '2026-08-22T16:30:00Z'),
    fixture('most', 'ARS', 'CHE', '2026-08-23T14:00:00Z'),
    fixture('early', 'MCI', 'MUN', '2026-08-22T11:30:00Z'),
  ]
  const squad = [
    { id: 'saka', club_code: 'ARS' },
    { id: 'palmer', club_code: 'CHE' },
    { id: 'salah', club_code: 'LIV' },
    { id: 'haaland', club_code: 'MCI' },
  ]

  const ranked = rankRelevantFixtures(fixtures, squad)

  assert.deepEqual(ranked.map(({ id, relevance }) => ({ id, relevance })), [
    { id: 'most', relevance: 2 },
    { id: 'early', relevance: 1 },
    { id: 'late', relevance: 1 },
  ])
  assert.deepEqual(ranked[0].involvedPlayerIds, ['saka', 'palmer'])
})

test('places fixtures without squad players at the end', () => {
  const ranked = rankRelevantFixtures([
    fixture('none', 'EVE', 'FUL', '2026-08-22T11:30:00Z'),
    fixture('relevant', 'ARS', 'CHE', '2026-08-23T14:00:00Z'),
  ], [{ id: 'saka', club_code: 'ARS' }])

  assert.deepEqual(ranked.map(({ id }) => id), ['relevant', 'none'])
})
