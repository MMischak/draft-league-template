'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Save, UsersRound } from 'lucide-react'
import { moveDraftManager } from '@/lib/draft/snake-order'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type Manager = Tables<'managers'>

export function DraftOrderSettings({ managers, pickCount }: { managers: Manager[]; pickCount: number }) {
  const router = useRouter()
  const initialOrder = [...managers].sort((a, b) => a.draft_position - b.draft_position)
  const [order, setOrder] = useState(initialOrder)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const locked = pickCount > 0
  const changed = order.some((manager, index) => manager.id !== initialOrder[index]?.id)

  const move = (from: number, to: number) => {
    setSaved(false)
    setError('')
    setOrder((current) => moveDraftManager(current, from, to))
  }

  const save = () => {
    setSaved(false)
    setError('')
    startTransition(async () => {
      const { error: saveError } = await createClient().rpc('set_draft_order', {
        p_manager_ids: order.map((manager) => manager.id),
      })
      if (saveError) {
        setError(saveError.message)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return <section className="surface p-5 sm:p-6">
    <div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Draft-Reihenfolge</h2><UsersRound className="size-5 text-[#315dc6]" /></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-5">{order.map((manager, index) => <div key={manager.id} className="rounded-xl bg-[#0f1e3a]/5 p-3"><span className="font-mono text-[9px] text-[#0f1e3a]/35">PLATZ {index + 1}</span><p className="mt-2 truncate text-sm font-bold">{manager.display_name}</p>{manager.is_commissioner && <p className="mt-1 text-[9px] font-bold text-[#e93545]">COMMISSIONER</p>}<div className="mt-3 flex gap-1"><button type="button" aria-label={`${manager.display_name} nach links`} disabled={locked || pending || index === 0} onClick={() => move(index, index - 1)} className="grid size-8 place-items-center rounded-lg border border-[#0f1e3a]/10 bg-white/60 disabled:opacity-25"><ArrowLeft className="size-3.5" /></button><button type="button" aria-label={`${manager.display_name} nach rechts`} disabled={locked || pending || index === order.length - 1} onClick={() => move(index, index + 1)} className="grid size-8 place-items-center rounded-lg border border-[#0f1e3a]/10 bg-white/60 disabled:opacity-25"><ArrowRight className="size-3.5" /></button></div></div>)}</div>
    {managers.length !== 5 && <p className="mt-4 text-xs text-[#0f1e3a]/45">{managers.length} von 5 Managern sind registriert. Neue Mitglieder erhalten automatisch den nächsten Platz.</p>}
    {locked && <p className="mt-4 rounded-xl bg-[#fff8e8] p-3 text-xs font-bold text-[#7c5a1b]">Nach dem ersten Pick ist die Reihenfolge gesperrt.</p>}
    {error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}
    <button type="button" disabled={locked || pending || !changed} onClick={save} className="mt-4 flex items-center gap-2 rounded-xl bg-[#0f1e3a] px-4 py-3 text-sm font-bold text-white disabled:opacity-35">{saved ? <Check className="size-4" /> : <Save className="size-4" />}{pending ? 'Speichert…' : saved ? 'Gespeichert' : 'Reihenfolge speichern'}</button>
  </section>
}
