import { LineupEditor } from '@/components/lineup-editor'
import { selectGameweek } from '@/lib/gameweeks/selection'
import { requireManager } from '@/lib/league-data'

export default async function MatchdayPage({ searchParams }: { searchParams: Promise<{ gameweek?: string | string[] }> }) {
  const { supabase, manager } = await requireManager()
  const requested = (await searchParams).gameweek
  const [{ data: gameweeks }, { data: squad }] = await Promise.all([
    supabase
      .from('gameweeks')
      .select('id,number,status')
      .eq('league_id', manager.league_id)
      .order('number'),
    supabase
      .from('players')
      .select('id,league_id,owner_id,provider_id,display_name,position,club_code,availability_status,is_injured,injury_note')
      .eq('owner_id', manager.id)
      .order('display_name'),
  ])
  const gameweek = selectGameweek(gameweeks ?? [], Array.isArray(requested) ? requested[0] : requested)
  if (!gameweek) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-serif text-3xl font-black">Noch keine Gameweek</h1></main>

  const squadIds = (squad ?? []).map((player) => player.id)
  const [{ data: lineup }, ratingsResult] = await Promise.all([
    supabase.from('lineups').select('id,lineup_players(player_id,is_starter)').eq('gameweek_id', gameweek.id).eq('manager_id', manager.id).maybeSingle(),
    squadIds.length
      ? supabase.from('player_match_ratings').select('player_id,rating').eq('gameweek_id', gameweek.id).in('player_id', squadIds)
      : Promise.resolve({ data: [] }),
  ])
  const ratings = ratingsResult.data
  const ratingByPlayer = new Map<string, number>()
  for (const rating of ratings ?? []) ratingByPlayer.set(rating.player_id, (ratingByPlayer.get(rating.player_id) ?? 0) + Number(rating.rating ?? 0))

  return <LineupEditor key={gameweek.id} gameweekId={gameweek.id} managerId={manager.id} number={gameweek.number} status={gameweek.status} gameweeks={gameweeks ?? []} squad={(squad ?? []).map((player) => ({ ...player, rating: ratingByPlayer.get(player.id) ?? null }))} initialPlayerIds={(lineup?.lineup_players ?? []).filter((row) => row.is_starter).map((row) => row.player_id)} />
}
