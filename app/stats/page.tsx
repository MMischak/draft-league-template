import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ChartNoAxesCombined, Crown, Gauge, Sparkles, TrendingDown, TrendingUp, Trophy, UsersRound } from 'lucide-react'
import { ClubCrest } from '@/components/club-identity'
import { getClubName } from '@/lib/football/clubs'
import { requireViewer } from '@/lib/league-data'
import { parseSeasonStatistics, type LineupRecord } from '@/lib/statistics/season'

export const metadata: Metadata = { title: 'Statistik-Center' }

function LineupRanking({ title, entries, positive, viewerId }: { title: string; entries: LineupRecord[]; positive: boolean; viewerId: string }) {
  const Icon = positive ? TrendingUp : TrendingDown
  return <section className="surface overflow-hidden">
    <header className={`flex items-center justify-between border-b px-5 py-4 ${positive ? 'border-[#236845]/15 bg-[#236845]/7' : 'border-[#e93545]/15 bg-[#e93545]/7'}`}><h2 className="font-serif text-xl font-black">{title}</h2><Icon className={`size-5 ${positive ? 'text-[#236845]' : 'text-[#e93545]'}`} /></header>
    {entries.length ? <div className="divide-y divide-[#0f1e3a]/8">{entries.map((entry, index) => <article key={`${entry.managerId}-${entry.gameweekNumber}`} className={`grid grid-cols-[34px_1fr_auto] items-center gap-3 px-5 py-4 ${entry.managerId === viewerId ? 'bg-[#315dc6]/6' : ''}`}><span className="font-serif text-2xl font-black text-[#0f1e3a]/25">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{entry.managerName}{entry.managerId === viewerId ? ' · Du' : ''}</p><p className="mt-0.5 font-mono text-[9px] text-[#0f1e3a]/40">Gameweek {entry.gameweekNumber}</p></div><span className={`font-serif text-2xl font-black ${positive ? 'text-[#236845]' : 'text-[#e93545]'}`}>{entry.score.toFixed(1)}</span></article>)}</div> : <p className="px-5 py-10 text-center text-sm text-[#0f1e3a]/45">Noch keine gewerteten Aufstellungen.</p>}
  </section>
}

