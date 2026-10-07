import Link from 'next/link'
import { ArrowRight, ChartNoAxesCombined } from 'lucide-react'
import { LeaderboardHistory } from '@/components/leaderboard-history'
import { LeaderboardStandings } from '@/components/leaderboard-standings'
import { buildCurrentMatchdayRows } from '@/lib/leaderboard-matchday'
import { getCurrentGameweek, leaderboard, requireManager } from '@/lib/league-data'

export default async function LeaderboardPage() {
  const { supabase, manager } = await requireManager()
  const gameweek = await getCurrentGameweek(supabase)
  const [{ data: managers }, { data: scores }, { data: visibleGameweeks }, { data: currentLineups }, { data: currentFixtures }] = await Promise.all([
    supabase.from('managers').select('id,display_name').order('draft_position'),
    supabase.from('manager_gameweek_scores').select('manager_id,gameweek_id,score'),
    supabase.from('gameweeks').select('id,number').in('status', ['live', 'final']).order('number'),
    gameweek
      ? supabase.from('lineups').select('manager_id,lineup_players(player_id,is_starter,players(club_code))').eq('gameweek_id', gameweek.id)
      : Promise.resolve({ data: [] }),
    gameweek
      ? supabase.from('fixtures').select('home_club_code,away_club_code,kickoff_at,finished').eq('gameweek_id', gameweek.id)
      : Promise.resolve({ data: [] }),
  ])
  const standings = leaderboard(managers ?? [], scores ?? [], gameweek?.id)
  const currentMatchdayRows = buildCurrentMatchdayRows(
    standings.map((entry) => ({ managerId: entry.manager.id, displayName: entry.manager.display_name, score: Number(entry.week), isViewer: entry.manager.id === manager.id })),
    (currentLineups ?? []).map((lineup) => ({
      managerId: lineup.manager_id,
      players: (lineup.lineup_players ?? []).flatMap((entry) => entry.players ? [{ playerId: entry.player_id, clubCode: entry.players.club_code, isStarter: entry.is_starter }] : []),
    })),
    (currentFixtures ?? []).map((fixture) => ({ homeClubCode: fixture.home_club_code, awayClubCode: fixture.away_club_code, kickoffAt: fixture.kickoff_at, finished: fixture.finished })),
  )
  const historyManagers = (managers ?? []).map((entry) => ({ managerId: entry.id, displayName: entry.display_name, isViewer: entry.id === manager.id }))
  const historyGameweeks = (visibleGameweeks ?? []).map((entry) => ({ id: entry.id, number: entry.number }))
  const historyScores = (scores ?? []).map((entry) => ({ managerId: entry.manager_id, gameweekId: entry.gameweek_id, score: Number(entry.score) }))

  return <main className="mx-auto max-w-[1080px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-9">
    <div className="mb-4 sm:mb-6"><p className="eyebrow text-[#315dc6]">{gameweek ? `Gameweek ${gameweek.number}` : 'Aktive Saison'}</p><h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Leaderboard</h1></div>
    <Link href="/stats" className="group flex items-center justify-between gap-4 rounded-2xl bg-[#315dc6] p-4 text-white shadow-[0_12px_30px_rgba(49,93,198,.2)] transition hover:-translate-y-0.5 hover:bg-[#294fac] sm:px-5 sm:py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12"><ChartNoAxesCombined className="size-5" /></span><div className="min-w-0"><p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/50">Rekorde & Saisonwerte</p><h2 className="mt-0.5 truncate font-serif text-xl font-black">Statistik-Center</h2></div></div><ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" /></Link>
    <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4"><LeaderboardStandings standings={standings.map((entry) => ({ managerId: entry.manager.id, displayName: entry.manager.display_name, rank: entry.rank, week: Number(entry.week), total: entry.total, isViewer: entry.manager.id === manager.id }))} gameweeks={historyGameweeks} currentGameweekId={gameweek?.id ?? null} currentMatchday={gameweek ? { gameweekNumber: gameweek.number, rows: currentMatchdayRows, fixturesAvailable: Boolean(currentFixtures?.length) } : null} /><LeaderboardHistory managers={historyManagers} gameweeks={historyGameweeks} scores={historyScores} /></div>
  </main>
}
