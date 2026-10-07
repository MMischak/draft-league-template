import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const STARTERS = [0, 2, 3, 4, 5, 7, 8, 9, 10, 14, 15]
const ALTERNATE_STARTERS = [1, 3, 4, 5, 6, 8, 9, 10, 11, 16, 17]
let db
let leagueId
let managerIds
let gameweekIds
let squads
const migrationUrl = new URL('../../supabase/migrations/20261006161248_lineup_carry_forward.sql', import.meta.url)

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
  `)
  await db.exec(await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(migrationUrl, 'utf8'))
})

beforeEach(async () => {
  await db.exec('begin')
  leagueId = randomUUID()
  managerIds = Array.from({ length: 5 }, () => randomUUID())
  gameweekIds = Array.from({ length: 6 }, () => randomUUID())
  squads = managerIds.map(() => Array.from({ length: 20 }, () => randomUUID()))
  await db.query("insert into public.leagues (id, name, season_label) values ($1, 'Carry-forward test', '2026/27')", [leagueId])
  await db.query(`
    insert into private.league_invites (league_id, code_hash)
    values ($1, extensions.crypt($2, extensions.gen_salt('bf')))
  `, [leagueId, leagueId])

  for (const [index, managerId] of managerIds.entries()) {
    await db.query(`
      insert into auth.users (id, raw_user_meta_data)
      values ($1, jsonb_build_object('display_name', $2::text, 'invite_code', $3::text))
    `, [managerId, `Manager ${index + 1}`, leagueId])
    await db.query(`
      insert into public.players (id, league_id, display_name, club_code, position, owner_id)
      select player_id, $2, 'Player ' || ordinal, 'Club ' || ((ordinal - 1) / 4),
        case when ordinal <= 2 then 'GK' when ordinal <= 7 then 'DEF' when ordinal <= 14 then 'MID' else 'FWD' end, $3
      from unnest($1::uuid[]) with ordinality as player(player_id, ordinal)
    `, [squads[index], leagueId, managerId])
  }
  for (const [index, gameweekId] of gameweekIds.entries()) {
    await db.query(`
      insert into public.gameweeks (id, league_id, number, status)
      values ($1, $2, $3, $4)
    `, [gameweekId, leagueId, index + 1, index < 4 ? 'final' : index === 4 ? 'live' : 'pending'])
  }
})

afterEach(async () => { await db.exec('rollback') })
after(async () => { await db?.close() })

async function saveLineup(weekIndex, managerIndex = 0, starterIndexes = STARTERS) {
  const lineupId = randomUUID()
  await db.query(`
    insert into public.lineups (id, league_id, gameweek_id, manager_id)
    values ($1, $2, $3, $4)
  `, [lineupId, leagueId, gameweekIds[weekIndex], managerIds[managerIndex]])
  await db.query(`
    insert into public.lineup_players (lineup_id, player_id, is_starter)
    select $1, player_id, player_id = any($3::uuid[])
    from unnest($2::uuid[]) as player(player_id)
  `, [lineupId, squads[managerIndex], starterIndexes.map((index) => squads[managerIndex][index])])
  return lineupId
}

async function importRatings(weekIndex, ratings = [], provider = 'fotmob') {
  const runId = randomUUID()
  await db.query(`
    insert into public.rating_import_runs (id, league_id, gameweek_id, provider, status, started_by)
    values ($1, $2, $3, $4, 'running', $5)
  `, [runId, leagueId, gameweekIds[weekIndex], provider, managerIds[0]])
  // A failed statement must roll back the snapshot as well as the rating upserts.
  await db.exec('savepoint rating_import')
  try {
    await db.exec('set local role service_role')
    const result = await db.query(`
      select public.apply_rating_import($1, $2::jsonb, '[]', '[]', 'succeeded', 1, $3, 0, null) as updated
    `, [runId, JSON.stringify(ratings), ratings.length])
    await db.exec('reset role; release savepoint rating_import')
    return { runId, updated: result.rows[0].updated }
  } catch (error) {
    await db.exec('rollback to savepoint rating_import; release savepoint rating_import')
    throw error
  }
}

async function lineupAt(weekIndex, managerIndex = 0) {
  const { rows } = await db.query(`
    select lineup.id, lineup.saved_at,
      array_agg(player.player_id order by player.player_id) filter (where player.is_starter) as starters,
      count(player.player_id)::integer as squad_size
    from public.lineups lineup
    left join public.lineup_players player on player.lineup_id = lineup.id
    where lineup.gameweek_id = $1 and lineup.manager_id = $2
    group by lineup.id
  `, [gameweekIds[weekIndex], managerIds[managerIndex]])
  return rows[0] ?? null
}

async function scoreAt(weekIndex, managerIndex = 0) {
  const { rows } = await db.query(`
    select score from public.manager_gameweek_scores where gameweek_id = $1 and manager_id = $2
  `, [gameweekIds[weekIndex], managerIds[managerIndex]])
  return Number(rows[0]?.score)
}

test('snapshots missing lineups before scoring, including the bench and double-gameweek ratings', async () => {
  const sourceId = await saveLineup(0)
  const ratings = STARTERS.map((index) => ({ player_id: squads[0][index], provider_match_id: 1, rating: 7 }))
  ratings.push({ player_id: squads[0][0], provider_match_id: 2, rating: 8 })
  ratings.push({ player_id: squads[0][1], provider_match_id: 1, rating: 10 })
  const { updated } = await importRatings(4, ratings)

  const snapshot = await lineupAt(4)
  assert.notEqual(snapshot.id, sourceId)
  assert.deepEqual(snapshot.starters, STARTERS.map((index) => squads[0][index]).sort())
  assert.equal(snapshot.squad_size, 20)
  assert.equal(updated, 5)
  assert.equal(await scoreAt(4), 85)
})

test('preserves an explicitly submitted current lineup', async () => {
  await saveLineup(0)
  const submittedId = await saveLineup(4, 0, ALTERNATE_STARTERS)
  const beforeImport = await lineupAt(4)
  await importRatings(4)

  assert.equal((await lineupAt(4)).id, submittedId)
  assert.deepEqual(await lineupAt(4), beforeImport)
})

test('uses the latest earlier valid gameweek, regardless of saved_at, and skips invalid formations', async () => {
  const oldId = await saveLineup(0)
  await saveLineup(1, 0, ALTERNATE_STARTERS)
  await saveLineup(2, 0, STARTERS.slice(0, 10))
  await saveLineup(3, 0, [0, 1, 2, 3, 4, 5, 7, 8, 9, 14, 15])
  await db.query("update public.lineups set saved_at = now() + interval '1 day' where id = $1", [oldId])
  await importRatings(4)

  assert.deepEqual((await lineupAt(4)).starters, ALTERNATE_STARTERS.map((index) => squads[0][index]).sort())
})

test('does not use future planned lineups', async () => {
  await saveLineup(5)
  await importRatings(4)

  assert.equal(await lineupAt(4), null)
  assert.equal(await scoreAt(4), 0)
})

test('leaves managers with no previous valid lineup at zero without inventing a selection', async () => {
  await saveLineup(0, 0, STARTERS.slice(0, 10))
  await importRatings(4)

  for (let managerIndex = 0; managerIndex < 5; managerIndex += 1) {
    assert.equal(await lineupAt(4, managerIndex), null)
    assert.equal(await scoreAt(4, managerIndex), 0)
  }
})

test('skips starters who left the squad and snapshots new bench players', async () => {
  await saveLineup(0, 0, ALTERNATE_STARTERS)
  await saveLineup(1)
  await db.query('update public.players set owner_id = null where id = $1', [squads[0][0]])
  const newBenchId = randomUUID()
  await db.query(`
    insert into public.players (id, league_id, display_name, club_code, position, owner_id)
    values ($1, $2, 'New bench player', 'NEW', 'GK', $3)
  `, [newBenchId, leagueId, managerIds[0]])
  await importRatings(4)

  const snapshot = await lineupAt(4)
  assert.deepEqual(snapshot.starters, ALTERNATE_STARTERS.map((index) => squads[0][index]).sort())
  assert.equal(snapshot.squad_size, 20)
  const { rows } = await db.query('select is_starter from public.lineup_players where lineup_id = $1 and player_id = $2', [snapshot.id, newBenchId])
  assert.deepEqual(rows, [{ is_starter: false }])
})

test('never selects history from another league', async () => {
  const sourceId = await saveLineup(0)
  const otherLeagueId = randomUUID()
  await db.query("insert into public.leagues (id, name, season_label) values ($1, 'Other league', '2026/27')", [otherLeagueId])
  await db.query('update public.lineups set league_id = $1 where id = $2', [otherLeagueId, sourceId])
  await importRatings(4)

  assert.equal(await lineupAt(4), null)
})

test('keeps snapshots immutable on reimport and carries them across consecutive missed gameweeks', async () => {
  const sourceId = await saveLineup(0)
  await importRatings(2, [{ player_id: squads[0][0], provider_match_id: 1, rating: 6 }])
  const firstSnapshot = await lineupAt(2)
  await db.query('update public.lineup_players set is_starter = player_id = any($2::uuid[]) where lineup_id = $1', [sourceId, ALTERNATE_STARTERS.map((index) => squads[0][index])])
  await importRatings(2, [{ player_id: squads[0][0], provider_match_id: 1, rating: 8 }])
  await importRatings(3)

  assert.deepEqual(await lineupAt(2), firstSnapshot)
  assert.equal(await scoreAt(2), 8)
  assert.deepEqual((await lineupAt(3)).starters, firstSnapshot.starters)
})

test('rolls back the lineup snapshot and ratings when score calculation fails', async () => {
  await saveLineup(0)
  await db.exec('alter table public.manager_gameweek_scores add constraint test_reject_score check (score < 1)')
  await assert.rejects(importRatings(4, [{ player_id: squads[0][0], provider_match_id: 1, rating: 7 }]), /test_reject_score/)

  assert.equal(await lineupAt(4), null)
  const { rows } = await db.query('select count(*)::integer as count from public.player_match_ratings where gameweek_id = $1', [gameweekIds[4]])
  assert.equal(rows[0].count, 0)
})

test('rejects carry-forward imports for an open gameweek', async () => {
  await saveLineup(0)
  await assert.rejects(importRatings(5), /not ready for scoring/)
  assert.equal(await lineupAt(5), null)
})

test('keeps rating import execution restricted to the service role', async () => {
  const { rows } = await db.query(`
    select role, has_function_privilege(role,
      'public.apply_rating_import(uuid,jsonb,jsonb,jsonb,text,integer,integer,integer,text)', 'execute') as allowed
    from unnest(array['anon', 'authenticated', 'service_role']) as roles(role)
  `)
  assert.deepEqual(rows, [
    { role: 'anon', allowed: false },
    { role: 'authenticated', allowed: false },
    { role: 'service_role', allowed: true },
  ])
})

test('keeps the incremental migration identical to the full schema import function', async () => {
  const schema = await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
  const migration = await readFile(migrationUrl, 'utf8')
  const start = schema.indexOf('create or replace function public.apply_rating_import(')
  const end = schema.indexOf('-- Compact, RLS-protected', start)
  assert.equal(migration.slice(migration.indexOf('create or replace function')).trim(), schema.slice(start, end).trim())
})
