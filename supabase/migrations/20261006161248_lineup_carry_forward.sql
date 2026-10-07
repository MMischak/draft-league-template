-- Snapshot the last valid earlier lineup inside the rating import transaction.

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
