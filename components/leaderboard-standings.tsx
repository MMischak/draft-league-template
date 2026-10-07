'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Shirt, X } from 'lucide-react'
import { ClubCrest } from '@/components/club-identity'
import { CurrentMatchdayStandings } from '@/components/current-matchday-standings'
import { getClubTheme } from '@/lib/football/club-theme'
import { createLineupSlots, inferFormation, type LineupPosition } from '@/lib/gameweeks/formations'
import type { MatchdayRow } from '@/lib/leaderboard-matchday'

type Standing = {
  managerId: string
  displayName: string
  rank: number
  week: number
  total: number
  isViewer: boolean
}

type Gameweek = { id: string; number: number }

type LineupPlayer = {
  id: string
  displayName: string
  position: string
  clubCode: string
  rating: number | null
}

type HistoricalLineup = {
  managerId: string
  gameweekId: string
  score: number
  players: LineupPlayer[]
}

const PITCH_ORDER: LineupPosition[] = ['FWD', 'MID', 'DEF', 'GK']

export function LeaderboardStandings({ standings, gameweeks, currentGameweekId, currentMatchday }: {
  standings: Standing[]
  gameweeks: Gameweek[]
  currentGameweekId: string | null
  currentMatchday: { gameweekNumber: number; rows: MatchdayRow[]; fixturesAvailable: boolean } | null
}) {
  const latestVisibleIndex = Math.max(0, gameweeks.findIndex((gameweek) => gameweek.id === currentGameweekId), gameweeks.length - 1)
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)
  const [gameweekIndex, setGameweekIndex] = useState(latestVisibleIndex)
  const [loadedLineup, setLoadedLineup] = useState<HistoricalLineup | null>(null)
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupError, setLineupError] = useState('')
  const lineupCache = useRef(new Map<string, HistoricalLineup>())
  const pendingRequests = useRef(new Map<string, Promise<HistoricalLineup>>())
  const selectedManager = standings.find((standing) => standing.managerId === selectedManagerId)
  const selectedGameweek = gameweeks[gameweekIndex]
  const selectedLineup = loadedLineup?.managerId === selectedManagerId && loadedLineup.gameweekId === selectedGameweek?.id
    ? loadedLineup
    : null
  const formationId = inferFormation(selectedLineup?.players.map((player) => player.position) ?? [])
  const slots = useMemo(() => createLineupSlots(formationId, selectedLineup?.players ?? []), [formationId, selectedLineup])

  const fetchLineup = useCallback((managerId: string, gameweekId: string) => {
    const key = `${managerId}:${gameweekId}`
    const cached = lineupCache.current.get(key)
    if (cached) return Promise.resolve(cached)

    const pending = pendingRequests.current.get(key)
    if (pending) return pending

    const request = fetch(`/api/leaderboard/lineup?managerId=${encodeURIComponent(managerId)}&gameweekId=${encodeURIComponent(gameweekId)}`, {
      cache: 'no-store',
    }).then(async (response) => {
      const result = await response.json() as HistoricalLineup | { error?: string }
      if (!response.ok) throw new Error('error' in result && result.error ? result.error : 'Aufstellung konnte nicht geladen werden.')
      const lineup = result as HistoricalLineup
      lineupCache.current.set(key, lineup)
      return lineup
    }).finally(() => {
      pendingRequests.current.delete(key)
    })

    pendingRequests.current.set(key, request)
    return request
  }, [])

  const openManager = (managerId: string) => {
    setSelectedManagerId(managerId)
    setGameweekIndex(latestVisibleIndex)
    setLineupError('')
  }

  useEffect(() => {
    if (!selectedManagerId || !selectedGameweek) return

    const managerId = selectedManagerId
    const gameweekId = selectedGameweek.id
    const key = `${managerId}:${gameweekId}`
    const cached = lineupCache.current.get(key)
    let cancelled = false

    if (cached) {
      setLoadedLineup(cached)
      setLineupLoading(false)
      setLineupError('')
    } else {
      setLineupLoading(true)
      setLineupError('')
      void fetchLineup(managerId, gameweekId)
        .then((lineup) => {
          if (!cancelled) setLoadedLineup(lineup)
        })
        .catch((error: unknown) => {
          if (!cancelled) setLineupError(error instanceof Error ? error.message : 'Aufstellung konnte nicht geladen werden.')
        })
        .finally(() => {
          if (!cancelled) setLineupLoading(false)
        })
    }

    const adjacentGameweeks = [gameweeks[gameweekIndex - 1], gameweeks[gameweekIndex + 1]].filter(Boolean)
    for (const gameweek of adjacentGameweeks) void fetchLineup(managerId, gameweek.id).catch(() => undefined)

    return () => { cancelled = true }
  }, [fetchLineup, gameweekIndex, gameweeks, selectedGameweek, selectedManagerId])

  useEffect(() => {
    if (!selectedManagerId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedManagerId(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedManagerId])

  const dialog = selectedManager && createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0f1e3a]/72 p-3 backdrop-blur-sm sm:p-6" onMouseDown={() => setSelectedManagerId(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="lineup-dialog-title" onMouseDown={(event) => event.stopPropagation()} className="mx-auto my-2 w-full max-w-3xl rounded-[1.6rem] border border-white/40 bg-[#f6f0e2] p-3 shadow-[0_30px_90px_rgba(5,13,29,0.38)] sm:my-5 sm:p-5">
        <header className="flex items-start justify-between gap-4 px-1 pb-4">
          <div className="min-w-0"><p className="eyebrow text-[#315dc6]">Startelf</p><h2 id="lineup-dialog-title" className="mt-1 truncate font-serif text-2xl font-black sm:text-3xl">{selectedManager.displayName}</h2></div>
          <div className="flex items-start gap-3"><div className="rounded-xl bg-[#315dc6] px-3 py-2 text-right text-white"><p className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/65">Punkte</p><p className="font-serif text-3xl font-black leading-none">{lineupLoading ? '…' : selectedLineup?.score.toFixed(1) ?? '—'}</p></div><button type="button" autoFocus aria-label="Fenster schließen" onClick={() => setSelectedManagerId(null)} className="grid size-10 place-items-center rounded-full border border-[#0f1e3a]/12 bg-white/65 text-[#0f1e3a]/60 hover:text-[#0f1e3a]"><X className="size-5" /></button></div>
        </header>

        {gameweeks.length ? <>
          <div className="mb-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <button type="button" aria-label="Vorherige Gameweek" disabled={gameweekIndex === 0} onClick={() => setGameweekIndex((index) => index - 1)} className="grid size-11 place-items-center rounded-xl border border-[#0f1e3a]/12 bg-white/70 disabled:opacity-25"><ChevronLeft className="size-5" /></button>
            <div className="text-center"><p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#0f1e3a]/40">Aufstellung</p><p className="mt-0.5 font-serif text-xl font-black">Gameweek {selectedGameweek.number}</p></div>
            <button type="button" aria-label="Nächste Gameweek" disabled={gameweekIndex === gameweeks.length - 1} onClick={() => setGameweekIndex((index) => index + 1)} className="grid size-11 place-items-center rounded-xl border border-[#0f1e3a]/12 bg-white/70 disabled:opacity-25"><ChevronRight className="size-5" /></button>
          </div>

          {lineupLoading ? <div className="leaderboard-lineup-pitch lineup-pitch relative overflow-hidden rounded-[1.3rem] border-4 border-white/35 shadow-inner">
            <div className="relative z-10 flex h-full animate-pulse flex-col justify-around px-6 py-8">
              {[3, 4, 3, 1].map((count, row) => <div key={row} className="mx-auto grid w-full max-w-[620px] gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>{Array.from({ length: count }, (_, index) => <div key={index} className="mx-auto h-16 w-full max-w-24 rounded-xl bg-white/45" />)}</div>)}
            </div>
          </div> : lineupError ? <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#0f1e3a]/18 bg-white/35 px-6 text-center"><div><p className="text-sm font-bold">{lineupError}</p><button type="button" onClick={() => { lineupCache.current.delete(`${selectedManagerId}:${selectedGameweek.id}`); setLineupLoading(true); setLineupError(''); void fetchLineup(selectedManagerId!, selectedGameweek.id).then(setLoadedLineup).catch((error: unknown) => setLineupError(error instanceof Error ? error.message : 'Aufstellung konnte nicht geladen werden.')).finally(() => setLineupLoading(false)) }} className="mt-3 rounded-full bg-[#315dc6] px-4 py-2 text-xs font-bold text-white">Erneut versuchen</button></div></div> : selectedLineup?.players.length ? <div className="leaderboard-lineup-pitch lineup-pitch relative overflow-hidden rounded-[1.3rem] border-4 border-white/35 shadow-inner">
            <div aria-hidden="true" className="pointer-events-none absolute inset-3 border-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-1/2 border-t-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-3 h-[13%] w-[48%] -translate-x-1/2 border-x-2 border-b-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-1/2 h-[13%] w-[48%] -translate-x-1/2 border-x-2 border-t-2 border-white/55" />
            <div className="relative z-10 flex h-full flex-col justify-around px-2 py-5 sm:px-6">
              {PITCH_ORDER.map((position) => <div key={position} className="mx-auto grid w-full max-w-[640px] items-center justify-items-center gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${slots[position].length}, minmax(0, 1fr))` }}>
                {slots[position].map((playerId, index) => {
                  const player = selectedLineup.players.find((candidate) => candidate.id === playerId)
                  const theme = player ? getClubTheme(player.clubCode) : null
                  return <article key={`${position}-${index}`} className="w-full max-w-28 overflow-hidden rounded-lg border border-white/65 bg-[#fffdf7] text-center shadow-[0_5px_14px_rgba(6,37,23,0.22)] sm:rounded-xl">
                    <div className="relative min-h-[58px] px-1.5 py-2 sm:min-h-[68px] sm:px-2">{player ? <><ClubCrest code={player.clubCode} size={16} className="absolute left-1 top-1" /><p title={player.displayName} className="truncate px-3 text-[9px] font-black sm:text-xs">{player.displayName}</p><span className="mx-auto mt-1.5 inline-flex min-w-9 items-center justify-center rounded-full bg-[#0f1e3a] px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-white sm:min-w-11 sm:py-1 sm:text-sm">{player.rating?.toFixed(1) ?? '—'}</span></> : <><Shirt className="mx-auto size-4 text-[#236845]/40" /><p className="mt-1 font-mono text-[8px] font-bold text-[#0f1e3a]/35">{position}</p></>}</div>
                    {theme && <div className="h-1" style={{ background: `linear-gradient(90deg, ${theme.primary} 0 72%, ${theme.secondary} 72%)` }} />}
                  </article>
                })}
              </div>)}
            </div>
          </div> : <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#0f1e3a]/18 bg-white/35 px-6 text-center"><div><Shirt className="mx-auto size-8 text-[#0f1e3a]/25" /><p className="mt-3 text-sm font-bold">Für diese Gameweek wurde keine Startelf gespeichert.</p></div></div>}
        </> : <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-[#0f1e3a]/18 bg-white/35 px-6 text-center"><p className="max-w-sm text-sm font-bold">Aufstellungen werden sichtbar, sobald die erste Gameweek geschlossen wurde.</p></div>}
      </section>
    </div>,
    document.body,
  )

  return <>
    <section className="surface overflow-hidden"><div className="grid grid-cols-[38px_minmax(0,1fr)_72px_16px] border-b border-[#0f1e3a]/10 px-3 py-2.5 font-mono text-[8px] font-bold uppercase text-[#0f1e3a]/40 sm:grid-cols-[52px_minmax(0,1fr)_72px_78px_24px] sm:px-5 sm:py-3 sm:text-[9px]"><span>Rang</span><span>Manager</span><span className="text-right sm:hidden">Punkte</span><span className="hidden text-right sm:block">GW</span><span className="hidden text-right sm:block">Gesamt</span><span /></div><div className="divide-y divide-[#0f1e3a]/10">{standings.map((entry) => <button type="button" key={entry.managerId} onClick={() => openManager(entry.managerId)} className={`grid min-h-16 w-full grid-cols-[38px_minmax(0,1fr)_72px_16px] items-center px-3 py-3 text-left transition hover:bg-[#0f1e3a]/4 sm:grid-cols-[52px_minmax(0,1fr)_72px_78px_24px] sm:px-5 sm:py-4 ${entry.isViewer ? 'bg-[#315dc6]/7 text-[#315dc6]' : ''}`}><span className="font-serif text-xl font-black sm:text-2xl">{entry.rank}</span><span className="truncate pr-2 text-sm font-bold">{entry.displayName}</span><span className="text-right sm:hidden"><strong className="block font-mono text-sm font-black leading-none">{entry.total.toFixed(1)}</strong><span className="mt-1 block font-mono text-[8px] opacity-45">GW +{entry.week.toFixed(1)}</span></span><span className="hidden text-right font-mono text-xs sm:block">{entry.week.toFixed(1)}</span><span className="hidden text-right font-mono text-sm font-black sm:block">{entry.total.toFixed(1)}</span><ChevronRight className="ml-auto size-4 opacity-35" /></button>)}</div></section>
    {currentMatchday && <CurrentMatchdayStandings {...currentMatchday} onManagerClick={openManager} />}
    {dialog}
  </>
}
