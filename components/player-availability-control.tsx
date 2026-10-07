'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, LoaderCircle, Save, Search, TriangleAlert } from 'lucide-react'
import { ClubCrest } from '@/components/club-identity'
import { getClubName } from '@/lib/football/clubs'
import { AVAILABILITY_META, availabilityStatus, type AvailabilityStatus } from '@/lib/players/availability'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type AvailabilityPlayer = Pick<Tables<'players'>, 'id' | 'display_name' | 'club_code' | 'position' | 'availability_status' | 'is_injured' | 'injury_note'>

export function PlayerAvailabilityControl() {
  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<AvailabilityPlayer[] | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const resetAfterImport = () => { setPlayers(null); setOpen(false) }
    window.addEventListener('player-availability-updated', resetAfterImport)
    return () => window.removeEventListener('player-availability-updated', resetAfterImport)
  }, [])

  const loadPlayers = async () => {
    if (players || loading) return
    setLoading(true)
    setError('')
    const { data, error: loadError } = await createClient()
      .from('players')
      .select('id,display_name,club_code,position,availability_status,is_injured,injury_note')
      .not('owner_id', 'is', null)
      .order('club_code')
      .order('display_name')

    setLoading(false)
    if (loadError) { setError('Die Spielerliste konnte nicht geladen werden.'); return }
    const loaded = data ?? []
    setPlayers(loaded)
    setNotes(Object.fromEntries(loaded.map((player) => [player.id, player.injury_note ?? ''])))
  }

  const toggleOpen = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void loadPlayers()
  }

  const savePlayer = async (player: AvailabilityPlayer, status: AvailabilityStatus) => {
    setSavingId(player.id)
    setError('')
    const isInjured = status !== 'available'
    const note = isInjured ? notes[player.id]?.trim().slice(0, 160) || null : null
    const updatedAt = new Date().toISOString()
    const { error: updateError } = await createClient().from('players').update({
      availability_status: status,
      is_injured: isInjured,
      injury_note: note,
      injury_updated_at: updatedAt,
    }).eq('id', player.id)

    setSavingId(null)
    if (updateError) { setError('Der Verletzungsstatus konnte nicht gespeichert werden.'); return }
    setPlayers((current) => current?.map((candidate) => candidate.id === player.id ? {
      ...candidate,
      availability_status: status,
      is_injured: isInjured,
      injury_note: note,
    } : candidate) ?? null)
    setNotes((current) => ({ ...current, [player.id]: note ?? '' }))
  }

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return [...(players ?? [])]
      .filter((player) => !term || `${player.display_name} ${player.club_code} ${getClubName(player.club_code)}`.toLocaleLowerCase('de').includes(term))
      .sort((left, right) => Number(availabilityStatus(right.availability_status, right.is_injured) !== 'available') - Number(availabilityStatus(left.availability_status, left.is_injured) !== 'available')
        || left.club_code.localeCompare(right.club_code)
        || left.display_name.localeCompare(right.display_name))
  }, [players, search])

  return <section className="surface overflow-hidden">
    <button type="button" aria-expanded={open} onClick={toggleOpen} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
      <span className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0f1] text-[#b32131]"><TriangleAlert className="size-5" /></span><span><span className="block font-serif text-xl font-black">Verletzungen</span><span className="mt-0.5 block text-xs text-[#0f1e3a]/48">Status der gedrafteten Spieler verwalten</span></span></span>
      {open ? <ChevronUp className="size-5 shrink-0 text-[#0f1e3a]/45" /> : <ChevronDown className="size-5 shrink-0 text-[#0f1e3a]/45" />}
    </button>

    {open && <div className="border-t border-[#0f1e3a]/10 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
      {loading ? <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-bold text-[#0f1e3a]/50"><LoaderCircle className="size-4 animate-spin" />Spieler werden geladen</div> : players ? <>
        <label className="relative block">
          <span className="sr-only">Spieler suchen</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#0f1e3a]/35" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Spieler oder Club suchen" className="w-full rounded-xl border border-[#0f1e3a]/12 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#315dc6]" />
        </label>
        <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {visiblePlayers.map((player) => {
            const status = availabilityStatus(player.availability_status, player.is_injured)
            const meta = AVAILABILITY_META[status]
            const noteChanged = (notes[player.id] ?? '').trim() !== (player.injury_note ?? '')
            return <div key={player.id} className={`rounded-xl border p-3 ${meta.borderClass} ${status === 'available' ? 'bg-white/55' : meta.surfaceClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5"><ClubCrest code={player.club_code} size={28} /><div className="min-w-0"><p className={`truncate text-sm font-bold ${status === 'available' ? '' : meta.textClass}`}>{player.display_name}</p><p className="mt-0.5 truncate text-[9px] font-bold text-[#0f1e3a]/38">{getClubName(player.club_code)} · <span className="font-mono">{player.position}</span></p></div></div>
                <select aria-label={`Status von ${player.display_name}`} value={status} disabled={savingId === player.id} onChange={(event) => void savePlayer(player, event.target.value as AvailabilityStatus)} className="rounded-full border border-[#0f1e3a]/12 bg-white px-3 py-2 text-xs font-bold outline-none disabled:opacity-45">
                  {(Object.keys(AVAILABILITY_META) as AvailabilityStatus[]).map((value) => <option key={value} value={value}>{AVAILABILITY_META[value].label}</option>)}
                </select>
              </div>
              {status !== 'available' && <div className="mt-3 flex gap-2"><input maxLength={160} value={notes[player.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [player.id]: event.target.value }))} placeholder="Hinweis, optional" className="min-w-0 flex-1 rounded-lg border border-[#0f1e3a]/12 bg-white px-3 py-2 text-xs outline-none focus:border-[#315dc6]" /><button type="button" aria-label={`Hinweis für ${player.display_name} speichern`} disabled={!noteChanged || savingId === player.id} onClick={() => void savePlayer(player, status)} className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0f1e3a] text-white disabled:opacity-25"><Save className="size-4" /></button></div>}
            </div>
          })}
          {!visiblePlayers.length && <p className="py-8 text-center text-sm text-[#0f1e3a]/45">Keine Spieler gefunden.</p>}
        </div>
      </> : null}
      {error && <p className="mt-3 rounded-xl bg-[#fff0f1] p-3 text-sm font-bold text-[#b32131]">{error}</p>}
    </div>}
  </section>
}
