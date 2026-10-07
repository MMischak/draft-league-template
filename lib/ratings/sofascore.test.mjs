import assert from 'node:assert/strict'
import test from 'node:test'
import { matchFixture, matchPlayer, normalizeText, parseFotMobFixtures, parseFotMobLineup, parseRating } from '../../supabase/functions/_shared/sofascore.ts'

test('normalizes accents and punctuation', () => {
  assert.equal(normalizeText('João Pedro!'), 'joao pedro')
})

test('matches a fixture by clubs and nearby kickoff', () => {
  const fixture = { id: 'fixture', home_club_code: 'MCI', away_club_code: 'MUN', kickoff_at: '2026-08-22T14:00:00Z' }
  const event = {
    id: 42,
    kickoff: '2026-08-22T14:00:00Z',
    pageUrl: '/matches/example',
    homeTeam: { id: 1, name: 'Manchester City' },
    awayTeam: { id: 2, name: 'Manchester United' },
    finished: true,
  }
  assert.equal(matchFixture(fixture, [event])?.id, 42)
})

test('matches a uniquely identified fixture after its kickoff was rescheduled', () => {
  const fixture = { id: 'fixture', home_club_code: 'MCI', away_club_code: 'SUN', kickoff_at: '2026-09-19T14:00:00Z' }
  const event = {
    id: 5795461,
    kickoff: '2026-09-20T13:00:00Z',
    pageUrl: '/matches/manchester-city-vs-sunderland',
    homeTeam: { id: 1, name: 'Manchester City', shortName: 'Man City' },
    awayTeam: { id: 2, name: 'Sunderland', shortName: 'Sunderland' },
    finished: true,
  }

  assert.equal(matchFixture(fixture, [event])?.id, 5795461)
})

test('does not guess between ambiguous fixture matches', () => {
  const fixture = { id: 'fixture', home_club_code: 'ARS', away_club_code: 'CHE', kickoff_at: '2026-08-22T14:00:00Z' }
  const event = {
    id: 1,
    kickoff: fixture.kickoff_at,
    pageUrl: '/matches/example',
    homeTeam: { id: 1, name: 'Arsenal' },
    awayTeam: { id: 2, name: 'Chelsea' },
    finished: true,
  }
  assert.equal(matchFixture(fixture, [event, { ...event, id: 2 }]), null)
})

test('matches a player only when name and club are unique', () => {
  const players = [
    { id: 'one', display_name: 'João Pedro', club_code: 'CHE' },
    { id: 'two', display_name: 'João Pedro', club_code: 'BHA' },
  ]
  assert.equal(matchPlayer(players, { id: 99, name: 'Joao Pedro', rating: 7.2 }, 'CHE')?.id, 'one')
  assert.equal(matchPlayer([{ id: 'raya', display_name: 'David Raya Martín', club_code: 'ARS' }], { id: 1, name: 'David Raya', rating: 7.3 }, 'ARS')?.id, 'raya')
})

test('validates ratings', () => {
  assert.equal(parseRating('7.34'), 7.3)
  assert.equal(parseRating(11), null)
  assert.equal(parseRating(undefined), null)
})

test('extracts only fixtures and rated lineup players from FotMob HTML', () => {
  const league = html({ fixtures: { allMatches: [{
    round: '1', id: '42', pageUrl: '/matches/example#42', home: { id: '1', name: 'Arsenal' },
    away: { id: '2', name: 'Chelsea' }, status: { utcTime: '2026-08-22T14:00:00Z', finished: true },
  }] } })
  assert.deepEqual(parseFotMobFixtures(league, 1)[0], {
    id: 42, kickoff: '2026-08-22T14:00:00Z', pageUrl: '/matches/example',
    homeTeam: { id: 1, name: 'Arsenal', shortName: undefined },
    awayTeam: { id: 2, name: 'Chelsea', shortName: undefined }, finished: true,
  })

  const match = html({ content: { lineup: {
    homeTeam: { starters: [{ id: 9, name: 'Player One', performance: { rating: 8.24 } }] },
    awayTeam: { subs: [{ id: 10, name: 'No Rating', performance: {} }] },
  } } })
  assert.deepEqual(parseFotMobLineup(match), { home: [{ id: 9, name: 'Player One', rating: 8.2 }], away: [] })
})

function html(pageProps) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script>`
}
