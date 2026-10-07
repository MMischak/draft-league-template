import assert from 'node:assert/strict'
import test from 'node:test'
import { moveDraftManager, pickNumberForManagerColumn } from './snake-order.ts'

test('keeps manager columns fixed while snake rounds reverse', () => {
  const row = (round) => Array.from({ length: 5 }, (_, column) => pickNumberForManagerColumn(round, column))

  assert.deepEqual(row(1), [1, 2, 3, 4, 5])
  assert.deepEqual(row(2), [10, 9, 8, 7, 6])
  assert.deepEqual(row(3), [11, 12, 13, 14, 15])
})

test('shows each manager picks in the same column across rounds', () => {
  assert.deepEqual(
    Array.from({ length: 4 }, (_, round) => pickNumberForManagerColumn(round + 1, 0)),
    [1, 10, 11, 20],
  )
  assert.deepEqual(
    Array.from({ length: 4 }, (_, round) => pickNumberForManagerColumn(round + 1, 4)),
    [5, 6, 15, 16],
  )
})

test('moves managers without mutating the stored order', () => {
  const managers = ['A', 'B', 'C', 'D', 'E']

  assert.deepEqual(moveDraftManager(managers, 2, 1), ['A', 'C', 'B', 'D', 'E'])
  assert.deepEqual(managers, ['A', 'B', 'C', 'D', 'E'])
  assert.deepEqual(moveDraftManager(managers, 0, -1), managers)
})
