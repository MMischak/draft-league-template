'use client'

import { useState, useTransition } from 'react'
import { HeartPulse, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ImportResult = {
  checked: number
  unavailable: number
  questionable: number
  out: number
  suspended: number
  source: string
  updatedAt: string
}

export function InjuryImportControl() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const importInjuries = () => {
    setError('')
    setResult(null)
    startTransition(async () => {
      const { data, error: invokeError } = await createClient().functions.invoke<ImportResult>('import-player-availability')
      if (invokeError) {
        let message = invokeError.message
        const context = 'context' in invokeError ? invokeError.context : null
        if (context instanceof Response) {
          const body = await context.clone().json().catch(() => null) as { error?: string } | null
          if (body?.error) message = body.error
        }
        setError(message)
        return
      }
      setResult(data)
      window.dispatchEvent(new Event('player-availability-updated'))
    })
  }

  return <section className="surface p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#fff0f1] text-[#b32131]"><HeartPulse className="size-5" /></span>
        <div><h2 className="font-serif text-xl font-black">Spielerstatus</h2><p className="text-xs text-[#0f1e3a]/48">Verletzungen und Sperren der Draft-Picks</p></div>
      </div>
      <button type="button" disabled={pending} onClick={importInjuries} className="flex items-center gap-2 rounded-xl bg-[#b32131] px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-45">
        <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Prüft…' : 'Status aktualisieren'}
      </button>
    </div>
    {result && <p className="mt-4 rounded-xl bg-[#e9f5ec] p-3 text-sm font-semibold text-[#236845]">
      {result.checked} Picks geprüft · {result.unavailable} markiert ({result.questionable} fraglich, {result.out} aus, {result.suspended} gesperrt)
    </p>}
    {error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-sm font-semibold text-[#b32131]">{error}</p>}
  </section>
}
