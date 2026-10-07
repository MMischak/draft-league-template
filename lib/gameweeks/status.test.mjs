import assert from 'node:assert/strict'
import test from 'node:test'
import { isLineupEditable, isLineupOpen } from './status.ts'

test('opens lineups only through the manual lineup status', () => {
  assert.equal(isLineupOpen('pending'), false)
  assert.equal(isLineupOpen('lineup'), true)
  assert.equal(isLineupOpen('live'), false)
  assert.equal(isLineupOpen('final'), false)
})

test('allows planning before a gameweek starts but locks live and final weeks', () => {
  assert.equal(isLineupEditable('pending'), true)
  assert.equal(isLineupEditable('lineup'), true)
  assert.equal(isLineupEditable('live'), false)
  assert.equal(isLineupEditable('final'), false)
})
