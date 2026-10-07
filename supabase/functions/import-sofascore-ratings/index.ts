import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import {
  matchFixture,
  matchPlayer,
  parseFotMobFixtures,
  parseFotMobLineup,
  type ExternalEvent,
  type ExternalPlayer,
  type LocalFixture,
  type LocalPlayer,
} from '../_shared/sofascore.ts'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const sourceUrl = 'https://www.fotmob.com'
const leaguePath = '/leagues/47/overview/premier-league'
const provider = 'fotmob'

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
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
      // Fall back to the legacy environment variable below.
    }
  }
  return Deno.env.get(legacyName) ?? ''
}

async function fetchHtml(path: string) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await fetch(`${sourceUrl}${path}`, {
        headers: { Accept: 'text/html', 'User-Agent': 'DraftLeague/1.0 (private five-player league)' },
        signal: AbortSignal.timeout(8_000),
      })
      if (result.ok) return await result.text()
      if (result.status === 403) throw new HttpError(502, 'FotMob blockiert den öffentlichen HTML-Abruf (403).')
      if (result.status === 429 || result.status >= 500) {
        lastError = new Error(`FotMob returned ${result.status}`)
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt + Math.random() * 150))
          continue
        }
      }
      throw new HttpError(502, `FotMob konnte nicht geladen werden (${result.status}).`)
    } catch (error) {
      if (error instanceof HttpError) throw error
      lastError = error
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt + Math.random() * 150))
        continue
      }
    }
  }
  throw new HttpError(502, lastError instanceof Error ? `FotMob ist nicht erreichbar: ${lastError.message}` : 'FotMob ist nicht erreichbar.')
}

