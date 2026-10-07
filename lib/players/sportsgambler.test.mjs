import test from 'node:test'
import assert from 'node:assert/strict'
import {
  availabilityNote,
  matchPickedPlayerAvailability,
  parseSportsgamblerReport,
} from '../../supabase/functions/_shared/injuries.ts'

const html = `
  <div class="injury-block">
    <h3 class="injuries-title"><a href="/news/arsenal/">Arsenal</a></h3>
    <div class="inj-row"><div class="inj-container">
      <span class="inj-type injury-plus"></span><span class="inj-player">Martin Odegaard</span>
      <span class="inj-info">Ankle</span><span class="inj-return h-sm">2026-09-12</span>
    </div></div>
    <div class="inj-row"><div class="inj-container">
      <span class="inj-type injury-questionmark"></span><span class="inj-player">William Saliba</span>
      <span class="inj-info">Knock</span><span class="inj-return h-sm">-</span>
    </div></div>
  </div>
  <div class="injury-block">
    <h3 class="injuries-title"><a href="/news/liverpool/">Liverpool</a></h3>
    <div class="inj-row"><div class="inj-container">
      <span class="inj-type injury-plus"></span><span class="inj-player">Alex Example</span>
      <span class="inj-info">Suspended - red card</span><span class="inj-return h-sm">2026-09-20</span>
    </div></div>
  </div>`

test('parses out, questionable and suspended players by club', () => {
  const report = parseSportsgamblerReport(html)
  assert.deepEqual(report.clubs, ['ARS', 'LIV'])
  assert.deepEqual(report.entries.map(({ clubCode, name, status }) => ({ clubCode, name, status })), [
    { clubCode: 'ARS', name: 'Martin Odegaard', status: 'out' },
    { clubCode: 'ARS', name: 'William Saliba', status: 'questionable' },
    { clubCode: 'LIV', name: 'Alex Example', status: 'suspended' },
  ])
  assert.equal(availabilityNote(report.entries[0]), 'Nicht verfügbar · Ankle · Rückkehr: 2026-09-12')
})

test('matches only picked players and normalizes accents', () => {
  const report = parseSportsgamblerReport(html)
  const matches = matchPickedPlayerAvailability([
    { id: 'picked', display_name: 'Martin Ødegaard', club_code: 'ARS' },
    { id: 'healthy', display_name: 'Bukayo Saka', club_code: 'ARS' },
  ], report.entries)
  assert.equal(matches.size, 1)
  assert.equal(matches.get('picked')?.status, 'out')
})
