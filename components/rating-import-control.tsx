'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type GameweekOption = { id: string; number: number; status: string }
type ImportRun = {
  id: string
  gameweek_id: string
  status: string
  finished_at: string | null
  imported_count: number
  missing_mapping_count: number
  error_summary: string | null
}

type ImportResult = {
  imported: number
  fixtures: number
  fixtureCount: number
  missingMappings: number
  incompleteFixtures: number
  failedFixtures: number
  status: string
}

function lastRunLabel(run: ImportRun) {
  if (run.status === 'failed') return run.error_summary ?? 'Letzter Import fehlgeschlagen.'
  const time = run.finished_at
    ? new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(run.finished_at))
    : 'läuft'
  return `${run.imported_count} Wertungen · ${run.missing_mapping_count} ohne Zuordnung · ${time}`
}

export function RatingImportControl({ gameweeks, runs, initialGameweekId }: {
  gameweeks: GameweekOption[]
  runs: ImportRun[]
  initialGameweekId: string | null
}) {
  const router = useRouter()
  const [gameweekId, setGameweekId] = useState(initialGameweekId ?? gameweeks[0]?.id ?? '')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const selected = gameweeks.find((gameweek) => gameweek.id === gameweekId)
  const latestRun = useMemo(() => runs.find((run) => run.gameweek_id === gameweekId), [gameweekId, runs])
  const canImport = selected?.status === 'live' || selected?.status === 'final'

  const importRatings = () => {
    setError('')
    setResult(null)
    startTransition(async () => {
      const { data, error: invokeError } = await createClient().functions.invoke<ImportResult>('import-sofascore-ratings', {
        body: { gameweekId },
      })

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
      router.refresh()
    })
  }

  return <section className="surface p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <label htmlFor="rating-gameweek" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#0f1e3a]/45">Spieltag</label>
        <select id="rating-gameweek" value={gameweekId} onChange={(event) => { setGameweekId(event.target.value); setResult(null); setError('') }} className="min-w-44 rounded-xl border border-[#0f1e3a]/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-[#236845]">
          {gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>Gameweek {gameweek.number}</option>)}
        </select>
      </div>
      <button type="button" disabled={pending || !canImport} onClick={importRatings} className="flex items-center gap-2 rounded-xl bg-[#236845] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
        {latestRun ? 'Wertungen neu laden' : 'Spielerwertungen laden'}
      </button>
    </div>
    {!canImport && <p className="mt-3 text-sm text-[#0f1e3a]/55">Die Aufstellungen müssen zuerst geschlossen werden.</p>}
    {latestRun && !result && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${latestRun.status === 'failed' ? 'bg-[#fff0f1] text-[#b32131]' : 'bg-[#f3f6f4] text-[#335143]'}`}>{lastRunLabel(latestRun)}</p>}
    {result && <p className="mt-4 rounded-xl bg-[#e9f5ec] p-3 text-sm font-semibold text-[#236845]">
      {result.imported} Wertungen aktualisiert · {result.missingMappings} ohne Zuordnung · {result.fixtures}/{result.fixtureCount} Spiele gefunden
      {(result.incompleteFixtures > 0 || result.failedFixtures > 0) && ` · ${result.incompleteFixtures + result.failedFixtures} Spiele offen oder fehlgeschlagen`}
    </p>}
    {error && <p className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-sm font-semibold text-[#b32131]">{error}</p>}
  </section>
}
