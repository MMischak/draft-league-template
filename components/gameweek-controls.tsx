'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock, Play, RotateCcw } from 'lucide-react'
import type { GameweekStatus } from '@/lib/gameweeks/status'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

type Gameweek = Tables<'gameweeks'>

const statusLabel: Record<GameweekStatus, string> = {
  pending: 'Wartet auf Start',
  lineup: 'Aufstellung offen',
  live: 'Aufstellung geschlossen',
  final: 'Abgeschlossen',
}

export function GameweekControls({ gameweek }: { gameweek: Gameweek | null }) {
  const router = useRouter()
  const [status, setStatus] = useState<GameweekStatus>((gameweek?.status as GameweekStatus) ?? 'pending')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (!gameweek) return null

  const changeStatus = (nextStatus: GameweekStatus) => {
    setError('')
    startTransition(async () => {
      const { error: updateError } = await createClient()
        .from('gameweeks')
        .update({ status: nextStatus })
        .eq('id', gameweek.id)
        .eq('status', status)
        .select('status')
        .single()

      if (updateError) {
        setError(updateError.message)
        return
      }

      setStatus(nextStatus)
      router.refresh()
    })
  }

  return <section className="surface p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-black">Gameweek {gameweek.number}</h2>
      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === 'lineup' ? 'bg-[#e9f5ec] text-[#236845]' : 'bg-[#0f1e3a]/6 text-[#0f1e3a]/55'}`}>{statusLabel[status]}</span>
    </div>
    {error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      {status === 'pending' && <button type="button" disabled={pending} onClick={() => changeStatus('lineup')} className="flex items-center gap-2 rounded-xl bg-[#236845] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Play className="size-4" />Gameweek starten</button>}
      {status === 'lineup' && <button type="button" disabled={pending} onClick={() => changeStatus('live')} className="flex items-center gap-2 rounded-xl bg-[#0f1e3a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Lock className="size-4" />Aufstellungen schließen</button>}
      {status === 'live' && <><button type="button" disabled={pending} onClick={() => changeStatus('lineup')} className="flex items-center gap-2 rounded-xl border border-[#0f1e3a]/15 px-4 py-3 text-sm font-bold disabled:opacity-40"><RotateCcw className="size-4" />Wieder öffnen</button><button type="button" disabled={pending} onClick={() => changeStatus('final')} className="flex items-center gap-2 rounded-xl bg-[#0f1e3a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Check className="size-4" />Gameweek abschließen</button></>}
    </div>
  </section>
}
