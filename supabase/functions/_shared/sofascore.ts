export type LocalFixture = {
  id: string
  home_club_code: string
  away_club_code: string
  kickoff_at: string
}

export type ExternalTeam = { id: number; name: string; shortName?: string }
export type ExternalEvent = {
  id: number
  kickoff: string
  pageUrl: string
  homeTeam: ExternalTeam
  awayTeam: ExternalTeam
  finished: boolean
}

export type LocalPlayer = { id: string; display_name: string; club_code: string }
export type ExternalPlayer = { id: number; name: string; rating: number | null }

const clubAliases: Record<string, string[]> = {
  ARS: ['arsenal'], AVL: ['aston villa'], BHA: ['brighton', 'brighton hove albion'],
  BOU: ['bournemouth', 'afc bournemouth'], BRE: ['brentford'], CHE: ['chelsea'],
  COV: ['coventry', 'coventry city'], CRY: ['crystal palace'], EVE: ['everton'],
  FUL: ['fulham'], HUL: ['hull', 'hull city'], IPS: ['ipswich', 'ipswich town'],
  LEE: ['leeds', 'leeds united'], LIV: ['liverpool'], MCI: ['manchester city', 'man city'],
  MUN: ['manchester united', 'man united'], NEW: ['newcastle', 'newcastle united'],
  NFO: ['nottingham forest', 'nottm forest'], SUN: ['sunderland'],
  TOT: ['tottenham', 'tottenham hotspur', 'spurs'],
}

export function normalizeText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/ł/g, 'l').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function teamMatchesClub(team: ExternalTeam, clubCode: string) {
  const names = new Set([team.name, team.shortName].filter(Boolean).map((name) => normalizeText(name!)))
  return (clubAliases[clubCode.toUpperCase()] ?? [clubCode]).map(normalizeText).some((alias) => names.has(alias))
}

export function matchFixture(fixture: LocalFixture, events: ExternalEvent[]) {
  const teamMatches = events.filter((event) => teamMatchesClub(event.homeTeam, fixture.home_club_code)
    && teamMatchesClub(event.awayTeam, fixture.away_club_code))
  if (teamMatches.length === 1) return teamMatches[0]

  const kickoff = Date.parse(fixture.kickoff_at)
  const nearbyMatches = teamMatches.filter((event) => Math.abs(Date.parse(event.kickoff) - kickoff) <= 6 * 60 * 60 * 1000)
  return nearbyMatches.length === 1 ? nearbyMatches[0] : null
}

export function matchPlayer(players: LocalPlayer[], externalPlayer: ExternalPlayer, clubCode: string) {
  const name = normalizeText(externalPlayer.name)
  const matches = players.filter((player) => {
    const localName = normalizeText(player.display_name)
    return player.club_code === clubCode && (localName === name || localName.startsWith(`${name} `) || localName.endsWith(` ${name}`))
  })
  return matches.length === 1 ? matches[0] : null
}

export function parseRating(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 0 && rating <= 10 ? Math.round(rating * 10) / 10 : null
}

function nextData(html: string) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('Die Seite enthält keine eingebetteten Spieldaten.')
  return JSON.parse(match[1]) as Record<string, any>
}

export function parseFotMobFixtures(html: string, round: number): ExternalEvent[] {
  const matches = nextData(html)?.props?.pageProps?.fixtures?.allMatches
  if (!Array.isArray(matches)) return []
  return matches.filter((match) => Number(match?.round) === round).map((match) => ({
    id: Number(match.id),
    kickoff: String(match.status?.utcTime ?? ''),
    pageUrl: String(match.pageUrl ?? '').split('#')[0],
    homeTeam: { id: Number(match.home?.id), name: String(match.home?.name ?? ''), shortName: match.home?.shortName },
    awayTeam: { id: Number(match.away?.id), name: String(match.away?.name ?? ''), shortName: match.away?.shortName },
    finished: match.status?.finished === true,
  })).filter((match) => Number.isFinite(match.id) && match.kickoff && match.pageUrl)
}

function lineupPlayers(team: any): ExternalPlayer[] {
  return [...(Array.isArray(team?.starters) ? team.starters : []), ...(Array.isArray(team?.subs) ? team.subs : [])]
    .map((player) => ({ id: Number(player?.id), name: String(player?.name ?? ''), rating: parseRating(player?.performance?.rating) }))
    .filter((player) => Number.isFinite(player.id) && player.name && player.rating !== null)
}

export function parseFotMobLineup(html: string) {
  const lineup = nextData(html)?.props?.pageProps?.content?.lineup
  return { home: lineupPlayers(lineup?.homeTeam), away: lineupPlayers(lineup?.awayTeam) }
}
