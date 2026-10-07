import { readFile, mkdir, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('node scripts/prepare-season.mjs --league UUID --bootstrap .local/bootstrap.json --fixtures .local/fixtures.json')
  process.exit(0)
}
const get = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined
const league = get('--league')
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(league ?? '')) throw new Error('A valid --league UUID is required.')
if (!get('--bootstrap') || !get('--fixtures')) throw new Error('--bootstrap and --fixtures JSON paths are required.')
const bootstrap = JSON.parse(await readFile(get('--bootstrap'), 'utf8'))
const fixtureInput = JSON.parse(await readFile(get('--fixtures'), 'utf8'))
if (!Array.isArray(bootstrap.teams) || !Array.isArray(bootstrap.elements) || !Array.isArray(bootstrap.events) || !Array.isArray(fixtureInput)) throw new Error('Unexpected FPL JSON format.')
const teams = new Map(bootstrap.teams.map(team => [team.id, team.short_name]))
const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const club = id => {
  const code = teams.get(id)
  if (!/^[A-Z]{3}$/.test(code ?? '')) throw new Error('Invalid club code.')
  return code
}
const players = bootstrap.elements.map(player => {
  if (!Number.isSafeInteger(player.id) || player.id < 1 || !positions[player.element_type] || typeof player.web_name !== 'string' || !player.web_name.trim()) throw new Error('Invalid player.')
  return { provider_id: player.id, display_name: player.web_name, club_code: club(player.team), position: positions[player.element_type] }
})
const gameweeks = bootstrap.events.map(event => {
  if (!Number.isInteger(event.id) || event.id < 1 || event.id > 38) throw new Error('Invalid gameweek.')
  return { number: event.id }
})
const gameweekNumbers = new Set(gameweeks.map(week => week.number))
const skipped = fixtureInput.filter(fixture => !fixture.event || !fixture.kickoff_time)
const fixtures = fixtureInput.filter(fixture => fixture.event && fixture.kickoff_time).map(fixture => {
  if (!Number.isSafeInteger(fixture.id) || fixture.id < 1 || !gameweekNumbers.has(fixture.event) || !Number.isFinite(Date.parse(fixture.kickoff_time))) throw new Error('Invalid fixture.')
  return { provider_id: fixture.id, number: fixture.event, home_club_code: club(fixture.team_h), away_club_code: club(fixture.team_a), kickoff_at: new Date(fixture.kickoff_time).toISOString(), started: Boolean(fixture.started), finished: Boolean(fixture.finished), home_score: fixture.team_h_score ?? null, away_score: fixture.team_a_score ?? null }
})
if (!players.length || !gameweeks.length || !fixtures.length) throw new Error('Season data is empty.')
const quote = value => `'${value.replaceAll("'", "''")}'`
const payload = quote(JSON.stringify({ players, gameweeks, fixtures }))
const sql = `-- Run in your own Supabase project AFTER .local/bootstrap.sql.
-- Imports a snapshot; does not fetch or sync ratings, injuries or future schedule changes.
begin;
set local standard_conforming_strings = on;
do $$
declare
  target_league uuid := '${league}';
  seed jsonb := ${payload}::jsonb;
begin
  if not exists (select 1 from public.leagues where id = target_league) then
    raise exception 'League does not exist. Run bootstrap.sql first.';
  end if;
  insert into public.players (league_id, provider_id, display_name, club_code, position)
  select target_league, p.provider_id, p.display_name, p.club_code, p.position
  from jsonb_to_recordset(seed->'players') p(provider_id bigint, display_name text, club_code text, position text)
  on conflict (league_id, provider_id) do update set display_name = excluded.display_name, club_code = excluded.club_code, position = excluded.position;
  insert into public.gameweeks (league_id, number)
  select target_league, g.number from jsonb_to_recordset(seed->'gameweeks') g(number smallint)
  on conflict (league_id, number) do nothing;
  insert into public.fixtures (league_id, gameweek_id, provider_id, home_club_code, away_club_code, kickoff_at, started, finished, home_score, away_score)
  select target_league, g.id, f.provider_id, f.home_club_code, f.away_club_code, f.kickoff_at, f.started, f.finished, f.home_score, f.away_score
  from jsonb_to_recordset(seed->'fixtures') f(provider_id bigint, number smallint, home_club_code text, away_club_code text, kickoff_at timestamptz, started boolean, finished boolean, home_score smallint, away_score smallint)
  join public.gameweeks g on g.league_id = target_league and g.number = f.number
  on conflict (league_id, provider_id) do update set gameweek_id = excluded.gameweek_id, kickoff_at = excluded.kickoff_at, started = excluded.started, finished = excluded.finished, home_score = excluded.home_score, away_score = excluded.away_score;
  update public.gameweeks g set first_kickoff_at = dates.first_at, lineup_lock_at = dates.first_at - interval '2 hours', finalize_at = dates.last_at + interval '24 hours'
  from (select gameweek_id, min(kickoff_at) first_at, max(kickoff_at) last_at from public.fixtures where league_id = target_league group by gameweek_id) dates
  where g.id = dates.gameweek_id;
end $$;
commit;
`
await mkdir('.local', { recursive: true, mode: 0o700 })
await writeFile('.local/season.sql', sql, { flag: 'wx', mode: 0o600 })
console.log(`Created .local/season.sql: ${players.length} players, ${gameweeks.length} gameweeks, ${fixtures.length} fixtures. Skipped ${skipped.length} fixtures without a gameweek or kickoff.`)
