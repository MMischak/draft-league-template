-- Draft League release foundation. Run once in the Supabase SQL editor.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_label text not null,
  transfer_opens_at timestamptz,
  transfer_closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.managers (
  id uuid primary key references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  display_name text not null,
  is_commissioner boolean not null default false,
  draft_position smallint not null check (draft_position between 1 and 5),
  transfer_usage smallint not null default 0 check (transfer_usage between 0 and 5),
  unique (league_id, display_name),
  unique (league_id, draft_position) deferrable initially immediate
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'managers_league_id_draft_position_key'
      and conrelid = 'public.managers'::regclass
      and not condeferrable
  ) then
    alter table public.managers drop constraint managers_league_id_draft_position_key;
    alter table public.managers add constraint managers_league_id_draft_position_key
      unique (league_id, draft_position) deferrable initially immediate;
  end if;
end $$;

create table if not exists private.league_invites (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  code_hash text not null
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  provider_id bigint,
  display_name text not null,
  club_code text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  owner_id uuid references public.managers(id),
  availability_status text not null default 'available' check (availability_status in ('available', 'questionable', 'out', 'suspended')),
  is_injured boolean not null default false,
  injury_note text check (injury_note is null or char_length(injury_note) <= 160),
  injury_updated_at timestamptz,
  unique (league_id, provider_id)
);

alter table public.players add column if not exists is_injured boolean not null default false;
alter table public.players add column if not exists injury_note text check (injury_note is null or char_length(injury_note) <= 160);
alter table public.players add column if not exists injury_updated_at timestamptz;
alter table public.players add column if not exists availability_status text not null default 'available';
alter table public.players drop constraint if exists players_availability_status_check;
alter table public.players add constraint players_availability_status_check
  check (availability_status in ('available', 'questionable', 'out', 'suspended'));
update public.players set availability_status = 'out'
where is_injured and availability_status = 'available';

create table if not exists public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  overall_pick smallint not null check (overall_pick between 1 and 100),
  manager_id uuid not null references public.managers(id),
  player_id uuid not null references public.players(id),
  picked_at timestamptz not null default now(),
  unique (league_id, overall_pick),
  unique (league_id, player_id)
);

create table if not exists public.gameweeks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  number smallint not null check (number between 1 and 38),
  first_kickoff_at timestamptz,
  lineup_lock_at timestamptz,
  finalize_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'lineup', 'live', 'final')),
  unique (league_id, number)
);

alter table public.gameweeks alter column status set default 'pending';
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'gameweeks_status_check'
      and conrelid = 'public.gameweeks'::regclass
      and pg_get_constraintdef(oid) not like '%pending%'
  ) then
    alter table public.gameweeks drop constraint gameweeks_status_check;
    alter table public.gameweeks add constraint gameweeks_status_check
      check (status in ('pending', 'lineup', 'live', 'final'));
  end if;
end $$;

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  provider_id bigint not null,
  home_club_code text not null,
  away_club_code text not null,
  kickoff_at timestamptz not null,
  started boolean not null default false,
  finished boolean not null default false,
  home_score smallint,
  away_score smallint,
  unique (league_id, provider_id)
);

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (gameweek_id, manager_id)
);

create table if not exists public.lineup_players (
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  player_id uuid not null references public.players(id),
  is_starter boolean not null,
  primary key (lineup_id, player_id)
);

create table if not exists public.player_match_ratings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  player_id uuid not null references public.players(id),
  provider_match_id bigint not null,
  rating numeric(3,1) check (rating between 0 and 10),
  observed_at timestamptz not null default now(),
  unique (provider_match_id, player_id)
);

