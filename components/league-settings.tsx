'use client'

import { FormEvent, useState, useTransition } from 'react'
import { Check, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

function inputDate(value: string | null) { return value ? value.slice(0, 10) : '' }

export function LeagueSettings({ league }: { league: Tables<'leagues'> }) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaved(false)
    setError('')
    startTransition(async () => {
      const opens = String(form.get('opens') || '')
      const closes = String(form.get('closes') || '')
      const { error: updateError } = await createClient().from('leagues').update({
        name: String(form.get('name') || '').trim(),
        season_label: String(form.get('season') || '').trim(),
        transfer_opens_at: opens ? new Date(`${opens}T00:00:00+02:00`).toISOString() : null,
        transfer_closes_at: closes ? new Date(`${closes}T23:59:59+02:00`).toISOString() : null,
      }).eq('id', league.id)
      if (updateError) { setError(updateError.message); return }
      setSaved(true)
    })
  }
  return <form onSubmit={submit} className="surface p-5 sm:p-6"><h2 className="font-serif text-xl font-black">Liga-Einstellungen</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Liganame<input name="name" required defaultValue={league.name} className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">Saison<input name="season" required defaultValue={league.season_label} className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">Transferfenster öffnet<input name="opens" type="date" defaultValue={inputDate(league.transfer_opens_at)} className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] px-3 text-sm font-normal" /></label><label className="text-xs font-bold">Transferfenster schließt<input name="closes" type="date" defaultValue={inputDate(league.transfer_closes_at)} className="mt-2 h-11 w-full rounded-xl border border-[#0f1e3a]/15 bg-[#f6f0e2] px-3 text-sm font-normal" /></label></div>{error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}<button disabled={pending} className="mt-5 flex items-center gap-2 rounded-xl bg-[#0f1e3a] px-4 py-3 text-sm font-bold text-white">{saved ? <Check className="size-4" /> : <Save className="size-4" />}{pending ? 'Speichert…' : saved ? 'Gespeichert' : 'Einstellungen speichern'}</button></form>
}
