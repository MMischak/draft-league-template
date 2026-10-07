import { DraftBoard } from '@/components/draft-board'
import { requireViewer } from '@/lib/league-data'

export default async function DraftPage() {
  const { supabase, claims, league } = await requireViewer()
  const [{ data: managers }, { data: players }, { data: picks }] = await Promise.all([
    supabase.from('managers').select('id,display_name,draft_position').order('draft_position'),
    supabase.from('players').select('id,display_name,club_code,position,owner_id').order('display_name'),
    supabase.from('draft_picks').select('player_id,overall_pick').order('overall_pick'),
  ])

  return <DraftBoard leagueId={league.id} managers={managers ?? []} players={players ?? []} picks={picks ?? []} canPick={claims.app_metadata?.role === 'commissioner'} />
}
