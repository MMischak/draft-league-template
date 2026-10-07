import { matchPlayer, normalizeText, type LocalPlayer } from './sofascore.ts'

export type AvailabilityStatus = 'questionable' | 'out' | 'suspended'

export type ExternalAvailability = {
  clubCode: string
  name: string
  status: AvailabilityStatus
  info: string | null
  expectedReturn: string | null
}

const clubCodeByName = new Map(Object.entries({
  ARS: ['arsenal'], AVL: ['aston villa'], BHA: ['brighton'], BOU: ['bournemouth'],
  BRE: ['brentford'], CHE: ['chelsea'], COV: ['coventry'], CRY: ['crystal palace'],
  EVE: ['everton'], FUL: ['fulham'], HUL: ['hull'], IPS: ['ipswich'], LEE: ['leeds'],
  LIV: ['liverpool'], MCI: ['man city', 'manchester city'], MUN: ['man united', 'manchester united'],
  NEW: ['newcastle'], NFO: ['nott m forest', 'nottingham forest'], SUN: ['sunderland'],
  TOT: ['tottenham'],
}).flatMap(([code, names]) => names.map((name) => [normalizeText(name), code])))

function decodeHtml(value: string) {
  const decoded = value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#039;/gi, "'")
  return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function field(row: string, className: string) {
  const match = row.match(new RegExp(`<span[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, 'i'))
  return match ? decodeHtml(match[1]) : ''
}

export function clubCodeFromSourceName(name: string) {
  return clubCodeByName.get(normalizeText(name)) ?? null
}

export function parseSportsgamblerReport(html: string) {
  const clubs = new Set<string>()
  const entries: ExternalAvailability[] = []

  for (const section of html.split(/<div\s+class=["'][^"']*\binjury-block\b[^"']*["'][^>]*>/i).slice(1)) {
    const clubMatch = section.match(/<h3[^>]*class=["'][^"']*\binjuries-title\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
    const clubCode = clubMatch ? clubCodeFromSourceName(decodeHtml(clubMatch[1])) : null
    if (!clubCode) continue
    clubs.add(clubCode)

    for (const row of section.split(/<div\s+class=["'][^"']*\binj-row\b[^"']*["'][^>]*>/i).slice(1)) {
      const typeClass = row.match(/<span[^>]*class=["'][^"']*\binj-type\b([^"']*)["'][^>]*>/i)?.[1] ?? ''
      const name = field(row, 'inj-player')
      if (!name || (!typeClass.includes('injury-plus') && !typeClass.includes('injury-questionmark'))) continue

      const info = field(row, 'inj-info') || null
      const expectedReturn = field(row, 'inj-return') || null
      const suspension = /suspend|ban|red card|yellow card/i.test(`${info ?? ''} ${name}`)
      entries.push({
        clubCode,
        name,
        status: suspension ? 'suspended' : typeClass.includes('injury-questionmark') ? 'questionable' : 'out',
        info,
        expectedReturn: expectedReturn === '-' ? null : expectedReturn,
      })
    }
  }

  return { clubs: [...clubs], entries }
}

const statusPriority: Record<AvailabilityStatus, number> = { questionable: 1, out: 2, suspended: 3 }

export function matchPickedPlayerAvailability(players: LocalPlayer[], entries: ExternalAvailability[]) {
  const matched = new Map<string, ExternalAvailability>()
  for (const entry of entries) {
    const player = matchPlayer(players, { id: 0, name: entry.name, rating: null }, entry.clubCode)
    if (!player) continue
    const existing = matched.get(player.id)
    if (!existing || statusPriority[entry.status] > statusPriority[existing.status]) matched.set(player.id, entry)
  }
  return matched
}

export function availabilityNote(entry: ExternalAvailability) {
  const label = entry.status === 'suspended' ? 'Gesperrt' : entry.status === 'questionable' ? 'Fraglich' : 'Nicht verfügbar'
  return [label, entry.info, entry.expectedReturn ? `Rückkehr: ${entry.expectedReturn}` : null].filter(Boolean).join(' · ').slice(0, 160)
}
