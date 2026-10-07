'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, ListOrdered, LoaderCircle, Lock, Save, Shirt, TriangleAlert } from 'lucide-react'
import { ClubCrest, ClubIdentity } from '@/components/club-identity'
import { getClubTheme } from '@/lib/football/club-theme'
import { AVAILABILITY_META, availabilityStatus } from '@/lib/players/availability'
import {
  createLineupSlots,
  FORMATIONS,
  inferFormation,
  resizeLineupSlots,
  selectedLineupIds,
  type FormationId,
  type LineupPosition,
} from '@/lib/gameweeks/formations'
import { loadGameweekOnce, storeCachedGameweek, type CachedGameweek } from '@/lib/gameweeks/session-cache'
import { isLineupEditable } from '@/lib/gameweeks/status'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type Player = Pick<Tables<'players'>, 'id' | 'league_id' | 'owner_id' | 'provider_id' | 'display_name' | 'position' | 'club_code' | 'availability_status' | 'is_injured' | 'injury_note'> & { rating: number | null }
type GameweekOption = Pick<Tables<'gameweeks'>, 'id' | 'number' | 'status'>
type LineupEditorProps = {
  gameweekId: string
  managerId: string
  number: number
  status: string
  gameweeks: GameweekOption[]
  squad: Player[]
  initialPlayerIds: string[]
}

const RelevantFixtures = dynamic(() => import('@/components/relevant-fixtures').then((module) => module.RelevantFixtures), {
  loading: () => <div className="surface min-h-64 animate-pulse bg-[#315dc6]/8" />,
})

const PITCH_ORDER: LineupPosition[] = ['FWD', 'MID', 'DEF', 'GK']
const POSITION_LABELS: Record<LineupPosition, string> = { GK: 'Tor', DEF: 'Abwehr', MID: 'Mittelfeld', FWD: 'Angriff' }

