import assert from 'node:assert/strict'
import test from 'node:test'
import { createLineupSlots, inferFormation, resizeLineupSlots, selectedLineupIds } from './formations.ts'

test('infers a saved valid formation and otherwise uses 4-4-2', () => {
  assert.equal(inferFormation(['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']), '3-5-2')
  assert.equal(inferFormation(['GK', 'DEF']), '4-4-2')
})

test('creates empty formation slots around selected players', () => {
  const slots = createLineupSlots('4-3-3', [
    { id: 'keeper', position: 'GK' },
    { id: 'defender', position: 'DEF' },
    { id: 'forward', position: 'FWD' },
  ])

  assert.deepEqual(slots.GK, ['keeper'])
  assert.deepEqual(slots.DEF, ['defender', null, null, null])
  assert.deepEqual(slots.MID, [null, null, null])
  assert.deepEqual(slots.FWD, ['forward', null, null])
})

test('keeps fitting players and moves excess players to the bench when formation changes', () => {
  const original = {
    GK: ['gk'],
    DEF: ['d1', 'd2', 'd3', 'd4'],
    MID: ['m1', 'm2', 'm3', 'm4'],
    FWD: ['f1', 'f2'],
  }
  const resized = resizeLineupSlots(original, '3-5-2')

  assert.deepEqual(resized.DEF, ['d1', 'd2', 'd3'])
  assert.deepEqual(resized.MID, ['m1', 'm2', 'm3', 'm4', null])
  assert.deepEqual(selectedLineupIds(resized), ['gk', 'd1', 'd2', 'd3', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2'])
})
