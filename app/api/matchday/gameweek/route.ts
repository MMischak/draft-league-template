import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
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

  const { data: gameweek, error: gameweekError } = await supabase
    .from('gameweeks')
    .select('id,number,status')
    .eq('id', gameweekId)
    .maybeSingle()

  if (gameweekError) return json({ error: 'Die Gameweek konnte nicht geladen werden.' }, 500)
  if (!gameweek) return json({ error: 'Die Gameweek wurde nicht gefunden.' }, 404)

  const [lineupResult, ratingsResult] = await Promise.all([
    supabase
      .from('lineups')
      .select('lineup_players(player_id,is_starter)')
      .eq('gameweek_id', gameweek.id)
      .eq('manager_id', claimsData.claims.sub)
      .maybeSingle(),
    supabase
      .from('player_match_ratings')
      .select('player_id,rating,player:players!inner(owner_id)')
      .eq('gameweek_id', gameweek.id)
      .eq('player.owner_id', claimsData.claims.sub),
  ])

  if (lineupResult.error || ratingsResult.error) return json({ error: 'Die Matchday-Daten konnten nicht geladen werden.' }, 500)

  const ratings: Record<string, number> = {}
  for (const rating of ratingsResult.data ?? []) {
    ratings[rating.player_id] = (ratings[rating.player_id] ?? 0) + Number(rating.rating ?? 0)
  }

  return json({
    gameweekId: gameweek.id,
    number: gameweek.number,
    status: gameweek.status,
    ratings,
    initialPlayerIds: (lineupResult.data?.lineup_players ?? [])
      .filter((row) => row.is_starter)
      .map((row) => row.player_id),
  })
}
