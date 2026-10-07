import Link from 'next/link'
import { ArrowRight, CalendarClock, CheckCircle2, CircleDot, Lightbulb, Repeat2, Trophy, UsersRound } from 'lucide-react'
import { ClubIdentity } from '@/components/club-identity'
import { isLineupOpen } from '@/lib/gameweeks/status'
import { formatDate, formatKickoff, getCurrentGameweek, leaderboard, requireViewer } from '@/lib/league-data'

export default async function DashboardPage() {
  const { supabase, manager, league } = await requireViewer()
  const gameweek = await getCurrentGameweek(supabase)
  const [{ data: managers }, { data: scores }, { count: pickCount }, { data: fixtures }, { data: lineup }] = await Promise.all([
    supabase.from('managers').select('*').order('draft_position'),
    supabase.from('manager_gameweek_scores').select('*'),
    supabase.from('draft_picks').select('id', { count: 'exact', head: true }),
    gameweek ? supabase.from('fixtures').select('id,kickoff_at,home_club_code,away_club_code').eq('gameweek_id', gameweek.id).order('kickoff_at').limit(3) : Promise.resolve({ data: [] }),
    gameweek ? supabase.from('lineups').select('id').eq('gameweek_id', gameweek.id).eq('manager_id', manager.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const standings = leaderboard(managers ?? [], scores ?? [], gameweek?.id)
  const ownStanding = standings.find((entry) => entry.manager.id === manager.id)
  const leader = standings[0]
  const draftComplete = (pickCount ?? 0) === 100
  const phase = gameweek?.status ?? 'lineup'
  const lineupOpen = isLineupOpen(phase)
  const gameweekStatus = phase === 'pending' ? 'Noch nicht gestartet' : lineupOpen ? 'Aufstellung offen' : phase === 'final' ? 'Abgeschlossen' : 'Aufstellung gesperrt'

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow text-[#315dc6]">{league.season_label}{gameweek ? ` · Gameweek ${gameweek.number}` : ''}</p><h1 className="mt-1 font-serif text-3xl font-black tracking-tight sm:text-4xl">Hallo, {manager.display_name}.</h1></div>
        <Link href={draftComplete ? '/week' : '/draft'} className="inline-flex items-center gap-2 rounded-full bg-[#0f1e3a] px-5 py-3 text-xs font-bold text-white">{draftComplete ? 'Aufstellung öffnen' : 'Draft öffnen'}<ArrowRight className="size-4" /></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.6fr)]">
        <section className="ticket-cut relative overflow-hidden bg-[#315dc6] p-5 text-white shadow-[0_20px_50px_rgba(49,93,198,.22)] sm:p-7">
          <div className="relative grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/65">{draftComplete ? gameweekStatus : 'Draft läuft'}</p><p className="mt-3 font-serif text-4xl font-black leading-none sm:text-5xl">{draftComplete ? `Gameweek ${gameweek?.number ?? 1}` : `${pickCount ?? 0} / 100`}</p>{!draftComplete && <p className="mt-2 text-sm text-white/70">Picks</p>}<div className="mt-6 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/12 px-3 py-1.5">{managers?.length ?? 0} / 5 Manager</span><span className={`rounded-full px-3 py-1.5 ${lineup ? 'bg-[#45a264]' : 'bg-white/12'}`}>{lineup ? 'Aufstellung gespeichert' : 'Keine Aufstellung'}</span></div></div>{gameweek?.first_kickoff_at && <div className="rounded-2xl border border-white/15 bg-[#0f1e3a]/22 p-4 sm:min-w-52"><p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">Erster Anpfiff</p><p className="mt-2 font-serif text-2xl font-black">{formatKickoff(gameweek.first_kickoff_at)}</p></div>}</div>
        </section>

        <section className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-black">Ligaposition</h2><Trophy className="size-6 text-[#d79a2b]" /></div><div className="mt-6 flex items-end gap-3"><span className="font-serif text-7xl font-black leading-none">{ownStanding?.rank ?? '—'}</span><div className="pb-1"><p className="text-sm font-bold">von {managers?.length ?? 0} Managern</p><p className="mt-1 text-xs text-[#0f1e3a]/50">{leader && ownStanding ? `${Math.max(0, leader.total - ownStanding.total).toFixed(1)} Punkte Rückstand` : 'Noch keine Scores'}</p></div></div><Link href="/leaderboard" className="mt-6 flex items-center justify-between border-t border-[#0f1e3a]/10 pt-4 text-xs font-bold text-[#315dc6]">Leaderboard öffnen <ArrowRight className="size-4" /></Link></section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="surface p-5 lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Nächste Spiele</h2><CalendarClock className="size-5 text-[#315dc6]" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{fixtures?.length ? fixtures.map((fixture) => <div key={fixture.id} className="rounded-xl bg-[#0f1e3a]/5 p-3.5"><p className="font-mono text-[9px] font-bold text-[#0f1e3a]/45">{formatKickoff(fixture.kickoff_at)}</p><div className="mt-3 space-y-2"><ClubIdentity code={fixture.home_club_code} size={26} nameClassName="text-xs font-bold leading-tight" /><ClubIdentity code={fixture.away_club_code} size={26} nameClassName="text-xs font-bold leading-tight text-[#0f1e3a]/62" /></div></div>) : <p className="text-sm text-[#0f1e3a]/50">Keine Spiele.</p>}</div></section>
        <section className="surface p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Transferfenster</p><h2 className="mt-1 font-serif text-xl font-black">{formatDate(league.transfer_opens_at)}</h2></div><Repeat2 className="size-5 text-[#236845]" /></div><p className="mt-4 text-sm leading-6 text-[#0f1e3a]/55">Bis zu fünf Zugänge über Trades oder freie Spieler.</p><Link href="/transfers" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#315dc6]">Transferbereich <ArrowRight className="size-4" /></Link></section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <section className="surface p-5"><p className="eyebrow">Liga-Status</p><div className="mt-4 space-y-3"><div className="flex items-center gap-3 text-sm">{draftComplete ? <CheckCircle2 className="size-4 text-[#236845]" /> : <CircleDot className="size-4 text-[#d79a2b]" />}<span>Draft · {pickCount ?? 0} von 100 Picks</span></div><div className="flex items-center gap-3 text-sm">{managers?.length === 5 ? <CheckCircle2 className="size-4 text-[#236845]" /> : <CircleDot className="size-4 text-[#d79a2b]" />}<span>{managers?.length ?? 0} von 5 Managern registriert</span></div></div></section>
        <section className="surface overflow-hidden"><div className="flex items-center justify-between px-5 pt-5"><h2 className="font-serif text-xl font-black">Leaderboard</h2><UsersRound className="size-5 text-[#e93545]" /></div><div className="mt-3 divide-y divide-[#0f1e3a]/10">{standings.slice(0, 3).map((entry) => <div key={entry.manager.id} className={`grid grid-cols-[36px_1fr_auto] items-center px-5 py-3.5 ${entry.manager.id === manager.id ? 'bg-[#315dc6]/7 text-[#315dc6]' : ''}`}><span className="font-serif text-xl font-black">{entry.rank}</span><span className="text-sm font-bold">{entry.manager.display_name}</span><span className="font-mono text-xs font-bold">{entry.total.toFixed(1)}</span></div>)}</div></section>
      </div>

      <section className="surface mt-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-[#d79a2b] p-5">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#d79a2b]/15 text-[#a66f0e]"><Lightbulb className="size-5" /></span><div><h2 className="font-serif text-lg font-black">Ideen für unsere Liga</h2><p className="mt-0.5 text-xs text-[#0f1e3a]/50">Vorschläge teilen, abstimmen und diskutieren.</p></div></div>
        <Link href="/ideas" className="inline-flex items-center gap-2 rounded-full bg-[#0f1e3a] px-4 py-2.5 text-xs font-bold text-white">Ideen öffnen <ArrowRight className="size-4" /></Link>
      </section>
    </main>
  )
}
