'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, X } from 'lucide-react'
import { getClubName } from '@/lib/football/clubs'
import { newPlayerInput, type PlayerPosition } from '@/lib/players/new-player'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type Player = Pick<Tables<'players'>, 'display_name' | 'club_code'>

export function AddPlayerForm({ leagueId, players }: { leagueId: string; players: Player[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const clubs = useMemo(() => [...new Set(players.map((player) => player.club_code))].sort(), [players])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const player = newPlayerInput(
      String(form.get('name') ?? ''),
      String(form.get('position')) as PlayerPosition,
      String(form.get('club') ?? ''),
    )

    setError('')
    setSaved(false)
    if (!player.display_name) {
      setError('Bitte einen Spielernamen eingeben.')
      return
    }
    if (players.some((existing) => existing.display_name.toLowerCase() === player.display_name.toLowerCase() && existing.club_code === player.club_code)) {
      setError('Dieser Spieler ist bereits im Pool.')
      return
    }

    const formElement = event.currentTarget
    startTransition(async () => {
      const { error: insertError } = await createClient().from('players').insert({ league_id: leagueId, ...player })
      if (insertError) {
        setError(insertError.message)
        return
      }
      formElement.reset()
      setSaved(true)
      router.refresh()
    })
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mb-4 flex items-center gap-2 rounded-xl border border-[#315dc6]/20 bg-[#315dc6]/7 px-4 py-3 text-sm font-bold text-[#315dc6]"><Plus className="size-4" />Spieler zum Pool hinzufügen</button>

  return <form onSubmit={submit} className="surface mb-4 p-4 sm:p-5">
    <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Spieler hinzufügen</h2><button type="button" aria-label="Formular schließen" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full border border-[#0f1e3a]/10"><X className="size-4" /></button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_150px_150px_auto] sm:items-end">
      <label className="text-xs font-bold">Name<input name="name" required maxLength={80} className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 px-3 text-sm font-normal" /></label>
      <label className="text-xs font-bold">Position<select name="position" required defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 px-3 text-sm font-normal"><option value="" disabled>Wählen</option>{(['GK', 'DEF', 'MID', 'FWD'] as const).map((position) => <option key={position} value={position}>{position}</option>)}</select></label>
      <label className="text-xs font-bold">Club<select name="club" required defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 px-3 text-sm font-normal"><option value="" disabled>Wählen</option>{clubs.map((club) => <option key={club} value={club}>{getClubName(club)}</option>)}</select></label>
      <button disabled={pending} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f1e3a] px-4 text-sm font-bold text-white disabled:opacity-40">{saved ? <Check className="size-4" /> : <Plus className="size-4" />}{pending ? 'Speichert…' : saved ? 'Hinzugefügt' : 'Hinzufügen'}</button>
    </div>
    {error && <p className="mt-3 rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}
  </form>
}
