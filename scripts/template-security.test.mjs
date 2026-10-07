import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { inspectFiles } from './check-public.mjs'

test('public-file scan rejects secret material without returning secret values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'draft-scan-'))
  try {
    const secret = ['sb', 'secret', 'a'.repeat(32)].join('_')
    await writeFile(join(dir, 'credentials.txt'), secret)
    await writeFile(join(dir, '.env.production'), 'PASSWORD=example')
    await writeFile(join(dir, 'picture.png'), Buffer.concat([Buffer.from([0]), Buffer.from('private-value-test')]))
    await symlink(join(dir, 'credentials.txt'), join(dir, 'link.txt'))
    const findings = await inspectFiles(dir, ['credentials.txt', '.env.production', 'picture.png', 'link.txt'], ['private-value-test'])
    assert.ok(findings.some(row => row.reason === 'API token'))
    assert.ok(findings.some(row => row.reason === 'private file'))
    assert.ok(findings.some(row => row.reason === 'known private value'))
    assert.ok(findings.some(row => row.reason === 'symlink'))
    assert.ok(!JSON.stringify(findings).includes(secret))
    await writeFile(join(dir, '.env.example'), 'NEXT_PUBLIC_APP_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\n')
    assert.deepEqual(await inspectFiles(dir, ['.env.example']), [])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('fresh schema, generated league and season setup work together in isolation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'draft-setup-'))
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;`)
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
    execFileSync(process.execPath, [fileURLToPath(new URL('setup-league.mjs', import.meta.url)), '--name', "Example's League", '--season', '2026/27'], { cwd: dir })
    const sql = await readFile(join(dir, '.local/bootstrap.sql'), 'utf8')
    const id = sql.match(/League ID: ([a-f0-9-]+)/)[1]
    const code = sql.match(/Invitation code: ([A-Za-z0-9_-]+)/)[1]
    assert.equal(code.length, 32)
    await db.exec(sql)
    const { rows: leagues } = await db.query('select name from public.leagues')
    assert.equal(leagues[0].name, "Example's League")
    await assert.rejects(async () => execFileSync(process.execPath, [fileURLToPath(new URL('setup-league.mjs', import.meta.url)), '--name', 'Example', '--season', '2026/27'], { cwd: dir, stdio: 'pipe' }))
    await writeFile(join(dir, 'bootstrap.json'), JSON.stringify({ teams: [{ id: 1, short_name: 'ARS' }, { id: 2, short_name: 'AVL' }], elements: [{ id: 1, web_name: "Example's Player", team: 1, element_type: 3 }], events: [{ id: 1 }] }))
    await writeFile(join(dir, 'fixtures.json'), JSON.stringify([{ id: 10, event: 1, team_h: 1, team_a: 2, kickoff_time: '2026-10-10T14:00:00Z', started: false, finished: false }, { id: 11, event: null, kickoff_time: null }]))
    execFileSync(process.execPath, [fileURLToPath(new URL('prepare-season.mjs', import.meta.url)), '--league', id, '--bootstrap', 'bootstrap.json', '--fixtures', 'fixtures.json'], { cwd: dir })
    await db.exec(await readFile(join(dir, '.local/season.sql'), 'utf8'))
    const { rows: weeks } = await db.query('select status, lineup_lock_at from public.gameweeks')
    assert.equal(weeks[0].status, 'pending')
    assert.equal(new Date(weeks[0].lineup_lock_at).toISOString(), '2026-10-10T12:00:00.000Z')
    const { rows: rls } = await db.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' and not relrowsecurity")
    assert.deepEqual(rls, [])
    await db.query("insert into auth.users values ('11111111-1111-4111-8111-111111111111', jsonb_build_object('display_name', 'Example Manager', 'invite_code', $1::text), '{}')", [code])
    const { rows: users } = await db.query('select raw_user_meta_data, raw_app_meta_data from auth.users')
    assert.equal(users[0].raw_user_meta_data.invite_code, undefined)
    assert.equal(users[0].raw_app_meta_data.role, 'commissioner')
    assert.equal(users[0].raw_app_meta_data.league_id, id)
    await db.exec('set role anon')
    await assert.rejects(db.query('select * from private.league_invites'), /permission denied/)
  } finally { await db.close(); await rm(dir, { recursive: true, force: true }) }
})
