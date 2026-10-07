import assert from 'node:assert/strict'
import test from 'node:test'
import { managerNameToEmail, normalizeManagerName } from './manager-login.ts'
test('normalizes manager names for tolerant login', () => {
  assert.equal(normalizeManagerName('  Riley   Example  '), 'riley example')
  assert.equal(normalizeManagerName('RＩLEY'), 'riley')
})
test('creates one stable internal email for equivalent manager names', async () => {
  assert.equal(await managerNameToEmail('Riley Example'), await managerNameToEmail('  RILEY   EXAMPLE '))
  assert.match(await managerNameToEmail('Riley Example'), /^manager-[a-f0-9]{48}@manager\.example\.invalid$/)
})
test('rejects an empty manager name', async () => {
  await assert.rejects(managerNameToEmail('   '), /Manager name is required/)
})
