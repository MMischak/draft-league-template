'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, RefreshCw, TriangleAlert, UsersRound } from 'lucide-react'
import { ClubCrest, ClubIdentity } from '@/components/club-identity'
import { getClubName } from '@/lib/football/clubs'
import { rankRelevantFixtures, type MatchdayFixture } from '@/lib/gameweeks/relevant-fixtures'
import { AVAILABILITY_META, availabilityStatus } from '@/lib/players/availability'

type SquadPlayer = {
  id: string
  display_name: string
  club_code: string
}

export type PlayerInjury = {
  playerId: string
  status: string
  note: string | null
}

type OverviewPayload = {
  fixtures: MatchdayFixture[]
  injuries: PlayerInjury[]
}

const overviewCache = new Map<string, OverviewPayload>()
const CACHE_TTL = 15 * 60 * 1000

function cacheKey(managerId: string, gameweekId: string) {
  return `draft-league-matchday:${managerId}:${gameweekId}`
}

function readSessionCache(key: string) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { savedAt?: number; payload?: OverviewPayload } | null
    if (cached?.savedAt && cached.payload && Date.now() - cached.savedAt < CACHE_TTL) return cached.payload
  } catch {
    sessionStorage.removeItem(key)
  }
  return null
}

function saveSessionCache(key: string, payload: OverviewPayload) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), payload }))
  } catch {
    // In-memory caching still prevents repeat requests while the page is open.
  }
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna',
  }).format(new Date(value))
}

function FixturesSkeleton() {
  return <div aria-label="Spielübersicht wird geladen" className="space-y-3">
    {[0, 1, 2].map((item) => <div key={item} className="surface grid min-h-32 animate-pulse grid-cols-[58px_1fr] overflow-hidden">
      <div className="bg-[#315dc6]/12" />
      <div className="space-y-3 p-5"><div className="h-3 w-32 rounded bg-[#0f1e3a]/8" /><div className="h-7 w-52 rounded bg-[#0f1e3a]/12" /><div className="h-5 w-36 rounded bg-[#0f1e3a]/8" /></div>
    </div>)}
  </div>
}

export function RelevantFixtures({ gameweekId, managerId, squad }: {
  gameweekId: string
  managerId: string
  squad: SquadPlayer[]
}) {
  const key = cacheKey(managerId, gameweekId)
  const [payload, setPayload] = useState<OverviewPayload | null>(() => overviewCache.get(key) ?? null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const cached = overviewCache.get(key) ?? readSessionCache(key)
    if (cached) {
      overviewCache.set(key, cached)
      setPayload(cached)
      return
    }

    setError('')
    fetch(`/api/matchday/overview?gameweekId=${encodeURIComponent(gameweekId)}`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json() as OverviewPayload & { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Die Spielübersicht konnte nicht geladen werden.')
        return body
      })
      .then((body) => {
        if (cancelled) return
        overviewCache.set(key, body)
        saveSessionCache(key, body)
        setPayload(body)
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Die Spielübersicht konnte nicht geladen werden.')
      })

    return () => { cancelled = true }
  }, [attempt, gameweekId, key])

  const rankedFixtures = useMemo(() => rankRelevantFixtures(payload?.fixtures ?? [], squad), [payload, squad])
  const injuryByPlayer = useMemo(() => new Map((payload?.injuries ?? []).map((injury) => [injury.playerId, injury])), [payload])
  const playerById = useMemo(() => new Map(squad.map((player) => [player.id, player])), [squad])

  if (!payload && !error) return <FixturesSkeleton />

  if (error) return <section className="surface grid min-h-64 place-items-center p-6 text-center">
    <div><p className="font-bold text-[#b32131]">{error}</p><button type="button" onClick={() => { overviewCache.delete(key); sessionStorage.removeItem(key); setAttempt((value) => value + 1) }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#315dc6] px-4 py-2.5 text-xs font-bold text-white"><RefreshCw className="size-4" />Erneut laden</button></div>
  </section>

  if (!rankedFixtures.length) return <section className="surface grid min-h-64 place-items-center p-6 text-center"><div><CalendarClock className="mx-auto size-7 text-[#315dc6]" /><p className="mt-3 font-bold">Für diesen Spieltag sind keine Spiele hinterlegt.</p></div></section>

  return <section aria-label="Deine relevantesten Spiele" className="space-y-3">
    {rankedFixtures.map((fixture, index) => {
      const players = fixture.involvedPlayerIds.flatMap((id) => playerById.get(id) ?? [])
      const homePlayers = players.filter((player) => player.club_code === fixture.home_club_code)
      const awayPlayers = players.filter((player) => player.club_code === fixture.away_club_code)
      const hasScore = fixture.home_score !== null && fixture.away_score !== null

      return <article key={fixture.id} className={`surface grid grid-cols-[58px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[72px_minmax(0,1fr)] ${fixture.relevance === 0 ? 'opacity-55' : ''}`}>
        <div className={`flex flex-col items-center justify-center border-r border-white/12 px-2 text-white ${fixture.relevance > 0 ? 'bg-[#315dc6]' : 'bg-[#0f1e3a]'}`}>
          <span className="font-serif text-3xl font-black leading-none sm:text-4xl">{index + 1}</span>
          <span className="mt-1 font-mono text-[8px] font-bold uppercase tracking-widest text-white/55">Rang</span>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#0f1e3a]/42">{formatKickoff(fixture.kickoff_at)}</p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                <ClubIdentity code={fixture.home_club_code} size={34} nameClassName="text-xs font-black leading-tight sm:text-sm" />
                {hasScore ? <span className="whitespace-nowrap font-serif text-2xl font-black">{fixture.home_score} : {fixture.away_score}</span> : <span className="font-serif text-sm font-black text-[#0f1e3a]/32">gegen</span>}
                <ClubIdentity code={fixture.away_club_code} size={34} className="justify-end text-right" nameClassName="text-xs font-black leading-tight sm:text-sm" />
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${fixture.relevance > 0 ? 'bg-[#e9f5ec] text-[#236845]' : 'bg-[#0f1e3a]/6 text-[#0f1e3a]/45'}`}><UsersRound className="size-3.5" />{fixture.relevance} aus deinem Kader</span>
          </div>

          {players.length ? <div className="mt-4 flex flex-wrap gap-2">
            {[...homePlayers, ...awayPlayers].map((player) => {
              const injury = injuryByPlayer.get(player.id)
              const meta = injury ? AVAILABILITY_META[availabilityStatus(injury.status, true)] : null
              return <span key={player.id} title={injury?.note ?? getClubName(player.club_code)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta ? `${meta.borderClass} ${meta.surfaceClass} ${meta.textClass}` : 'border-[#0f1e3a]/10 bg-white/60 text-[#0f1e3a]/72'}`}>
                <ClubCrest code={player.club_code} size={16} />{meta && <TriangleAlert className="size-3.5" />}{player.display_name}{meta && <span className="font-mono text-[8px] font-black">{meta.shortLabel}</span>}<span className="text-[9px] font-semibold opacity-45">{getClubName(player.club_code)}</span>
              </span>
            })}
          </div> : <p className="mt-4 text-xs font-semibold text-[#0f1e3a]/38">Kein Spieler aus deinem Kader.</p>}
        </div>
      </article>
    })}
  </section>
}