function samePlayers(left: string[], right: string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

function statusMeta(status: string) {
  if (status === 'pending') return { label: 'Planung offen', className: 'bg-[#d79a2b] text-[#0f1e3a]' }
  if (status === 'lineup') return { label: 'Aufstellung offen', className: 'bg-[#45a264] text-white' }
  if (status === 'final') return { label: 'Final', className: 'bg-white text-[#0f1e3a]' }
  return { label: 'Gesperrt · Live', className: 'bg-white/12 text-white' }
}

function GameweekNavigationSkeleton({ targetNumber }: { targetNumber: number }) {
  return <div role="status" aria-live="polite" className="space-y-4">
    <div className="flex items-center gap-3 rounded-xl border border-[#315dc6]/12 bg-[#315dc6]/6 px-4 py-3 text-[#315dc6]">
      <LoaderCircle className="size-4 shrink-0 animate-spin" />
      <p className="text-xs font-bold">Gameweek {targetNumber} wird geladen…</p>
    </div>
    <div aria-hidden="true" className="animate-pulse">
      <div className="mb-4 h-11 w-64 rounded-xl bg-[#0f1e3a]/8" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface p-3 sm:p-5">
          <div className="mb-4 flex justify-between"><div className="h-10 w-32 rounded bg-[#0f1e3a]/8" /><div className="h-10 w-28 rounded-xl bg-[#0f1e3a]/8" /></div>
          <div className="lineup-pitch rounded-[1.35rem] opacity-45" />
        </section>
        <aside className="space-y-4"><div className="h-20 rounded-2xl bg-[#236845]/10" /><div className="h-28 rounded-2xl bg-[#315dc6]/12" /><div className="h-12 rounded-xl bg-[#0f1e3a]/12" /></aside>
      </div>
    </div>
  </div>
}

function payloadFromProps({ gameweekId, number, status, squad, initialPlayerIds }: LineupEditorProps): CachedGameweek {
  return {
    gameweekId,
    number,
    status,
    ratings: Object.fromEntries(squad.flatMap((player) => player.rating === null ? [] : [[player.id, player.rating]])),
    initialPlayerIds,
  }
}

export function LineupEditor(props: LineupEditorProps) {
  const { managerId, gameweeks, squad } = props
  const initialNumber = useRef(props.number)
  const requestId = useRef(0)
  const [active, setActive] = useState<CachedGameweek>(() => payloadFromProps(props))
  const [loadingTarget, setLoadingTarget] = useState<number | null>(null)
  const [navigationError, setNavigationError] = useState('')

  useEffect(() => {
    storeCachedGameweek(managerId, active, sessionStorage)
  }, [active, managerId])

  const navigateToGameweek = useCallback(async (targetNumber: number, history: 'push' | 'none' = 'push') => {
    if (targetNumber === active.number || loadingTarget !== null) return
    const target = gameweeks.find((gameweek) => gameweek.number === targetNumber)
    if (!target) return

    setNavigationError('')
    const currentRequest = ++requestId.current
    try {
      const { payload } = await loadGameweekOnce({
        managerId,
        gameweekId: target.id,
        storage: sessionStorage,
        onCacheMiss: () => setLoadingTarget(targetNumber),
        load: async () => {
          const response = await fetch(`/api/matchday/gameweek?gameweekId=${encodeURIComponent(target.id)}`, { headers: { Accept: 'application/json' } })
          const body = await response.json() as CachedGameweek & { error?: string }
          if (!response.ok) throw new Error(body.error ?? 'Die Gameweek konnte nicht geladen werden.')
          return body
        },
      })
      if (currentRequest !== requestId.current) return

      setActive(payload)
      if (history === 'push') {
        const url = new URL(window.location.href)
        url.searchParams.set('gameweek', String(targetNumber))
        window.history.pushState(null, '', url)
      }
    } catch (requestError: unknown) {
      if (currentRequest === requestId.current) setNavigationError(requestError instanceof Error ? requestError.message : 'Die Gameweek konnte nicht geladen werden.')
    } finally {
      if (currentRequest === requestId.current) setLoadingTarget(null)
    }
  }, [active.number, gameweeks, loadingTarget, managerId])

  useEffect(() => {
    const handleHistory = () => {
      const requested = Number(new URL(window.location.href).searchParams.get('gameweek') ?? initialNumber.current)
      if (Number.isInteger(requested)) void navigateToGameweek(requested, 'none')
    }
    window.addEventListener('popstate', handleHistory)
    return () => window.removeEventListener('popstate', handleHistory)
  }, [navigateToGameweek])

  const activeSquad = useMemo(() => squad.map((player) => ({ ...player, rating: active.ratings[player.id] ?? null })), [active.ratings, squad])
  const updateCachedLineup = (playerIds: string[]) => setActive((current) => ({ ...current, initialPlayerIds: playerIds }))

  return <LineupEditorScreen
    key={active.gameweekId}
    gameweekId={active.gameweekId}
    managerId={managerId}
    number={active.number}
    status={active.status}
    gameweeks={gameweeks}
    squad={activeSquad}
    initialPlayerIds={active.initialPlayerIds}
    loadingTarget={loadingTarget}
    navigationError={navigationError}
    onNavigate={navigateToGameweek}
    onLineupSaved={updateCachedLineup}
  />
}

function LineupEditorScreen({ gameweekId, managerId, number, status, gameweeks, squad, initialPlayerIds, loadingTarget, navigationError, onNavigate, onLineupSaved }: LineupEditorProps & {
  loadingTarget: number | null
  navigationError: string
  onNavigate: (targetNumber: number) => void
  onLineupSaved: (playerIds: string[]) => void
}) {
  const initialPlayers = squad.filter((player) => initialPlayerIds.includes(player.id))
  const initialFormation = inferFormation(initialPlayers.map((player) => player.position))
  const [formationId, setFormationId] = useState<FormationId>(initialFormation)
  const [slots, setSlots] = useState(() => createLineupSlots(initialFormation, initialPlayers))
  const [savedIds, setSavedIds] = useState(initialPlayerIds)
  const [error, setError] = useState('')
  const [view, setView] = useState<'lineup' | 'matches'>('lineup')
  const [savePending, startSaveTransition] = useTransition()
  const gameweekChanging = loadingTarget !== null
  const lineupEditable = isLineupEditable(status)
  const gameweekIndex = gameweeks.findIndex((gameweek) => gameweek.id === gameweekId)
  const previousGameweek = gameweekIndex > 0 ? gameweeks[gameweekIndex - 1] : null
  const nextGameweek = gameweekIndex >= 0 && gameweekIndex < gameweeks.length - 1 ? gameweeks[gameweekIndex + 1] : null
  const selectedStatus = statusMeta(status)
  const selectedIds = useMemo(() => selectedLineupIds(slots), [slots])
  const selected = squad.filter((player) => selectedIds.includes(player.id))
  const bench = squad.filter((player) => !selectedIds.includes(player.id))
  const valid = selectedIds.length === 11 && new Set(selectedIds).size === 11
  const score = selected.reduce((sum, player) => sum + (player.rating ?? 0), 0)
  const dirty = !samePlayers(selectedIds, savedIds)
  const injuryByPlayer = useMemo(() => {
    const entries = squad.flatMap((player) => {
      const playerStatus = availabilityStatus(player.availability_status, player.is_injured)
      return playerStatus === 'available' ? [] : [[player.id, {
        note: player.injury_note,
        meta: AVAILABILITY_META[playerStatus],
      }] as const]
    })
    return new Map(entries)
  }, [squad])

  const changeFormation = (nextFormation: FormationId) => {
    if (!lineupEditable) return
    setFormationId(nextFormation)
    setSlots((current) => resizeLineupSlots(current, nextFormation))
    setError('')
  }

  const updateSlot = (position: LineupPosition, index: number, playerId: string) => {
    if (!lineupEditable) return
    setSlots((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, [...ids]])) as typeof current
      for (const slotPosition of PITCH_ORDER) {
        next[slotPosition] = next[slotPosition].map((id) => id === playerId && playerId ? null : id)
      }
      next[position][index] = playerId || null
      return next
    })
    setError('')
  }

  const addFromBench = (player: Player) => {
    if (!lineupEditable) return
    const position = player.position as LineupPosition
    const emptyIndex = slots[position].findIndex((id) => !id)
    if (emptyIndex === -1) {
      setError(`${POSITION_LABELS[position]} ist in dieser Formation bereits voll.`)
      return
    }
    updateSlot(position, emptyIndex, player.id)
  }

  const save = () => startSaveTransition(async () => {
    const { error: saveError } = await createClient().rpc('save_lineup', { p_gameweek_id: gameweekId, p_player_ids: selectedIds })
    if (saveError) { setError(saveError.message); return }
    setSavedIds(selectedIds)
    onLineupSaved(selectedIds)
  })

  return <main aria-busy={gameweekChanging} className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-5"><p className="eyebrow text-[#315dc6]">Premier League</p><h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Matchday</h1></div>
    <section aria-label="Gameweek auswählen" className="ticket-cut mb-4 overflow-hidden bg-[#0f1e3a] text-white shadow-[0_14px_30px_rgba(15,30,58,0.16)]">
      <div className="grid min-h-24 grid-cols-[52px_minmax(0,1fr)_52px] items-stretch sm:grid-cols-[64px_minmax(0,1fr)_64px]">
        {previousGameweek ? <button type="button" onClick={() => onNavigate(previousGameweek.number)} disabled={gameweekChanging} aria-label={`Zu Gameweek ${previousGameweek.number}`} className="grid place-items-center border-r border-white/10 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-wait disabled:opacity-45"><ChevronLeft className="size-5" /></button> : <span aria-hidden="true" className="grid place-items-center border-r border-white/10 opacity-20"><ChevronLeft className="size-5" /></span>}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f4cf57]"><CalendarRange className="size-5" /></span>
            <label className="min-w-0">
              <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/45">Spieltag wählen</span>
              <span className="relative mt-1 inline-flex items-center">
                <select value={number} onChange={(event) => onNavigate(Number(event.target.value))} disabled={gameweekChanging} className="appearance-none bg-transparent py-0.5 pr-7 font-serif text-2xl font-black leading-none text-white outline-none disabled:cursor-wait disabled:opacity-60 sm:text-3xl">
                  {gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.number} className="text-[#0f1e3a]">Gameweek {gameweek.number}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 size-4 text-white/50" />
              </span>
            </label>
          </div>
          <div className="text-right"><span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black ${selectedStatus.className}`}>{selectedStatus.label}</span><p className="mt-1.5 font-mono text-[8px] font-bold text-white/35">{number} / {gameweeks.length}</p></div>
        </div>
        {nextGameweek ? <button type="button" onClick={() => onNavigate(nextGameweek.number)} disabled={gameweekChanging} aria-label={`Zu Gameweek ${nextGameweek.number}`} className="grid place-items-center border-l border-white/10 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-wait disabled:opacity-45"><ChevronRight className="size-5" /></button> : <span aria-hidden="true" className="grid place-items-center border-l border-white/10 opacity-20"><ChevronRight className="size-5" /></span>}
      </div>
    </section>
    {navigationError && <p role="alert" className="mb-4 rounded-xl border border-[#e93545]/20 bg-[#fff0f1] px-4 py-3 text-xs font-bold text-[#b32131]">{navigationError}</p>}
    {gameweekChanging ? <GameweekNavigationSkeleton targetNumber={loadingTarget} /> : <>
    <div role="tablist" aria-label="Matchday Ansicht" className="mb-4 inline-flex rounded-xl border border-[#0f1e3a]/10 bg-[#0f1e3a]/5 p-1">
      <button type="button" role="tab" aria-selected={view === 'lineup'} onClick={() => setView('lineup')} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black transition ${view === 'lineup' ? 'bg-[#fffdf7] text-[#0f1e3a] shadow-sm' : 'text-[#0f1e3a]/45'}`}><Shirt className="size-4" />Aufstellung</button>
      <button type="button" role="tab" aria-selected={view === 'matches'} onClick={() => setView('matches')} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black transition ${view === 'matches' ? 'bg-[#315dc6] text-white shadow-sm' : 'text-[#0f1e3a]/45'}`}><ListOrdered className="size-4" />Meine Spiele</button>
    </div>
    {view === 'matches' ? <RelevantFixtures gameweekId={gameweekId} managerId={managerId} squad={squad} /> : <>
    {squad.length !== 20 && <section className="surface mb-4 p-5"><p className="text-sm font-bold">Dein Kader enthält aktuell {squad.length} von 20 Spielern.</p><p className="mt-1 text-xs text-[#0f1e3a]/50">Eine Startelf kann erst nach vollständigem Draft gespeichert werden.</p></section>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <section className="surface overflow-hidden p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="eyebrow">System</p><p className="mt-1 text-sm font-bold">Formation wählen</p></div>
            <label className="relative min-w-32">
              <span className="sr-only">Formation</span>
              <select value={formationId} onChange={(event) => changeFormation(event.target.value as FormationId)} disabled={!lineupEditable} className="w-full appearance-none rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] py-2.5 pl-3 pr-9 font-mono text-sm font-black disabled:opacity-60">
                {FORMATIONS.map((formation) => <option key={formation.id} value={formation.id}>{formation.id}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#0f1e3a]/45" />
            </label>
          </div>

          <div className="lineup-pitch relative overflow-hidden rounded-[1.35rem] border-4 border-white/35 shadow-inner">
            <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-sm border-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-1/2 border-t-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55 sm:size-28" />
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-3 h-[13%] w-[48%] -translate-x-1/2 border-x-2 border-b-2 border-white/55" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-1/2 h-[13%] w-[48%] -translate-x-1/2 border-x-2 border-t-2 border-white/55" />

            <div className="relative z-10 flex h-full flex-col justify-around px-2 py-6 sm:px-6 sm:py-8">
              {PITCH_ORDER.map((position) => <div key={position} className="mx-auto grid w-full max-w-[680px] items-center justify-items-center gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${slots[position].length}, minmax(0, 1fr))` }}>
                {slots[position].map((playerId, index) => {
                  const player = squad.find((candidate) => candidate.id === playerId)
                  const theme = player ? getClubTheme(player.club_code) : null
                  const injury = player ? injuryByPlayer.get(player.id) : null
                  const available = squad.filter((candidate) => candidate.position === position && (!selectedIds.includes(candidate.id) || candidate.id === playerId))
                  return <label key={`${position}-${index}`} className="group relative block w-full max-w-28 cursor-pointer">
                    <span className="sr-only">{POSITION_LABELS[position]} {index + 1}</span>
                    <div className={`min-h-[66px] overflow-hidden rounded-lg border bg-[#fffdf7] shadow-[0_5px_14px_rgba(6,37,23,0.22)] transition group-focus-within:-translate-y-0.5 group-focus-within:ring-2 group-focus-within:ring-[#f4cf57] sm:min-h-[78px] sm:rounded-xl ${injury ? injury.meta.borderClass : 'border-white/60'}`} style={{ borderTopColor: injury ? injury.meta.color : theme?.primary, borderTopWidth: player ? 5 : 1 }}>
                      <div className="relative px-1.5 py-2 text-center sm:px-2">
                        {!player && <Shirt className="mx-auto mb-1 size-4 text-[#236845]/40 sm:size-5" />}
                        {player && <ClubCrest code={player.club_code} size={16} className="absolute left-0.5 top-0.5" />}
                        {injury && <span title={injury.note ?? injury.meta.label} className={`absolute right-0.5 top-0.5 ${injury.meta.textClass}`}><TriangleAlert className="size-3.5" /><span className="sr-only">{injury.meta.label}</span></span>}
                        <select value={playerId ?? ''} onChange={(event) => updateSlot(position, index, event.target.value)} disabled={!lineupEditable} title={injury?.note ?? player?.display_name ?? 'Spieler wählen'} className={`block w-full appearance-none truncate bg-transparent text-center text-[9px] font-black leading-tight outline-none disabled:cursor-default sm:text-xs ${injury?.meta.textClass ?? ''}`}>
                          <option value="">Spieler wählen</option>
                          {available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.display_name}</option>)}
                        </select>
                        {player ? <span className="mx-auto mt-1 inline-flex min-w-9 items-center justify-center rounded-full bg-[#0f1e3a] px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-white sm:min-w-11 sm:py-1 sm:text-sm">{player.rating?.toFixed(1) ?? '—'}</span> : <p className="mt-1 font-mono text-[7px] font-bold uppercase tracking-wide text-[#0f1e3a]/45 sm:text-[9px]">{position}</p>}
                      </div>
                      {theme && <div className="h-1" style={{ background: `linear-gradient(90deg, ${theme.primary} 0 72%, ${theme.secondary} 72%)` }} />}
                    </div>
                  </label>
                })}
              </div>)}
            </div>
          </div>
        </section>

        <section className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Kader</p><h2 className="mt-1 font-serif text-xl font-black">Bank</h2></div><span className="font-mono text-[10px] text-[#0f1e3a]/45">{bench.length} Spieler</span></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {bench.map((player) => {
              const position = player.position as LineupPosition
              const canAdd = slots[position].some((id) => !id)
              const theme = getClubTheme(player.club_code)
              const injury = injuryByPlayer.get(player.id)
              return <button key={player.id} type="button" onClick={() => addFromBench(player)} disabled={!lineupEditable} title={injury?.note ?? undefined} className={`overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none ${injury ? `${injury.meta.borderClass} ${injury.meta.surfaceClass}` : 'border-[#0f1e3a]/10 bg-[#fffdf7]'}`}>
                <div className="h-1" style={{ background: injury ? injury.meta.color : `linear-gradient(90deg, ${theme.primary} 0 72%, ${theme.secondary} 72%)` }} />
                <div className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className={`flex items-center gap-1 truncate text-sm font-bold ${injury?.meta.textClass ?? ''}`}>{injury && <TriangleAlert className="size-3.5 shrink-0" />}{player.display_name}</p><ClubIdentity code={player.club_code} size={18} className="mt-1" nameClassName="truncate text-[9px] font-bold text-[#0f1e3a]/42" /><p className={`mt-0.5 font-mono text-[8px] font-bold ${injury?.meta.textClass ?? 'text-[#0f1e3a]/35'}`}>{position}{injury ? ` · ${injury.meta.shortLabel}` : ''}</p></div><div className="text-right"><p className="font-mono text-lg font-black leading-none text-[#315dc6]">{player.rating?.toFixed(1) ?? '—'}</p>{lineupEditable && <p className={`mt-1.5 text-[8px] font-bold uppercase ${canAdd ? 'text-[#236845]' : 'text-[#0f1e3a]/30'}`}>{canAdd ? 'Aufstellen' : 'Position voll'}</p>}</div></div>
              </button>
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-5"><section className={`rounded-2xl border p-4 ${valid ? 'border-[#45a264]/30 bg-[#e9f5ec] text-[#17452e]' : 'border-[#e93545]/30 bg-[#fff0f1] text-[#9c1d2a]'}`}><p className="flex items-center gap-2 text-sm font-bold"><Check className="size-4" />{valid ? 'Aufstellung gültig' : `${selected.length} von 11 gewählt`}</p><p className="mt-1 font-mono text-[10px] opacity-65">{formationId} · 1 GK · {slots.DEF.length} DEF · {slots.MID.length} MID · {slots.FWD.length} FWD</p></section><section className="rounded-2xl bg-[#315dc6] p-5 text-white shadow-[0_14px_30px_rgba(49,93,198,0.22)]"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">Punkte</p><p className="mt-2 font-serif text-5xl font-black leading-none">{score.toFixed(1)}</p></section>{error && <p className="rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}{lineupEditable ? <button onClick={save} disabled={!valid || !dirty || savePending || squad.length !== 20} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f1e3a] py-3.5 text-sm font-bold text-white disabled:opacity-35"><Save className="size-4" />{savePending ? 'Speichert…' : dirty ? status === 'pending' ? 'Planung speichern' : 'Aufstellung speichern' : status === 'pending' ? 'Planung gespeichert' : 'Aufstellung gespeichert'}</button> : <p className="flex items-center gap-2 text-xs text-[#0f1e3a]/45"><Lock className="size-3.5" />Diese Aufstellung ist gesperrt.</p>}</aside>
    </div>
    </>}
    </>}
  </main>
}
