import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'private, max-age=900, stale-while-revalidate=1800' : 'private, no-store',
      Vary: 'Cookie',
    },
  })
}

export async function GET(request: NextRequest) {
  const gameweekId = request.nextUrl.searchParams.get('gameweekId') ?? ''
  if (!UUID_PATTERN.test(gameweekId)) return json({ error: 'Ungültiger Spieltag.' }, 400)

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) return json({ error: 'Nicht angemeldet.' }, 401)

  const [fixturesResult, injuriesResult] = await Promise.all([
    supabase
      .from('fixtures')
      .select('id,home_club_code,away_club_code,kickoff_at,home_score,away_score')
      .eq('gameweek_id', gameweekId)
      .order('kickoff_at'),
    supabase
      .from('players')
      .select('id,availability_status,injury_note')
      .eq('owner_id', claimsData.claims.sub)
      .eq('is_injured', true),
  ])

  if (fixturesResult.error || injuriesResult.error) return json({ error: 'Die Spielübersicht konnte nicht geladen werden.' }, 500)

  return json({
    fixtures: fixturesResult.data ?? [],
    injuries: (injuriesResult.data ?? []).map((player) => ({
      playerId: player.id,
      status: player.availability_status,
      note: player.injury_note,
    })),
  })
}
