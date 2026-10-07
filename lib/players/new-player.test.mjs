import assert from 'node:assert/strict'
import test from 'node:test'
import { newPlayerInput } from './new-player.ts'

test('normalizes manually added player data', () => {
  assert.deepEqual(newPlayerInput('  New   Player ', 'MID', ' liv '), {
    display_name: 'New Player',
    position: 'MID',
    club_code: 'LIV',
  })
})
