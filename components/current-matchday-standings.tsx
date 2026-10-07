import { ChevronRight, Clock3 } from 'lucide-react'
import type { MatchdayRow } from '@/lib/leaderboard-matchday'

export function CurrentMatchdayStandings({ gameweekNumber, rows, fixturesAvailable, onManagerClick }: {
  gameweekNumber: number
  rows: MatchdayRow[]
  fixturesAvailable: boolean
  onManagerClick: (managerId: string) => void
}) {
  return <section className="surface overflow-hidden">
    <header className="flex items-center justify-between gap-3 border-b border-[#0f1e3a]/10 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#315dc6]/10 text-[#315dc6]"><Clock3 className="size-4" /></span><div className="min-w-0"><p className="font-serif text-lg font-black leading-none">Aktueller Matchday</p><p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#315dc6]">Gameweek {gameweekNumber}</p></div></div>
      <span className="font-mono text-[8px] font-bold uppercase tracking-wide text-[#0f1e3a]/35">GW-Punkte</span>
    </header>
    <div className="divide-y divide-[#0f1e3a]/10">
      {rows.map((entry) => <button type="button" key={entry.managerId} aria-label={`Aufstellung von ${entry.displayName} öffnen`} onClick={() => onManagerClick(entry.managerId)} className={`grid min-h-12 w-full grid-cols-[28px_minmax(0,1fr)_48px_14px] items-center px-3 py-2.5 text-left transition hover:bg-[#0f1e3a]/4 sm:grid-cols-[34px_minmax(0,1fr)_56px_16px] sm:px-4 ${entry.isViewer ? 'bg-[#315dc6]/7 text-[#315dc6]' : ''}`}>
        <span className="font-serif text-lg font-black">{entry.rank}</span>
        <div className="flex min-w-0 items-center gap-2 pr-2"><p className="truncate text-[13px] font-bold">{entry.displayName}{entry.isViewer ? ' · Du' : ''}</p><span title="Startelf-Spieler mit noch offenem Spiel" className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase ${fixturesAvailable && entry.remainingPlayers > 0 ? 'bg-[#236845]/10 text-[#236845]' : 'bg-[#0f1e3a]/6 text-[#0f1e3a]/40'}`}>{fixturesAvailable ? `${entry.remainingPlayers} offen` : '—'}</span></div>
        <strong className="text-right font-mono text-sm font-black">{entry.score.toFixed(1)}</strong>
        <ChevronRight className="ml-auto size-3.5 opacity-30" />
      </button>)}
    </div>
  </section>
}