async function inBatches<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = []
  for (let index = 0; index < items.length; index += 2) {
    results.push(...await Promise.allSettled(items.slice(index, index + 2).map(worker)))
  }
  return results
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

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } })
  let runId: string | null = null

  try {
    const body = await request.json().catch(() => null) as { gameweekId?: unknown } | null
    if (!body || typeof body.gameweekId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.gameweekId)) {
      throw new HttpError(400, 'Bitte einen gültigen Spieltag auswählen.')
    }

    const token = authorization.slice('Bearer '.length)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) throw new HttpError(401, 'Anmeldung erforderlich.')

    const { data: manager, error: managerError } = await userClient
      .from('managers')
      .select('id,league_id,is_commissioner')
      .eq('id', userData.user.id)
      .single()
    if (managerError || !manager?.is_commissioner) throw new HttpError(403, 'Nur der Commissioner kann Wertungen laden.')

    const { data: gameweek, error: gameweekError } = await userClient
      .from('gameweeks')
      .select('id,league_id,number,status')
      .eq('id', body.gameweekId)
      .eq('league_id', manager.league_id)
      .single()
    if (gameweekError || !gameweek) throw new HttpError(404, 'Der Spieltag wurde nicht gefunden.')
    if (!['live', 'final'].includes(gameweek.status)) throw new HttpError(409, 'Wertungen können erst nach dem Schließen der Aufstellungen geladen werden.')

    const [{ data: fixtures }, { data: picks }] = await Promise.all([
      userClient.from('fixtures').select('id,home_club_code,away_club_code,kickoff_at').eq('gameweek_id', gameweek.id).order('kickoff_at'),
      userClient.from('draft_picks').select('player_id').eq('league_id', manager.league_id),
    ])
    if (!fixtures?.length) throw new HttpError(422, 'Für diesen Spieltag fehlen Fixture-Daten.')

    const pickedIds = [...new Set((picks ?? []).map((pick) => pick.player_id))]
    if (!pickedIds.length) throw new HttpError(422, 'Der Draft enthält noch keine Spieler.')
    const { data: players, error: playersError } = await userClient
      .from('players')
      .select('id,display_name,club_code')
      .in('id', pickedIds)
      .not('owner_id', 'is', null)
    if (playersError) throw new HttpError(500, 'Die gedrafteten Spieler konnten nicht geladen werden.')

    const [{ data: playerMappings }, { data: fixtureMappings }] = await Promise.all([
      userClient.from('player_provider_mappings').select('player_id,external_id').eq('league_id', manager.league_id).eq('provider', provider),
      userClient.from('fixture_provider_mappings').select('fixture_id,external_id').eq('league_id', manager.league_id).eq('provider', provider),
    ])

    await adminClient.from('rating_import_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_summary: 'Der Import wurde unterbrochen.',
    }).eq('gameweek_id', gameweek.id).eq('provider', provider).eq('status', 'running').lt('started_at', new Date(Date.now() - 5 * 60_000).toISOString())

    const { data: run, error: runError } = await adminClient.from('rating_import_runs').insert({
      league_id: manager.league_id,
      gameweek_id: gameweek.id,
      provider,
      status: 'running',
      started_by: manager.id,
    }).select('id').single()
    if (runError?.code === '23505') throw new HttpError(409, 'Für diesen Spieltag läuft bereits ein Import.')
    if (runError || !run) throw new HttpError(500, 'Der Import konnte nicht gestartet werden.')
    runId = run.id

    const events = parseFotMobFixtures(await fetchHtml(leaguePath), gameweek.number)
    if (!events.length) throw new HttpError(422, `FotMob hat für Gameweek ${gameweek.number} keine Spiele geliefert.`)

    const fixtureExternalById = new Map((fixtureMappings ?? []).map((mapping) => [mapping.fixture_id, Number(mapping.external_id)]))
    const matchedFixtures = (fixtures as LocalFixture[]).map((fixture) => {
      const savedId = fixtureExternalById.get(fixture.id)
      const event = (savedId ? events.find((candidate) => candidate.id === savedId) : null) ?? matchFixture(fixture, events)
      return event ? { fixture, event } : null
    }).filter((value): value is { fixture: LocalFixture; event: ExternalEvent } => value !== null)
    if (!matchedFixtures.length) throw new HttpError(422, 'Die Spiele konnten nicht eindeutig FotMob zugeordnet werden.')
    const finishedFixtures = matchedFixtures.filter(({ event }) => event.finished)
    if (!finishedFixtures.length) throw new HttpError(409, 'Für diesen Spieltag ist noch kein Spiel beendet.')

    const movedFixtures = matchedFixtures.filter(({ fixture, event }) => Date.parse(fixture.kickoff_at) !== Date.parse(event.kickoff))
    const [finishedStatusUpdate, kickoffUpdates] = await Promise.all([
      adminClient.from('fixtures').update({ started: true, finished: true })
        .eq('gameweek_id', gameweek.id)
        .in('id', finishedFixtures.map(({ fixture }) => fixture.id)),
      Promise.all(movedFixtures.map(({ fixture, event }) => adminClient.from('fixtures')
        .update({ kickoff_at: event.kickoff })
        .eq('id', fixture.id)
        .eq('gameweek_id', gameweek.id))),
    ])
    if (finishedStatusUpdate.error || kickoffUpdates.some(({ error }) => error)) {
      throw new HttpError(500, 'Die Spielstatus konnten nicht aktualisiert werden.')
    }

    const eligiblePlayers = players as LocalPlayer[]
    const eligibleById = new Map(eligiblePlayers.map((player) => [player.id, player]))
    const internalByExternal = new Map((playerMappings ?? [])
      .filter((mapping) => eligibleById.has(mapping.player_id))
      .map((mapping) => [Number(mapping.external_id), mapping.player_id]))
    const ratings: Array<{ player_id: string; provider_match_id: number; rating: number }> = []
    const newPlayerMappings = new Map<number, { player_id: string; external_id: number; external_name: string }>()

    const lineupResults = await inBatches(finishedFixtures, async ({ fixture, event }) => {
      const lineups = parseFotMobLineup(await fetchHtml(event.pageUrl))
      const sides: Array<{ clubCode: string; entries: ExternalPlayer[] }> = [
        { clubCode: fixture.home_club_code, entries: lineups.home },
        { clubCode: fixture.away_club_code, entries: lineups.away },
      ]
      if (!lineups.home.length && !lineups.away.length) throw new Error('Keine bewerteten Spieler gefunden.')
      for (const side of sides) {
        for (const entry of side.entries) {
          const externalId = entry.id
          let playerId = internalByExternal.get(externalId)
          if (!playerId) {
            const matched = matchPlayer(eligiblePlayers, entry, side.clubCode)
            if (matched) {
              playerId = matched.id
              internalByExternal.set(externalId, matched.id)
              newPlayerMappings.set(externalId, {
                player_id: matched.id,
                external_id: externalId,
                external_name: entry.name,
              })
            }
          }
          if (!playerId || !eligibleById.has(playerId)) continue
          if (entry.rating !== null) ratings.push({ player_id: playerId, provider_match_id: event.id, rating: entry.rating })
        }
      }
    })

    const failedFixtures = lineupResults.filter((result) => result.status === 'rejected').length
    const uniqueRatings = [...new Map(ratings.map((rating) => [`${rating.provider_match_id}:${rating.player_id}`, rating])).values()]
    if (!uniqueRatings.length && failedFixtures === finishedFixtures.length) {
      throw new HttpError(502, 'FotMob konnte für keines der fertigen Spiele Wertungen liefern.')
    }
    const newFixtureMappings = matchedFixtures
      .filter(({ fixture }) => !fixtureExternalById.has(fixture.id))
      .map(({ fixture, event }) => ({ fixture_id: fixture.id, external_id: event.id }))
    const incompleteFixtures = matchedFixtures.length - finishedFixtures.length
    const missingMappings = Math.max(eligiblePlayers.length - internalByExternal.size, 0)
    const status = failedFixtures > 0 || matchedFixtures.length < fixtures.length || incompleteFixtures > 0 ? 'partial' : 'succeeded'

    const { data: applied, error: applyError } = await adminClient.rpc('apply_rating_import', {
      p_run_id: runId,
      p_ratings: uniqueRatings,
      p_player_mappings: [...newPlayerMappings.values()],
      p_fixture_mappings: newFixtureMappings,
      p_status: status,
      p_fixture_count: matchedFixtures.length,
      p_imported_count: uniqueRatings.length,
      p_missing_mapping_count: missingMappings,
      p_error_summary: failedFixtures ? `${failedFixtures} Fixture-Abrufe fehlgeschlagen.` : null,
    })
    if (applyError) throw new HttpError(500, `Die Wertungen konnten nicht gespeichert werden: ${applyError.message}`)

    return response(200, {
      runId,
      status,
      fixtures: matchedFixtures.length,
      fixtureCount: fixtures.length,
      imported: uniqueRatings.length,
      missingMappings,
      incompleteFixtures,
      failedFixtures,
      scoresUpdated: applied,
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Der Import ist fehlgeschlagen.'
    if (runId) {
      await adminClient.from('rating_import_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_summary: message.slice(0, 500) }).eq('id', runId)
    }
    return response(status, { error: message, runId })
  }
})
