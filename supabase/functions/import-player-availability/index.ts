import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import {
  availabilityNote,
  matchPickedPlayerAvailability,
  parseSportsgamblerReport,
} from '../_shared/injuries.ts'
import type { LocalPlayer } from '../_shared/sofascore.ts'

const sourceUrl = 'https://www.sportsgambler.com/injuries/football/england-premier-league/'
const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function envKey(jsonName: string, legacyName: string) {
  const json = Deno.env.get(jsonName)
  if (json) {
    try {
      const keys = JSON.parse(json) as Record<string, string>
      if (keys.default) return keys.default
    } catch {
      // Fall back to the legacy variable.
    }
  }
  return Deno.env.get(legacyName) ?? ''
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response(405, { error: 'Nur POST ist erlaubt.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization.startsWith('Bearer ')) {
    return response(401, { error: 'Anmeldung erforderlich.' })
  }

  try {
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } })
    const token = authorization.slice('Bearer '.length)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) throw new HttpError(401, 'Anmeldung erforderlich.')

    const { data: manager, error: managerError } = await userClient
      .from('managers')
      .select('id,league_id,is_commissioner')
      .eq('id', userData.user.id)
      .single()
    if (managerError || !manager?.is_commissioner) throw new HttpError(403, 'Nur der Commissioner kann Verfügbarkeiten laden.')

    const { data: picks, error: picksError } = await userClient
      .from('draft_picks')
      .select('player_id')
      .eq('league_id', manager.league_id)
    if (picksError) throw new HttpError(500, 'Die Draft-Picks konnten nicht geladen werden.')
    const pickedIds = [...new Set((picks ?? []).map((pick) => pick.player_id))]
    if (!pickedIds.length) throw new HttpError(422, 'Der Draft enthält noch keine Spieler.')

    const { data: players, error: playersError } = await userClient
      .from('players')
      .select('id,display_name,club_code')
      .in('id', pickedIds)
    if (playersError || !players?.length) throw new HttpError(500, 'Die gedrafteten Spieler konnten nicht geladen werden.')

    const sourceResponse = await fetch(sourceUrl, {
      headers: { Accept: 'text/html', 'User-Agent': 'DraftLeague/1.0 (private five-player league)' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!sourceResponse.ok) throw new HttpError(502, `Die Verletzungsseite konnte nicht geladen werden (${sourceResponse.status}).`)
    const report = parseSportsgamblerReport(await sourceResponse.text())
    if (!report.entries.length) throw new HttpError(502, 'Die Verletzungsseite enthielt keine lesbaren Spielerdaten.')

    const coveredClubs = new Set(report.clubs)
    const missingClubs = [...new Set(players.map((player) => player.club_code))].filter((club) => !coveredClubs.has(club))
    if (missingClubs.length) throw new HttpError(502, `Die Verletzungsseite ist unvollständig (${missingClubs.join(', ')} fehlen).`)

    const matches = matchPickedPlayerAvailability(players as LocalPlayer[], report.entries)
    const availability = [...matches].map(([playerId, entry]) => ({
      player_id: playerId,
      status: entry.status,
      note: availabilityNote(entry),
    }))
    const { data: applied, error: applyError } = await adminClient.rpc('apply_availability_import', {
      p_league_id: manager.league_id,
      p_availability: availability,
    })
    if (applyError) throw new HttpError(500, `Die Verfügbarkeiten konnten nicht gespeichert werden: ${applyError.message}`)

    const count = (status: string) => availability.filter((item) => item.status === status).length
    return response(200, {
      checked: players.length,
      updated: applied ?? availability.length,
      unavailable: availability.length,
      questionable: count('questionable'),
      out: count('out'),
      suspended: count('suspended'),
      source: 'Sportsgambler',
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Der Verletzungsimport ist fehlgeschlagen.'
    return response(status, { error: message })
  }
})
