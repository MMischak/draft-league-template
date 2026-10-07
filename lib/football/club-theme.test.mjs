import assert from 'node:assert/strict'
import test from 'node:test'
import { getClubTheme } from './club-theme.ts'

test('returns the club palette regardless of code casing', () => {
  assert.deepEqual(getClubTheme('liv'), {
    primary: '#C8102E',
    secondary: '#00B2A9',
    foreground: '#FFFFFF',
  })
})

test('returns a stable fallback palette for an unknown club', () => {
  assert.deepEqual(getClubTheme('NEWCODE'), getClubTheme(' newcode '))
})