create table if not exists public.manager_gameweek_scores (
  league_id uuid not null references public.leagues(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  score numeric(6,1) not null default 0,
  is_final boolean not null default false,
  primary key (gameweek_id, manager_id)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  proposer_id uuid not null references public.managers(id),
  recipient_id uuid not null references public.managers(id),
  offered_player_id uuid not null references public.players(id),
  requested_player_id uuid not null references public.players(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  author_id uuid not null references public.managers(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feature_suggestions add column if not exists completed_at timestamptz;

create table if not exists public.feature_votes (
  suggestion_id uuid not null references public.feature_suggestions(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, manager_id)
);

create table if not exists public.feature_comments (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.feature_suggestions(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 600),
  created_at timestamptz not null default now()
);

create index if not exists managers_league_id_idx on public.managers (league_id);
create index if not exists players_league_owner_idx on public.players (league_id, owner_id);
create index if not exists players_owner_id_idx on public.players (owner_id);
create index if not exists draft_picks_league_manager_idx on public.draft_picks (league_id, manager_id);
create index if not exists draft_picks_manager_id_idx on public.draft_picks (manager_id);
create index if not exists draft_picks_player_id_idx on public.draft_picks (player_id);
create index if not exists gameweeks_league_status_idx on public.gameweeks (league_id, status);
create index if not exists fixtures_gameweek_kickoff_idx on public.fixtures (gameweek_id, kickoff_at);
create index if not exists lineups_league_manager_idx on public.lineups (league_id, manager_id);
create index if not exists lineups_manager_id_idx on public.lineups (manager_id);
create index if not exists lineup_players_player_id_idx on public.lineup_players (player_id);
create index if not exists ratings_gameweek_player_idx on public.player_match_ratings (gameweek_id, player_id);
create index if not exists ratings_league_id_idx on public.player_match_ratings (league_id);
create index if not exists ratings_player_id_idx on public.player_match_ratings (player_id);
create index if not exists scores_league_manager_idx on public.manager_gameweek_scores (league_id, manager_id);
create index if not exists scores_manager_id_idx on public.manager_gameweek_scores (manager_id);
create index if not exists trades_league_recipient_idx on public.trades (league_id, recipient_id, status);
create index if not exists trades_proposer_id_idx on public.trades (proposer_id);
create index if not exists trades_recipient_id_idx on public.trades (recipient_id);
create index if not exists trades_offered_player_id_idx on public.trades (offered_player_id);
create index if not exists trades_requested_player_id_idx on public.trades (requested_player_id);
create index if not exists feature_suggestions_league_created_idx on public.feature_suggestions (league_id, created_at desc);
create index if not exists feature_suggestions_author_id_idx on public.feature_suggestions (author_id);
create index if not exists feature_votes_league_suggestion_idx on public.feature_votes (league_id, suggestion_id);
create index if not exists feature_votes_manager_id_idx on public.feature_votes (manager_id);
create index if not exists feature_comments_league_suggestion_created_idx on public.feature_comments (league_id, suggestion_id, created_at);
create index if not exists feature_comments_suggestion_id_idx on public.feature_comments (suggestion_id);
create index if not exists feature_comments_manager_id_idx on public.feature_comments (manager_id);

alter table public.leagues enable row level security;
alter table public.managers enable row level security;
alter table public.players enable row level security;
alter table public.draft_picks enable row level security;
alter table public.gameweeks enable row level security;
alter table public.fixtures enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;
alter table public.player_match_ratings enable row level security;
alter table public.manager_gameweek_scores enable row level security;
alter table public.trades enable row level security;
alter table public.feature_suggestions enable row level security;
alter table public.feature_votes enable row level security;
alter table public.feature_comments enable row level security;

create or replace function public.current_league_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select nullif((select auth.jwt())->'app_metadata'->>'league_id', '')::uuid $$;

revoke all on function public.current_league_id() from public, anon;
grant execute on function public.current_league_id() to authenticated, service_role;

create or replace function private.handle_new_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_league_id uuid;
  manager_count integer;
  manager_name text;
  commissioner boolean;
begin
  manager_name := nullif(trim(new.raw_user_meta_data->>'display_name'), '');

  if manager_name is null or length(manager_name) > 40 then
    raise exception 'A manager name between 1 and 40 characters is required.';
  end if;

  select invite.league_id
    into invited_league_id
  from private.league_invites invite
  where extensions.crypt(new.raw_user_meta_data->>'invite_code', invite.code_hash) = invite.code_hash
  limit 1;

  if invited_league_id is null then
    raise exception 'Invalid league code.';
  end if;

  perform 1 from public.leagues where id = invited_league_id for update;
  select count(*) into manager_count from public.managers where league_id = invited_league_id;

  if manager_count >= 5 then
    raise exception 'This league already has five managers.';
  end if;

  commissioner := manager_count = 0;

  insert into public.managers (id, league_id, display_name, is_commissioner, draft_position)
  values (new.id, invited_league_id, manager_name, commissioner, manager_count + 1);

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'invite_code',
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'league_id', invited_league_id,
    'role', case when commissioner then 'commissioner' else 'manager' end
  )
  where id = new.id;

  return new;
end;
$$;

revoke all on function private.handle_new_manager() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_manager();

create policy "league members read leagues" on public.leagues for select to authenticated using (id = (select public.current_league_id()));
create policy "league members read managers" on public.managers for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read players" on public.players for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read picks" on public.draft_picks for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read gameweeks" on public.gameweeks for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read fixtures" on public.fixtures for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read lineups" on public.lineups for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read lineup players" on public.lineup_players for select to authenticated using (exists (select 1 from public.lineups where lineups.id = lineup_players.lineup_id and lineups.league_id = (select public.current_league_id())));
create policy "league members read ratings" on public.player_match_ratings for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read scores" on public.manager_gameweek_scores for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read trades" on public.trades for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members read feature suggestions" on public.feature_suggestions for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members create feature suggestions" on public.feature_suggestions for insert to authenticated
  with check (league_id = (select public.current_league_id()) and author_id = (select auth.uid()));
create policy "commissioner updates feature suggestions" on public.feature_suggestions for update to authenticated
  using (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner')
  with check (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "league members read feature votes" on public.feature_votes for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members create own feature votes" on public.feature_votes for insert to authenticated
  with check (
    league_id = (select public.current_league_id())
    and manager_id = (select auth.uid())
    and exists (select 1 from public.feature_suggestions where feature_suggestions.id = suggestion_id and feature_suggestions.league_id = (select public.current_league_id()))
  );
create policy "league members remove own feature votes" on public.feature_votes for delete to authenticated
  using (league_id = (select public.current_league_id()) and manager_id = (select auth.uid()));
create policy "league members read feature comments" on public.feature_comments for select to authenticated using (league_id = (select public.current_league_id()));
create policy "league members create own feature comments" on public.feature_comments for insert to authenticated
  with check (
    league_id = (select public.current_league_id())
    and manager_id = (select auth.uid())
    and exists (select 1 from public.feature_suggestions where feature_suggestions.id = suggestion_id and feature_suggestions.league_id = (select public.current_league_id()))
  );

create policy "commissioner updates league" on public.leagues for update to authenticated
  using (id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner')
  with check (id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "commissioner updates managers" on public.managers for update to authenticated
  using (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner')
  with check (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "commissioner updates players" on public.players for update to authenticated
  using (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner')
  with check (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "commissioner creates players" on public.players for insert to authenticated
  with check (
    league_id = (select public.current_league_id())
    and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner'
    and provider_id is null
    and owner_id is null
  );
create policy "commissioner updates gameweeks" on public.gameweeks for update to authenticated
  using (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner')
  with check (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "commissioner creates picks" on public.draft_picks for insert to authenticated
  with check (league_id = (select public.current_league_id()) and (select auth.jwt())->'app_metadata'->>'role' = 'commissioner');
create policy "managers create own lineups" on public.lineups for insert to authenticated
  with check (
    league_id = (select public.current_league_id())
    and manager_id = (select auth.uid())
    and exists (select 1 from public.gameweeks where gameweeks.id = gameweek_id and gameweeks.status in ('pending', 'lineup'))
  );
create policy "managers update own lineups" on public.lineups for update to authenticated
  using (
    league_id = (select public.current_league_id())
    and manager_id = (select auth.uid())
    and exists (select 1 from public.gameweeks where gameweeks.id = gameweek_id and gameweeks.status in ('pending', 'lineup'))
  )
  with check (league_id = (select public.current_league_id()) and manager_id = (select auth.uid()));
create policy "managers add own lineup players" on public.lineup_players for insert to authenticated
  with check (exists (
    select 1 from public.lineups
    join public.gameweeks on gameweeks.id = lineups.gameweek_id
    where lineups.id = lineup_players.lineup_id
      and lineups.manager_id = (select auth.uid())
      and lineups.league_id = (select public.current_league_id())
      and gameweeks.status in ('pending', 'lineup')
  ));
create policy "managers remove own lineup players" on public.lineup_players for delete to authenticated
  using (exists (
    select 1 from public.lineups
    join public.gameweeks on gameweeks.id = lineups.gameweek_id
    where lineups.id = lineup_players.lineup_id
      and lineups.manager_id = (select auth.uid())
      and lineups.league_id = (select public.current_league_id())
      and gameweeks.status in ('pending', 'lineup')
  ));

create or replace function public.set_draft_order(p_manager_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  league uuid := public.current_league_id();
  manager_count integer;
  valid_manager_count integer;
  updated_count integer;
begin
  if (select auth.uid()) is null or (select auth.jwt())->'app_metadata'->>'role' <> 'commissioner' then
    raise exception 'Only the Commissioner can change the draft order.';
  end if;

  perform pg_advisory_xact_lock(hashtext(league::text));

  if exists (select 1 from public.draft_picks where league_id = league) then
    raise exception 'The draft order cannot change after the first pick.';
  end if;

  select count(*) into manager_count from public.managers where league_id = league;
  if cardinality(p_manager_ids) is distinct from manager_count then
    raise exception 'The draft order must contain every manager exactly once.';
  end if;

  select count(*) into valid_manager_count
  from (
    select distinct manager_id
    from unnest(p_manager_ids) as requested(manager_id)
  ) requested
  join public.managers on managers.id = requested.manager_id and managers.league_id = league;

  if valid_manager_count <> manager_count then
    raise exception 'The draft order contains an invalid or duplicate manager.';
  end if;

  set constraints public.managers_league_id_draft_position_key deferred;
  update public.managers
  set draft_position = requested.position::smallint
  from unnest(p_manager_ids) with ordinality as requested(manager_id, position)
  where managers.id = requested.manager_id and managers.league_id = league;

  get diagnostics updated_count = row_count;
  if updated_count <> manager_count then
    raise exception 'The complete draft order could not be saved.';
  end if;
end;
$$;

create or replace function public.make_draft_pick(p_player_id uuid)
returns public.draft_picks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  league uuid := public.current_league_id();
  pick_number integer;
  draft_round integer;
  draft_slot integer;
  manager_position integer;
  picking_manager uuid;
  picked_player public.players%rowtype;
  squad_size integer;
  club_size integer;
  goalkeeper_count integer;
  defender_count integer;
  midfielder_count integer;
  forward_count integer;
  remaining_slots integer;
  missing_minimums integer;
  created_pick public.draft_picks%rowtype;
begin
  if (select auth.uid()) is null or (select auth.jwt())->'app_metadata'->>'role' <> 'commissioner' then
    raise exception 'Only the Commissioner can make draft picks.';
  end if;

  perform pg_advisory_xact_lock(hashtext(league::text));
  select count(*) + 1 into pick_number from public.draft_picks where league_id = league;
  if pick_number > 100 then raise exception 'The draft is complete.'; end if;

  draft_round := ((pick_number - 1) / 5) + 1;
  draft_slot := (pick_number - 1) % 5;
  manager_position := case when draft_round % 2 = 1 then draft_slot + 1 else 5 - draft_slot end;
  select id into picking_manager from public.managers where league_id = league and draft_position = manager_position;
  if picking_manager is null then raise exception 'The five-manager draft order is incomplete.'; end if;

  select * into picked_player from public.players where id = p_player_id and league_id = league for update;
  if picked_player.id is null then raise exception 'Player not found.'; end if;
  if picked_player.owner_id is not null then raise exception 'Player is already owned.'; end if;

  select count(*) into squad_size from public.players where owner_id = picking_manager;
  if squad_size >= 20 then raise exception 'This squad already has 20 players.'; end if;
  select count(*) into club_size from public.players where owner_id = picking_manager and club_code = picked_player.club_code;
  if club_size >= 4 then raise exception 'A squad may contain at most four players from one club.'; end if;

  select
    count(*) filter (where position = 'GK'),
    count(*) filter (where position = 'DEF'),
    count(*) filter (where position = 'MID'),
    count(*) filter (where position = 'FWD')
  into goalkeeper_count, defender_count, midfielder_count, forward_count
  from public.players where owner_id = picking_manager;

  goalkeeper_count := goalkeeper_count + case when picked_player.position = 'GK' then 1 else 0 end;
  defender_count := defender_count + case when picked_player.position = 'DEF' then 1 else 0 end;
  midfielder_count := midfielder_count + case when picked_player.position = 'MID' then 1 else 0 end;
  forward_count := forward_count + case when picked_player.position = 'FWD' then 1 else 0 end;
  remaining_slots := 20 - (squad_size + 1);
  missing_minimums := greatest(2 - goalkeeper_count, 0) + greatest(5 - defender_count, 0)
    + greatest(5 - midfielder_count, 0) + greatest(3 - forward_count, 0);
  if missing_minimums > remaining_slots then raise exception 'This pick would make the squad minimums impossible.'; end if;

  insert into public.draft_picks (league_id, overall_pick, manager_id, player_id)
  values (league, pick_number, picking_manager, p_player_id)
  returning * into created_pick;
  update public.players set owner_id = picking_manager where id = p_player_id;
  return created_pick;
end;
$$;

create or replace function public.save_lineup(p_gameweek_id uuid, p_player_ids uuid[])
returns public.lineups
language plpgsql
security invoker
set search_path = ''
as $$
declare
  league uuid := public.current_league_id();
  manager uuid := (select auth.uid());
  saved_lineup public.lineups%rowtype;
  goalkeeper_count integer;
  defender_count integer;
  midfielder_count integer;
  forward_count integer;
begin
  if manager is null then raise exception 'Authentication required.'; end if;
  if coalesce(array_length(p_player_ids, 1), 0) <> 11
    or (select count(distinct player_id) from unnest(p_player_ids) player_id) <> 11 then
    raise exception 'A lineup must contain exactly 11 different players.';
  end if;
  if not exists (
    select 1 from public.gameweeks
    where id = p_gameweek_id and league_id = league and status in ('pending', 'lineup')
  ) then raise exception 'This lineup is locked.'; end if;
  if (select count(*) from public.players where id = any(p_player_ids) and owner_id = manager and league_id = league) <> 11 then
    raise exception 'Every lineup player must belong to your squad.';
  end if;

  select
    count(*) filter (where position = 'GK'),
    count(*) filter (where position = 'DEF'),
    count(*) filter (where position = 'MID'),
    count(*) filter (where position = 'FWD')
  into goalkeeper_count, defender_count, midfielder_count, forward_count
  from public.players where id = any(p_player_ids);
  if goalkeeper_count <> 1 or defender_count not between 3 and 5
    or midfielder_count not between 2 and 5 or forward_count not between 1 and 3 then
    raise exception 'The lineup formation is invalid.';
  end if;

  insert into public.lineups (league_id, gameweek_id, manager_id, saved_at)
  values (league, p_gameweek_id, manager, now())
  on conflict (gameweek_id, manager_id) do update set saved_at = excluded.saved_at
  returning * into saved_lineup;
  delete from public.lineup_players where lineup_id = saved_lineup.id;
  insert into public.lineup_players (lineup_id, player_id, is_starter)
  select saved_lineup.id, player.id, player.id = any(p_player_ids)
  from public.players player
  where player.league_id = league and player.owner_id = manager;
  return saved_lineup;
end;
$$;

revoke all on function public.make_draft_pick(uuid) from public, anon;
revoke all on function public.save_lineup(uuid, uuid[]) from public, anon;
revoke all on function public.set_draft_order(uuid[]) from public, anon;
grant execute on function public.make_draft_pick(uuid) to authenticated, service_role;
grant execute on function public.save_lineup(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.set_draft_order(uuid[]) to authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant select on public.leagues, public.managers, public.players, public.draft_picks, public.gameweeks, public.fixtures, public.lineups, public.lineup_players, public.player_match_ratings, public.manager_gameweek_scores, public.trades to authenticated;
grant update (name, season_label, transfer_opens_at, transfer_closes_at) on public.leagues to authenticated;
grant update (display_name, draft_position) on public.managers to authenticated;
grant update (owner_id, availability_status, is_injured, injury_note, injury_updated_at) on public.players to authenticated;
grant insert (league_id, display_name, club_code, position) on public.players to authenticated;
grant update (status) on public.gameweeks to authenticated;
grant insert on public.draft_picks to authenticated;
grant insert, update on public.lineups to authenticated;
grant insert, delete on public.lineup_players to authenticated;
grant select, insert, update (completed_at) on public.feature_suggestions to authenticated;
grant select, insert, delete on public.feature_votes to authenticated;
grant select, insert on public.feature_comments to authenticated;
grant all on public.leagues, public.managers, public.players, public.draft_picks, public.gameweeks, public.fixtures, public.lineups, public.lineup_players, public.player_match_ratings, public.manager_gameweek_scores, public.trades, public.feature_suggestions, public.feature_votes, public.feature_comments to service_role;

-- Commissioner-triggered SofaScore rating imports.
create table if not exists public.player_provider_mappings (
  player_id uuid not null references public.players(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  provider text not null check (provider in ('sofascore', 'fotmob')),
  external_id bigint not null,
  external_name text,
  matched_at timestamptz not null default now(),
  primary key (player_id, provider),
  unique (league_id, provider, external_id)
);

create table if not exists public.fixture_provider_mappings (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  provider text not null check (provider in ('sofascore', 'fotmob')),
  external_id bigint not null,
  matched_at timestamptz not null default now(),
  primary key (fixture_id, provider),
  unique (league_id, provider, external_id)
);

create table if not exists public.rating_import_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  provider text not null check (provider in ('sofascore', 'fotmob')),
  status text not null check (status in ('running', 'partial', 'succeeded', 'failed')),
  started_by uuid not null references public.managers(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fixture_count smallint not null default 0,
  imported_count smallint not null default 0,
  missing_mapping_count smallint not null default 0,
  error_summary text
);

create unique index if not exists rating_import_runs_one_running_idx
  on public.rating_import_runs (gameweek_id, provider) where status = 'running';
create index if not exists player_provider_mappings_league_idx on public.player_provider_mappings (league_id, provider);
create index if not exists fixture_provider_mappings_league_idx on public.fixture_provider_mappings (league_id, provider);
create index if not exists rating_import_runs_gameweek_idx on public.rating_import_runs (gameweek_id, started_at desc);
create index if not exists rating_import_runs_league_id_idx on public.rating_import_runs (league_id);
create index if not exists rating_import_runs_started_by_idx on public.rating_import_runs (started_by);

alter table public.player_match_ratings add column if not exists provider text not null default 'manual';
alter table public.player_match_ratings drop constraint if exists player_match_ratings_provider_match_id_player_id_key;
alter table public.player_match_ratings drop constraint if exists player_match_ratings_provider_provider_match_id_player_id_key;
alter table public.player_match_ratings add constraint player_match_ratings_provider_provider_match_id_player_id_key
  unique (provider, provider_match_id, player_id);

alter table public.player_provider_mappings enable row level security;
alter table public.fixture_provider_mappings enable row level security;
alter table public.rating_import_runs enable row level security;

drop policy if exists "league members read player provider mappings" on public.player_provider_mappings;
create policy "league members read player provider mappings" on public.player_provider_mappings for select to authenticated
  using (league_id = (select public.current_league_id()));
drop policy if exists "league members read fixture provider mappings" on public.fixture_provider_mappings;
create policy "league members read fixture provider mappings" on public.fixture_provider_mappings for select to authenticated
  using (league_id = (select public.current_league_id()));
drop policy if exists "league members read rating import runs" on public.rating_import_runs;
create policy "league members read rating import runs" on public.rating_import_runs for select to authenticated
  using (league_id = (select public.current_league_id()));

create or replace function public.apply_rating_import(
  p_run_id uuid,
  p_ratings jsonb,
  p_player_mappings jsonb,
  p_fixture_mappings jsonb,
  p_status text,
  p_fixture_count integer,
  p_imported_count integer,
  p_missing_mapping_count integer,
  p_error_summary text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  import_run public.rating_import_runs%rowtype;
  updated_score_count integer;
  target_gameweek_number smallint;
  carried_lineup record;
  carried_lineup_id uuid;
begin
  if p_status not in ('partial', 'succeeded') then
    raise exception 'Invalid import status.';
  end if;

  select * into import_run
  from public.rating_import_runs
  where id = p_run_id and provider in ('sofascore', 'fotmob') and status = 'running'
  for update;
  if import_run.id is null then raise exception 'The import run is not active.'; end if;

  -- Serialize league imports and keep the scoring gameweek locked throughout the snapshot.
  perform pg_advisory_xact_lock(hashtext(import_run.league_id::text));
  select number into target_gameweek_number
  from public.gameweeks
  where id = import_run.gameweek_id and league_id = import_run.league_id
    and status in ('live', 'final')
  for share;
  if target_gameweek_number is null then raise exception 'This gameweek is not ready for scoring.'; end if;

  -- Keep ownership stable while selecting starters and snapshotting each squad.
  perform 1 from public.players
  where league_id = import_run.league_id and owner_id is not null
  order by id
  for share;

  insert into public.player_provider_mappings (player_id, league_id, provider, external_id, external_name, matched_at)
  select player.id, import_run.league_id, import_run.provider, mapping.external_id, mapping.external_name, now()
  from jsonb_to_recordset(coalesce(p_player_mappings, '[]'::jsonb))
    as mapping(player_id uuid, external_id bigint, external_name text)
  join public.players player on player.id = mapping.player_id and player.league_id = import_run.league_id
  on conflict (player_id, provider) do update
    set external_id = excluded.external_id, external_name = excluded.external_name, matched_at = excluded.matched_at;

  insert into public.fixture_provider_mappings (fixture_id, league_id, provider, external_id, matched_at)
  select fixture.id, import_run.league_id, import_run.provider, mapping.external_id, now()
  from jsonb_to_recordset(coalesce(p_fixture_mappings, '[]'::jsonb))
    as mapping(fixture_id uuid, external_id bigint)
  join public.fixtures fixture on fixture.id = mapping.fixture_id
    and fixture.league_id = import_run.league_id and fixture.gameweek_id = import_run.gameweek_id
  on conflict (fixture_id, provider) do update
    set external_id = excluded.external_id, matched_at = excluded.matched_at;

  insert into public.player_match_ratings (
    league_id, gameweek_id, player_id, provider, provider_match_id, rating, observed_at
  )
  select import_run.league_id, import_run.gameweek_id, player.id, import_run.provider, rating.provider_match_id, rating.rating, now()
  from jsonb_to_recordset(coalesce(p_ratings, '[]'::jsonb))
    as rating(player_id uuid, provider_match_id bigint, rating numeric)
  join public.players player on player.id = rating.player_id and player.league_id = import_run.league_id
  where rating.rating between 0 and 10
  on conflict (provider, provider_match_id, player_id) do update
    set rating = excluded.rating, observed_at = excluded.observed_at,
      league_id = excluded.league_id, gameweek_id = excluded.gameweek_id;

  -- Freeze the last valid earlier selection before scoring a missing lineup.
  -- Read starters only from history; snapshot the current squad for bench statistics.
  for carried_lineup in
    select manager.id as manager_id, previous.starter_ids
    from public.managers manager
    cross join lateral (
      select array_agg(lineup_player.player_id order by lineup_player.player_id) as starter_ids
      from public.lineups previous_lineup
      join public.gameweeks previous_gameweek on previous_gameweek.id = previous_lineup.gameweek_id
      join public.lineup_players lineup_player on lineup_player.lineup_id = previous_lineup.id
        and lineup_player.is_starter
      join public.players player on player.id = lineup_player.player_id
      where previous_lineup.league_id = import_run.league_id
        and previous_lineup.manager_id = manager.id
        and previous_gameweek.league_id = import_run.league_id
        and previous_gameweek.number < target_gameweek_number
      group by previous_lineup.id, previous_gameweek.number
      having count(*) = 11
        and count(*) filter (where player.league_id = import_run.league_id and player.owner_id = manager.id) = 11
        and count(*) filter (where player.position = 'GK') = 1
        and count(*) filter (where player.position = 'DEF') between 3 and 5
        and count(*) filter (where player.position = 'MID') between 2 and 5
        and count(*) filter (where player.position = 'FWD') between 1 and 3
      order by previous_gameweek.number desc
      limit 1
    ) previous
    where manager.league_id = import_run.league_id
      and not exists (
        select 1 from public.lineups current_lineup
        where current_lineup.gameweek_id = import_run.gameweek_id and current_lineup.manager_id = manager.id
      )
    order by manager.draft_position
  loop
    insert into public.lineups (league_id, gameweek_id, manager_id)
    values (import_run.league_id, import_run.gameweek_id, carried_lineup.manager_id)
    on conflict (gameweek_id, manager_id) do nothing
    returning id into carried_lineup_id;

    if carried_lineup_id is not null then
      insert into public.lineup_players (lineup_id, player_id, is_starter)
      select carried_lineup_id, player.id, player.id = any(carried_lineup.starter_ids)
      from public.players player
      where player.league_id = import_run.league_id and player.owner_id = carried_lineup.manager_id;
    end if;
  end loop;

  insert into public.manager_gameweek_scores (league_id, gameweek_id, manager_id, score, is_final)
  select import_run.league_id, import_run.gameweek_id, manager.id,
    coalesce(sum(rating.rating) filter (where lineup_player.is_starter), 0),
    false
  from public.managers manager
  left join public.lineups lineup on lineup.manager_id = manager.id and lineup.gameweek_id = import_run.gameweek_id
  left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  left join public.player_match_ratings rating on rating.player_id = lineup_player.player_id
    and rating.gameweek_id = import_run.gameweek_id and rating.provider = import_run.provider
  where manager.league_id = import_run.league_id
  group by manager.id
  on conflict (gameweek_id, manager_id) do update
    set score = excluded.score, is_final = false, league_id = excluded.league_id;
  get diagnostics updated_score_count = row_count;

  update public.rating_import_runs
  set status = p_status,
    finished_at = now(),
    fixture_count = greatest(least(coalesce(p_fixture_count, 0), 32767), 0)::smallint,
    imported_count = greatest(least(coalesce(p_imported_count, 0), 32767), 0)::smallint,
    missing_mapping_count = greatest(least(coalesce(p_missing_mapping_count, 0), 32767), 0)::smallint,
    error_summary = nullif(p_error_summary, '')
  where id = import_run.id;

  return updated_score_count;
end;
$$;

revoke all on function public.apply_rating_import(uuid, jsonb, jsonb, jsonb, text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.apply_rating_import(uuid, jsonb, jsonb, jsonb, text, integer, integer, integer, text) to service_role;

-- Compact, RLS-protected season statistics for the private league dashboard.
create or replace function public.get_season_statistics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with league_context as (
  select public.current_league_id() as league_id
),
visible_gameweeks as (
  select gameweek.id, gameweek.number
  from public.gameweeks gameweek
  cross join league_context league
  where gameweek.league_id = league.league_id
    and gameweek.status in ('live', 'final')
),
latest_imports as (
  select distinct on (import_run.gameweek_id)
    import_run.gameweek_id,
    import_run.provider
  from public.rating_import_runs import_run
  join visible_gameweeks gameweek on gameweek.id = import_run.gameweek_id
  cross join league_context league
  where import_run.league_id = league.league_id
    and import_run.status in ('partial', 'succeeded')
  order by import_run.gameweek_id,
    coalesce(import_run.finished_at, import_run.started_at) desc,
    import_run.started_at desc
),
active_ratings as (
  select rating.gameweek_id, rating.player_id,
    sum(coalesce(rating.rating, 0))::numeric as points
  from public.player_match_ratings rating
  join visible_gameweeks gameweek on gameweek.id = rating.gameweek_id
  left join latest_imports import on import.gameweek_id = rating.gameweek_id
  cross join league_context league
  where rating.league_id = league.league_id
    and (import.provider is null or rating.provider = import.provider)
  group by rating.gameweek_id, rating.player_id
),
rated_gameweeks as (
  select distinct rating.gameweek_id from active_ratings rating
),
saved_lineups as (
  select lineup.id, lineup.gameweek_id, lineup.manager_id
  from public.lineups lineup
  join visible_gameweeks gameweek on gameweek.id = lineup.gameweek_id
  cross join league_context league
  where lineup.league_id = league.league_id
),
eligible_scores as (
  select lineup.id as lineup_id, score.gameweek_id, score.manager_id, score.score::numeric,
    gameweek.number as gameweek_number
  from public.manager_gameweek_scores score
  join visible_gameweeks gameweek on gameweek.id = score.gameweek_id
  join rated_gameweeks rated on rated.gameweek_id = score.gameweek_id
  join saved_lineups lineup on lineup.gameweek_id = score.gameweek_id
    and lineup.manager_id = score.manager_id
  cross join league_context league
  where score.league_id = league.league_id
),
formation_requirements as (
  select * from (values
    ('3-4-3', 1, 3, 4, 3),
    ('3-5-2', 1, 3, 5, 2),
    ('4-3-3', 1, 4, 3, 3),
    ('4-4-2', 1, 4, 4, 2),
    ('4-5-1', 1, 4, 5, 1),
    ('5-2-3', 1, 5, 2, 3),
    ('5-3-2', 1, 5, 3, 2),
    ('5-4-1', 1, 5, 4, 1)
  ) as formation(id, goalkeepers, defenders, midfielders, forwards)
),
ranked_squad_scores as (
  select score.gameweek_id, score.manager_id, player.position,
    coalesce(rating.points, 0)::numeric as points,
    row_number() over (
      partition by score.gameweek_id, score.manager_id, player.position
      order by coalesce(rating.points, 0) desc, player.id
    )::integer as position_rank
  from eligible_scores score
  join public.lineup_players lineup_player on lineup_player.lineup_id = score.lineup_id
  join public.players player on player.id = lineup_player.player_id
  cross join league_context league
  left join active_ratings rating on rating.gameweek_id = score.gameweek_id
    and rating.player_id = player.id
  where player.league_id = league.league_id
),
formation_scores as (
  select squad.gameweek_id, squad.manager_id, formation.id,
    coalesce(sum(squad.points) filter (where
      (squad.position = 'GK' and squad.position_rank <= formation.goalkeepers)
      or (squad.position = 'DEF' and squad.position_rank <= formation.defenders)
      or (squad.position = 'MID' and squad.position_rank <= formation.midfielders)
      or (squad.position = 'FWD' and squad.position_rank <= formation.forwards)
    ), 0)::numeric as possible_score
  from ranked_squad_scores squad
  cross join formation_requirements formation
  group by squad.gameweek_id, squad.manager_id, formation.id,
    formation.goalkeepers, formation.defenders, formation.midfielders, formation.forwards
  having count(*) filter (where squad.position = 'GK') >= formation.goalkeepers
    and count(*) filter (where squad.position = 'DEF') >= formation.defenders
    and count(*) filter (where squad.position = 'MID') >= formation.midfielders
    and count(*) filter (where squad.position = 'FWD') >= formation.forwards
),
optimal_lineup_scores as (
  select score.gameweek_id, score.manager_id,
    max(score.possible_score)::numeric as optimal_score
  from formation_scores score
  group by score.gameweek_id, score.manager_id
),
bench_totals as (
  select lineup.manager_id,
    coalesce(sum(rating.points) filter (where not lineup_player.is_starter), 0)::numeric as bench_points
  from saved_lineups lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  left join active_ratings rating on rating.gameweek_id = lineup.gameweek_id
    and rating.player_id = lineup_player.player_id
  group by lineup.manager_id
),
score_ranks as (
  select score.manager_id, score.gameweek_id,
    (rank() over (partition by score.gameweek_id order by score.score desc))::integer as gameweek_rank
  from eligible_scores score
),
winner_counts as (
  select score.manager_id, count(*)::integer as wins
  from score_ranks score
  where score.gameweek_rank = 1
  group by score.manager_id
),
manager_performance as (
  select manager.id as manager_id, manager.display_name as manager_name,
    count(score.manager_id)::integer as played,
    coalesce(sum(score.score), 0)::numeric as total,
    coalesce(avg(score.score), 0)::numeric as average,
    coalesce(stddev_pop(score.score), 0)::numeric as deviation,
    coalesce(bench.bench_points, 0)::numeric as bench_points,
    case
      when count(score.manager_id) > 0 and coalesce(sum(optimal.optimal_score), 0) = 0
        and coalesce(sum(score.score), 0) = 0 then 100::numeric
      when coalesce(sum(optimal.optimal_score), 0) > 0
        then least(100::numeric, coalesce(sum(score.score), 0) * 100 / sum(optimal.optimal_score))
      else 0::numeric
    end as efficiency,
    coalesce(winner.wins, 0)::integer as wins
  from public.managers manager
  cross join league_context league
  left join eligible_scores score on score.manager_id = manager.id
  left join optimal_lineup_scores optimal on optimal.manager_id = score.manager_id
    and optimal.gameweek_id = score.gameweek_id
  left join bench_totals bench on bench.manager_id = manager.id
  left join winner_counts winner on winner.manager_id = manager.id
  where manager.league_id = league.league_id
  group by manager.id, manager.display_name, bench.bench_points, winner.wins
),
player_totals as (
  select player.id as player_id, player.display_name as player_name,
    player.club_code, player.position, player.owner_id as manager_id,
    manager.display_name as manager_name,
    sum(rating.points)::numeric as points,
    count(distinct rating.gameweek_id)::integer as gameweeks
  from active_ratings rating
  join public.players player on player.id = rating.player_id and player.owner_id is not null
  join public.managers manager on manager.id = player.owner_id
  cross join league_context league
  where player.league_id = league.league_id
  group by player.id, player.display_name, player.club_code, player.position,
    player.owner_id, manager.display_name
)
select jsonb_build_object(
  'managerCount', (select count(*) from manager_performance),
  'playedGameweeks', (select count(*) from rated_gameweeks),
  'scoredLineups', (select count(*) from eligible_scores),
  'topLineups', coalesce((
    select jsonb_agg(lineup.entry order by lineup.sort_score desc, lineup.gameweek_number)
    from (
      select jsonb_build_object(
        'managerId', score.manager_id,
        'managerName', manager.display_name,
        'gameweekNumber', score.gameweek_number,
        'score', round(score.score, 1)
      ) as entry, score.score as sort_score, score.gameweek_number
      from eligible_scores score
      join public.managers manager on manager.id = score.manager_id
      order by score.score desc, score.gameweek_number, manager.display_name
      limit 3
    ) lineup
  ), '[]'::jsonb),
  'bottomLineups', coalesce((
    select jsonb_agg(lineup.entry order by lineup.sort_score, lineup.gameweek_number)
    from (
      select jsonb_build_object(
        'managerId', score.manager_id,
        'managerName', manager.display_name,
        'gameweekNumber', score.gameweek_number,
        'score', round(score.score, 1)
      ) as entry, score.score as sort_score, score.gameweek_number
      from eligible_scores score
      join public.managers manager on manager.id = score.manager_id
      order by score.score, score.gameweek_number, manager.display_name
      limit 3
    ) lineup
  ), '[]'::jsonb),
  'managers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'managerId', manager.manager_id,
      'managerName', manager.manager_name,
      'played', manager.played,
      'total', round(manager.total, 1),
      'average', round(manager.average, 1),
      'benchPoints', round(manager.bench_points, 1),
      'efficiency', round(manager.efficiency, 1),
      'deviation', round(manager.deviation, 1),
      'wins', manager.wins
    ) order by manager.average desc, manager.total desc, manager.manager_name)
    from manager_performance manager
  ), '[]'::jsonb),
  'players', coalesce((
    select jsonb_agg(player.entry order by player.sort_points desc, player.player_name)
    from (
      select jsonb_build_object(
        'playerId', player.player_id,
        'playerName', player.player_name,
        'clubCode', player.club_code,
        'position', player.position,
        'managerId', player.manager_id,
        'managerName', player.manager_name,
        'points', round(player.points, 1),
        'gameweeks', player.gameweeks
      ) as entry, player.points as sort_points, player.player_name
      from player_totals player
      order by player.points desc, player.player_name
      limit 5
    ) player
  ), '[]'::jsonb),
  'records', jsonb_build_object(
    'mostWins', (
      select jsonb_build_object('managerId', manager.manager_id, 'managerName', manager.manager_name, 'value', manager.wins)
      from manager_performance manager
      where manager.played > 0
      order by manager.wins desc, manager.average desc, manager.manager_name
      limit 1
    ),
    'mostConsistent', (
      select jsonb_build_object('managerId', manager.manager_id, 'managerName', manager.manager_name, 'value', round(manager.deviation, 1))
      from manager_performance manager
      where manager.played >= 2
      order by manager.deviation, manager.average desc, manager.manager_name
      limit 1
    ),
    'bestPlayerGameweek', (
      select jsonb_build_object(
        'playerId', player.id,
        'playerName', player.display_name,
        'clubCode', player.club_code,
        'managerId', player.owner_id,
        'managerName', manager.display_name,
        'gameweekNumber', gameweek.number,
        'score', round(rating.points, 1)
      )
      from active_ratings rating
      join public.players player on player.id = rating.player_id and player.owner_id is not null
      join public.managers manager on manager.id = player.owner_id
      join visible_gameweeks gameweek on gameweek.id = rating.gameweek_id
      order by rating.points desc, gameweek.number, player.display_name
      limit 1
    )
  )
)
$$;

revoke all on function public.get_season_statistics() from public, anon;
grant execute on function public.get_season_statistics() to authenticated, service_role;

grant select on public.player_provider_mappings, public.fixture_provider_mappings, public.rating_import_runs to authenticated;
grant all on public.player_provider_mappings, public.fixture_provider_mappings, public.rating_import_runs to service_role;

-- Atomically replace availability data for drafted players after a successful scrape.
create or replace function public.apply_availability_import(
  p_league_id uuid,
  p_availability jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  imported_count integer;
begin
  if jsonb_typeof(coalesce(p_availability, '[]'::jsonb)) <> 'array' then
    raise exception 'Availability payload must be an array.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_availability, '[]'::jsonb))
      as item(player_id uuid, status text, note text)
    where item.status not in ('questionable', 'out', 'suspended')
      or item.note is not null and char_length(item.note) > 160
  ) then raise exception 'Availability payload is invalid.'; end if;

  update public.players player
  set availability_status = 'available', is_injured = false,
    injury_note = null, injury_updated_at = now()
  where player.league_id = p_league_id
    and exists (
      select 1 from public.draft_picks pick
      where pick.league_id = p_league_id and pick.player_id = player.id
    );

  update public.players player
  set availability_status = item.status, is_injured = true,
    injury_note = item.note, injury_updated_at = now()
  from jsonb_to_recordset(coalesce(p_availability, '[]'::jsonb))
    as item(player_id uuid, status text, note text)
  where player.id = item.player_id and player.league_id = p_league_id
    and exists (
      select 1 from public.draft_picks pick
      where pick.league_id = p_league_id and pick.player_id = player.id
    );
  get diagnostics imported_count = row_count;
  return imported_count;
end;
$$;

revoke all on function public.apply_availability_import(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_availability_import(uuid, jsonb) to service_role;
