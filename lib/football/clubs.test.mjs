import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTIVE_CLUBS, getClubIdentity, getClubName } from './clubs.ts'

test('provides one local crest and full name for every active club', () => {
  assert.equal(ACTIVE_CLUBS.length, 20)
  assert.equal(new Set(ACTIVE_CLUBS.map((club) => club.code)).size, 20)
  assert.ok(ACTIVE_CLUBS.every((club) => club.name.length > club.code.length))
  assert.ok(ACTIVE_CLUBS.every((club) => club.crestPath === `/clubs/2026-27/${club.code}.webp`))
})

test('normalizes club codes and falls back safely', () => {
  assert.equal(getClubName(' mun '), 'Manchester United')
  assert.deepEqual(getClubIdentity('XYZ'), {
    code: 'XYZ',
    name: 'XYZ',
    crestPath: '/placeholder-logo.svg',
  })
})