export default async function StatisticsPage() {
  const { supabase, manager, league } = await requireViewer()
  const { data, error } = await supabase.rpc('get_season_statistics')
  if (error) throw new Error('Die Saisonstatistiken konnten nicht geladen werden.')
  const stats = parseSeasonStatistics(data)
  const averageLeaders = [...stats.managers].sort((left, right) => right.average - left.average || right.total - left.total)
  const benchLeaders = [...stats.managers].sort((left, right) => right.benchPoints - left.benchPoints || right.total - left.total)
  const efficiencyLeaders = [...stats.managers].sort((left, right) => right.efficiency - left.efficiency || right.total - left.total)
  const hasStatistics = stats.playedGameweeks > 0
  const recordCards = [
    { label: 'Meiste GW-Siege', value: stats.records.mostWins ? stats.records.mostWins.value.toFixed(0) : '—', name: stats.records.mostWins?.managerName ?? 'Noch offen', icon: Trophy, color: '#d79a2b' },
    { label: 'Konstanzpreis', value: stats.records.mostConsistent ? `± ${stats.records.mostConsistent.value.toFixed(1)}` : '—', name: stats.records.mostConsistent?.managerName ?? 'Ab 2 Gameweeks', icon: Gauge, color: '#315dc6' },
    { label: 'Bestes Spieler-GW', value: stats.records.bestPlayerGameweek?.score.toFixed(1) ?? '—', name: stats.records.bestPlayerGameweek ? `${stats.records.bestPlayerGameweek.playerName} · GW ${stats.records.bestPlayerGameweek.gameweekNumber}` : 'Noch offen', icon: Sparkles, color: '#236845' },
  ]

  return <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <Link href="/leaderboard" className="inline-flex items-center gap-2 text-xs font-bold text-[#0f1e3a]/55 hover:text-[#315dc6]"><ArrowLeft className="size-4" /> Zurück zum Leaderboard</Link>

    <section className="ticket-cut relative mt-5 overflow-hidden bg-[#0f1e3a] p-6 text-white shadow-[0_20px_55px_rgba(15,30,58,.2)] sm:p-8">
      <div aria-hidden="true" className="absolute -right-10 -top-12 size-44 rounded-full border-[28px] border-white/[.045]" />
      <div className="relative flex flex-wrap items-end justify-between gap-8"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffd166]">{league.season_label}</p><h1 className="mt-2 font-serif text-4xl font-black sm:text-5xl">Statistik-Center</h1></div><div className="flex gap-6"><div><p className="font-serif text-4xl font-black">{stats.playedGameweeks}</p><p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-widest text-white/45">Gameweeks</p></div><div><p className="font-serif text-4xl font-black">{stats.scoredLineups}</p><p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-widest text-white/45">Aufstellungen</p></div></div></div>
    </section>

    {!hasStatistics ? <section className="surface mt-4 grid min-h-64 place-items-center px-6 text-center"><div><ChartNoAxesCombined className="mx-auto size-9 text-[#315dc6]/35" /><h2 className="mt-4 font-serif text-2xl font-black">Noch keine Saisonwerte</h2><p className="mt-2 text-sm text-[#0f1e3a]/50">Nach der ersten Spielerwertung erscheinen hier die Liga-Rekorde.</p></div></section> : <>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{recordCards.map((record) => { const Icon = record.icon; return <article key={record.label} className="surface flex items-center gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${record.color}16`, color: record.color }}><Icon className="size-5" /></span><div className="min-w-0"><p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[#0f1e3a]/40">{record.label}</p><div className="mt-1 flex min-w-0 items-baseline gap-2"><strong className="font-serif text-2xl font-black">{record.value}</strong><span className="truncate text-xs font-bold text-[#0f1e3a]/55">{record.name}</span></div></div></article> })}</div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2"><LineupRanking title="Beste Aufstellungen" entries={stats.topLineups} positive viewerId={manager.id} /><LineupRanking title="Schwächste Aufstellungen" entries={stats.bottomLineups} positive={false} viewerId={manager.id} /></div>

      <section className="surface mt-4 overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-[#0f1e3a]/10 px-5 py-5 sm:px-6"><h2 className="font-serif text-2xl font-black">Manager-Vergleich</h2><UsersRound className="size-6 text-[#315dc6]" /></header>
        <div className="divide-y divide-[#0f1e3a]/8 md:hidden">{averageLeaders.map((entry, index) => { const benchRank = benchLeaders.findIndex((candidate) => candidate.managerId === entry.managerId); const efficiencyRank = efficiencyLeaders.findIndex((candidate) => candidate.managerId === entry.managerId); return <article key={entry.managerId} className={`p-4 ${entry.managerId === manager.id ? 'bg-[#315dc6]/6' : ''}`}>
          <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0f1e3a]/6 font-serif text-xl font-black text-[#0f1e3a]/45">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.managerName}{entry.managerId === manager.id ? ' · Du' : ''}</p><p className="mt-0.5 font-mono text-[8px] text-[#0f1e3a]/35">{entry.played} GW · {entry.wins} Siege</p></div></div>
          <dl className="mt-3 grid grid-cols-3 gap-1.5"><div className={`rounded-xl px-2 py-2.5 text-center ${index === 0 ? 'bg-[#315dc6]/9 text-[#315dc6]' : 'bg-[#0f1e3a]/[.035]'}`}><dt className="font-mono text-[7px] font-bold uppercase tracking-wide opacity-55">Ø Startelf</dt><dd className="mt-1 font-serif text-xl font-black leading-none">{entry.average.toFixed(1)}</dd></div><div className={`rounded-xl px-2 py-2.5 text-center ${benchRank === 0 ? 'bg-[#d79a2b]/14 text-[#93620d]' : 'bg-[#0f1e3a]/[.035]'}`}><dt className="font-mono text-[7px] font-bold uppercase tracking-wide opacity-55">Bank</dt><dd className="mt-1 font-serif text-xl font-black leading-none">{entry.benchPoints.toFixed(1)}</dd></div><div className={`rounded-xl px-2 py-2.5 text-center ${efficiencyRank === 0 ? 'bg-[#236845]/10 text-[#236845]' : 'bg-[#0f1e3a]/[.035]'}`}><dt className="font-mono text-[7px] font-bold uppercase tracking-wide opacity-55">Optimum</dt><dd className="mt-1 font-serif text-xl font-black leading-none">{entry.efficiency.toFixed(0)}%</dd></div></dl>
        </article>})}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[660px] border-collapse"><thead><tr className="border-b border-[#0f1e3a]/8 font-mono text-[8px] font-bold uppercase tracking-wider text-[#0f1e3a]/40"><th className="px-5 py-3 text-left sm:px-6">Manager</th><th className="px-3 py-3 text-right">Ø Startelf</th><th className="px-3 py-3 text-right">Bankpunkte</th><th className="px-5 py-3 text-right sm:px-6">Optimum erreicht</th></tr></thead><tbody className="divide-y divide-[#0f1e3a]/8">{averageLeaders.map((entry, index) => { const benchRank = benchLeaders.findIndex((candidate) => candidate.managerId === entry.managerId); const efficiencyRank = efficiencyLeaders.findIndex((candidate) => candidate.managerId === entry.managerId); return <tr key={entry.managerId} className={entry.managerId === manager.id ? 'bg-[#315dc6]/6' : ''}><td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="font-serif text-xl font-black text-[#0f1e3a]/25">{index + 1}</span><div><p className="text-sm font-bold">{entry.managerName}{entry.managerId === manager.id ? ' · Du' : ''}</p><p className="mt-0.5 font-mono text-[8px] text-[#0f1e3a]/35">{entry.played} GW · {entry.wins} Siege</p></div></div></td><td className="px-3 py-4 text-right font-serif text-xl font-black">{entry.average.toFixed(1)}</td><td className="px-3 py-4 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-xs font-bold ${benchRank === 0 ? 'bg-[#d79a2b]/14 text-[#9a6811]' : 'text-[#0f1e3a]/65'}`}>{entry.benchPoints.toFixed(1)}</span></td><td className="px-5 py-4 text-right sm:px-6"><span className={`font-mono text-xs font-bold ${efficiencyRank === 0 ? 'text-[#236845]' : 'text-[#0f1e3a]/65'}`}>{entry.efficiency.toFixed(0)} %</span></td></tr>})}</tbody></table></div>
        <div className="border-t border-[#0f1e3a]/8 px-5 py-3 text-[10px] leading-4 text-[#0f1e3a]/40 sm:px-6"><p>Optimum = erreichte Startelfpunkte im Vergleich zur punktbesten gültigen Formation aus dem eigenen Kader. 100 % bedeutet: bestmögliche Startelf gewählt.</p><p className="mt-1">Bankpunkte = Wertungen aus dem aktuellen Kader, die in der jeweiligen Gameweek nicht in der gespeicherten Startelf standen.</p></div>
      </section>

      <section className="surface mt-4 overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#0f1e3a]/10 px-5 py-5 sm:px-6"><div><p className="eyebrow text-[#d79a2b]">Top 5</p><h2 className="mt-1 font-serif text-2xl font-black">Spieler der Saison</h2></div><Crown className="size-6 text-[#d79a2b]" /></header>
        <div className="grid divide-y divide-[#0f1e3a]/8 lg:grid-cols-5 lg:divide-x lg:divide-y-0">{stats.players.map((player, index) => <article key={player.playerId} className={`relative p-4 sm:p-5 ${player.managerId === manager.id ? 'bg-[#315dc6]/6' : ''}`}><span className="absolute right-3 top-3 font-serif text-3xl font-black text-[#0f1e3a]/8">{index + 1}</span><div className="flex items-center gap-3 lg:block"><ClubCrest code={player.clubCode} size={38} /><div className="min-w-0 lg:mt-4"><h3 className="truncate text-sm font-black">{player.playerName}</h3><p className="mt-0.5 truncate text-[9px] text-[#0f1e3a]/40">{getClubName(player.clubCode)} · {player.position}</p></div></div><div className="mt-4 flex items-end justify-between gap-2"><div><p className="font-serif text-3xl font-black leading-none">{player.points.toFixed(1)}</p><p className="mt-1 font-mono text-[8px] text-[#0f1e3a]/35">{player.gameweeks} GW</p></div><p className="max-w-24 truncate text-right text-[10px] font-bold text-[#315dc6]">{player.managerName}</p></div></article>)}</div>
      </section>
    </>}
  </main>
}
