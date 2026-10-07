import { redirect } from 'next/navigation'
import { DraftOrderSettings } from '@/components/draft-order-settings'
import { GameweekControls } from '@/components/gameweek-controls'
import { InjuryImportControl } from '@/components/injury-import-control'
import { LeagueSettings } from '@/components/league-settings'
import { PlayerAvailabilityControl } from '@/components/player-availability-control'
import { RatingImportControl } from '@/components/rating-import-control'
import { getCurrentGameweek, requireViewer } from '@/lib/league-data'

export default async function CommissionerPage() {
  const { supabase, claims, league } = await requireViewer()
  if (claims.app_metadata?.role !== 'commissioner') redirect('/')
  const gameweek = await getCurrentGameweek(supabase)
  const [{ data: managers }, { count: pickCount }, { data: gameweeks }, { data: ratingRuns }] = await Promise.all([
    supabase.from('managers').select('*').order('draft_position'),
    supabase.from('draft_picks').select('id', { count: 'exact', head: true }),
    supabase.from('gameweeks').select('id,number,status').order('number', { ascending: false }),
    supabase.from('rating_import_runs').select('id,gameweek_id,status,finished_at,imported_count,missing_mapping_count,error_summary').order('started_at', { ascending: false }),
  ])
  return <main className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <h1 className="mb-6 font-serif text-3xl font-black sm:text-4xl">Liga verwalten</h1>
    <div className="space-y-4"><GameweekControls key={`${gameweek?.id}:${gameweek?.status}`} gameweek={gameweek} /><RatingImportControl gameweeks={gameweeks ?? []} runs={ratingRuns ?? []} initialGameweekId={gameweek?.id ?? null} /><InjuryImportControl /><PlayerAvailabilityControl /><LeagueSettings league={league} /><DraftOrderSettings key={(managers ?? []).map((manager) => `${manager.id}:${manager.draft_position}`).join('|')} managers={managers ?? []} pickCount={pickCount ?? 0} /></div>
  </main>
}
