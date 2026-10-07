import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(request: NextRequest) {
  const managerId = request.nextUrl.searchParams.get('managerId') ?? ''
  const gameweekId = request.nextUrl.searchParams.get('gameweekId') ?? ''
  if (!UUID_PATTERN.test(managerId) || !UUID_PATTERN.test(gameweekId)) return json({ error: 'Ungültige Anfrage.' }, 400)

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) return json({ error: 'Nicht angemeldet.' }, 401)

  const [gameweekResult, lineupResult, scoreResult, ratingsResult, importRunResult] = await Promise.all([
    supabase.from('gameweeks').select('id,number,status').eq('id', gameweekId).maybeSingle(),
    supabase.from('lineups').select('id,lineup_players(player_id,is_starter,players(id,display_name,position,club_code))').eq('gameweek_id', gameweekId).eq('manager_id', managerId).maybeSingle(),
    supabase.from('manager_gameweek_scores').select('score').eq('gameweek_id', gameweekId).eq('manager_id', managerId).maybeSingle(),
    supabase.from('player_match_ratings').select('player_id,rating,provider').eq('gameweek_id', gameweekId),
    supabase.from('rating_import_runs').select('provider').eq('gameweek_id', gameweekId).eq('status', 'completed').order('finished_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const queryError = gameweekResult.error ?? lineupResult.error ?? scoreResult.error ?? ratingsResult.error ?? importRunResult.error
  if (queryError) return json({ error: 'Die Aufstellung konnte nicht geladen werden.' }, 500)
  if (!gameweekResult.data) return json({ error: 'Gameweek nicht gefunden.' }, 404)
  if (!['live', 'final'].includes(gameweekResult.data.status)) return json({ error: 'Diese Aufstellung ist noch nicht sichtbar.' }, 403)

  const activeProvider = importRunResult.data?.provider
  const ratingByPlayer = new Map<string, number>()
  for (const rating of ratingsResult.data ?? []) {
    if (activeProvider && rating.provider !== activeProvider) continue
    ratingByPlayer.set(rating.player_id, (ratingByPlayer.get(rating.player_id) ?? 0) + Number(rating.rating ?? 0))
  }
  const players = (lineupResult.data?.lineup_players ?? []).filter((row) => row.is_starter).flatMap((row) => row.players ? [{
    id: row.players.id,
    displayName: row.players.display_name,
    position: row.players.position,
    clubCode: row.players.club_code,
    rating: ratingByPlayer.get(row.player_id) ?? null,
  }] : [])

  return json({
    managerId,
    gameweekId,
    score: Number(scoreResult.data?.score ?? 0),
    players,
  })
}
