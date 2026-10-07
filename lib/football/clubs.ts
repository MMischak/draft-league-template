export type ClubIdentity = {
  code: string
  name: string
  crestPath: string
}

const CLUBS: Record<string, ClubIdentity> = Object.fromEntries([
  ['ARS', 'Arsenal FC'],
  ['AVL', 'Aston Villa'],
  ['BHA', 'Brighton & Hove Albion'],
  ['BOU', 'AFC Bournemouth'],
  ['BRE', 'Brentford FC'],
  ['CHE', 'Chelsea FC'],
  ['COV', 'Coventry City'],
  ['CRY', 'Crystal Palace'],
  ['EVE', 'Everton FC'],
  ['FUL', 'Fulham FC'],
  ['HUL', 'Hull City'],
  ['IPS', 'Ipswich Town'],
  ['LEE', 'Leeds United'],
  ['LIV', 'Liverpool FC'],
  ['MCI', 'Manchester City'],
  ['MUN', 'Manchester United'],
  ['NEW', 'Newcastle United'],
  ['NFO', 'Nottingham Forest'],
  ['SUN', 'Sunderland AFC'],
  ['TOT', 'Tottenham Hotspur'],
].map(([code, name]) => [code, { code, name, crestPath: `/clubs/2026-27/${code}.webp` }]))

export const ACTIVE_CLUBS = Object.values(CLUBS)

export function getClubIdentity(clubCode: string): ClubIdentity {
  const code = clubCode.trim().toUpperCase()
  return CLUBS[code] ?? { code, name: code || 'Unbekannter Club', crestPath: '/placeholder-logo.svg' }
}

export function getClubName(clubCode: string) {
  return getClubIdentity(clubCode).name
}
