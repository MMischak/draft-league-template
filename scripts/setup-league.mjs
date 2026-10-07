import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('node scripts/setup-league.mjs --name "Meine Liga" --season "2026/27"')
  process.exit(0)
}
const value = flag => args[args.indexOf(flag) + 1]
if (!args.includes('--name') || !args.includes('--season')) throw new Error('--name and --season are required. See --help.')
const name = value('--name')
const season = value('--season')
if (!name || name.length > 80 || !/^\d{4}\/\d{2}$/.test(season ?? '')) throw new Error('Use a league name (1–80 characters) and a season like 2026/27.')
const quote = value => `'${value.replaceAll("'", "''")}'`
const leagueId = randomUUID()
const code = randomBytes(24).toString('base64url')
const sql = `-- PRIVATE: do not commit this file or share it publicly.
-- League ID: ${leagueId}
-- Invitation code: ${code}
-- Run once in your OWN new Supabase project, after schema.sql.
begin;
set local standard_conforming_strings = on;
insert into public.leagues (id, name, season_label)
values (${quote(leagueId)}, ${quote(name)}, ${quote(season)});
insert into private.league_invites (league_id, code_hash)
values (${quote(leagueId)}, extensions.crypt(${quote(code)}, extensions.gen_salt('bf')));
commit;
`
await mkdir('.local', { recursive: true, mode: 0o700 })
await writeFile('.local/bootstrap.sql', sql, { flag: 'wx', mode: 0o600 })
console.log('Created .local/bootstrap.sql. Open it privately to obtain your league ID and invitation code, then run it in your Supabase SQL editor.')
