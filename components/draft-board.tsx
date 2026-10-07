'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Search, UserRoundCog, X } from 'lucide-react'
import { AddPlayerForm } from '@/components/add-player-form'
import { ClubCrest, ClubIdentity } from '@/components/club-identity'
import { pickNumberForManagerColumn } from '@/lib/draft/snake-order'
import { getClubTheme } from '@/lib/football/club-theme'
import { getClubName } from '@/lib/football/clubs'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type Manager = Pick<Tables<'managers'>, 'id' | 'display_name' | 'draft_position'>
type Player = Pick<Tables<'players'>, 'id' | 'display_name' | 'club_code' | 'position' | 'owner_id'>
type DraftPick = Pick<Tables<'draft_picks'>, 'player_id' | 'overall_pick'>
type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export function DraftBoard({ leagueId, managers, players, picks, canPick }: { leagueId: string; managers: Manager[]; players: Player[]; picks: DraftPick[]; canPick: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Player | null>(null)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<'ALL' | Position>('ALL')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const next = picks.length + 1
  const orderedManagers = [...managers].sort((a, b) => a.draft_position - b.draft_position)

  const ownerFor = (number: number) => {
    if (orderedManagers.length !== 5) return null
    const round = Math.ceil(number / 5)
    const index = (number - 1) % 5
    return orderedManagers[round % 2 === 1 ? index : 4 - index]
  }
  const playerById = new Map(players.map((player) => [player.id, player]))
  const shown = useMemo(() => players
    .filter((player) => !player.owner_id)
    .filter((player) => position === 'ALL' || player.position === position)
    .filter((player) => `${player.display_name} ${player.club_code} ${getClubName(player.club_code)}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 100), [players, position, query])

  const confirm = () => {
    if (!selected) return
    setError('')
    startTransition(async () => {
      const { error: pickError } = await createClient().rpc('make_draft_pick', { p_player_id: selected.id })
      if (pickError) { setError(pickError.message); return }
      setSelected(null)
      router.refresh()
    })
  }

  const currentManager = ownerFor(next)
  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_300px] sm:items-end"><div><p className="eyebrow text-[#315dc6]">Snake Draft</p><h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Draft Board</h1></div><div className="ticket-cut bg-[#e93545] p-4 text-white"><p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/70">Jetzt dran · #{next}</p><p className="mt-1 font-serif text-2xl font-black">{currentManager?.display_name ?? 'Warte auf 5 Manager'}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-white/80"><UserRoundCog className="size-3.5" />{canPick ? 'Pick auswählen' : 'Commissioner wählt'}</p></div></div>
    {managers.length !== 5 && <p className="mb-4 rounded-xl bg-[#fff8e8] p-4 text-sm font-bold text-[#7c5a1b]">Der Draft startet, sobald fünf Manager registriert sind.</p>}
    {canPick && picks.length < 100 && <AddPlayerForm leagueId={leagueId} players={players} />}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#0f1e3a]/10 px-4 py-3"><p className="text-sm font-bold">Draft Board</p><span className="rounded-full bg-[#0f1e3a]/6 px-3 py-1 font-mono text-[10px] font-bold">{picks.length}/100 Picks</span></div><div className="overflow-x-auto p-3"><div className="min-w-[780px]"><div className="grid grid-cols-[52px_repeat(5,minmax(130px,1fr))] gap-2">{['Rnd', ...orderedManagers.map((manager) => manager.display_name)].map((label) => <div key={label} className="rounded-lg bg-[#0f1e3a] px-3 py-2 font-mono text-[10px] font-bold uppercase text-white">{label}</div>)}</div><div className="mt-2 space-y-2">{Array.from({ length: 20 }, (_, index) => index + 1).map((round) => <div key={round} className="grid grid-cols-[52px_repeat(5,minmax(130px,1fr))] gap-2"><div className="flex flex-col items-center justify-center rounded-lg bg-[#0f1e3a]/6 font-mono text-xs font-bold"><span>{round}</span><span className="text-[9px] text-[#e93545]">{round % 2 ? '→' : '←'}</span></div>{orderedManagers.map((manager, column) => { const number = pickNumberForManagerColumn(round, column); const pick = picks.find((item) => item.overall_pick === number); const player = pick ? playerById.get(pick.player_id) : null; const active = number === next; const clubTheme = player ? getClubTheme(player.club_code) : null; return <div key={number} style={clubTheme ? { background: `linear-gradient(135deg, color-mix(in srgb, ${clubTheme.primary} 13%, #fffdf7) 0%, #fffdf7 70%)`, borderColor: `color-mix(in srgb, ${clubTheme.primary} 35%, transparent)`, boxShadow: `inset 4px 0 0 ${clubTheme.primary}` } : undefined} className={`relative min-h-24 overflow-hidden rounded-xl border p-3 ${player ? 'draft-pick-card' : active ? 'border-[#e93545] bg-[#e93545]/8' : 'border-[#0f1e3a]/10 bg-[#f6f0e2]/65'}`}>{clubTheme && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${clubTheme.primary} 0 68%, ${clubTheme.secondary} 68%)` }} />}<p className="font-mono text-[9px] font-bold text-[#0f1e3a]/40">#{number} · {manager.display_name}</p>{player && clubTheme ? <div className="mt-3"><p className="truncate font-serif text-[15px] font-black leading-tight tracking-[-0.015em] text-[#0f1e3a]">{player.display_name}</p><div className="mt-2 flex items-center gap-1.5"><ClubIdentity code={player.club_code} size={20} nameClassName="truncate text-[9px] font-black leading-tight" /><span className="rounded-md border border-[#0f1e3a]/10 bg-white/65 px-1.5 py-1 font-mono text-[9px] font-bold text-[#0f1e3a]/55">{player.position}</span></div></div> : <p className={`mt-5 text-xs font-semibold ${active ? 'text-[#e93545]' : 'text-[#0f1e3a]/25'}`}>{active ? 'Aktiver Pick' : 'Offen'}</p>}</div> })}</div>)}</div></div></div></section>
      <section className="surface h-fit p-4 xl:sticky xl:top-24"><div className="flex items-end justify-between"><h2 className="font-serif text-xl font-black">Spielerpool</h2><span className="font-mono text-[10px] font-bold text-[#0f1e3a]/45">{players.filter((player) => !player.owner_id).length} FREI</span></div><label className="relative mt-4 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#0f1e3a]/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Spieler oder Club" className="h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] pl-9 pr-3 text-sm" /></label><div className="mt-3 flex gap-1">{(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((item) => <button key={item} onClick={() => setPosition(item)} className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-bold ${position === item ? 'bg-[#0f1e3a] text-white' : 'bg-[#0f1e3a]/6'}`}>{item}</button>)}</div><div className="mt-3 max-h-[520px] divide-y divide-[#0f1e3a]/10 overflow-y-auto">{shown.map((player) => <button key={player.id} disabled={!canPick || managers.length !== 5 || picks.length >= 100} onClick={() => setSelected(player)} className="group flex w-full items-center justify-between py-3 text-left disabled:opacity-45"><div className="flex min-w-0 items-center gap-2.5"><ClubCrest code={player.club_code} size={26} /><div className="min-w-0"><p className="truncate text-sm font-bold">{player.display_name}</p><p className="truncate text-[10px] text-[#0f1e3a]/45">{getClubName(player.club_code)} · <span className="font-mono">{player.position}</span></p></div></div><ChevronRight className="size-3 shrink-0 text-[#315dc6]" /></button>)}</div></section>
    </div>
    {selected && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0f1e3a]/50 p-3"><div className="w-full max-w-md rounded-3xl bg-[#f6f0e2] p-5"><div className="flex justify-between"><div><p className="eyebrow text-[#e93545]">Pick bestätigen</p><h2 className="mt-2 font-serif text-3xl font-black">{selected.display_name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#0f1e3a]/55"><ClubIdentity code={selected.club_code} size={28} nameClassName="font-bold" /><span>· {selected.position} → {currentManager?.display_name}</span></div></div><button onClick={() => setSelected(null)}><X className="size-5" /></button></div>{error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => setSelected(null)} className="rounded-xl border py-3 text-sm font-bold">Zurück</button><button disabled={pending} onClick={confirm} className="flex items-center justify-center gap-2 rounded-xl bg-[#e93545] py-3 text-sm font-bold text-white"><Check className="size-4" />{pending ? 'Speichert…' : 'Pick speichern'}</button></div></div></div>}
  </main>
}
