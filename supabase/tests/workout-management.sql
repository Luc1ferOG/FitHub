-- Run against a local, migrated and seeded Supabase database as postgres:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workout-management.sql
-- All fixtures are rolled back. This is a SQL regression script, not a pgTAP suite.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-0000-0000-000000000001', 'workout-owner@example.test', '{"username":"workout_test_owner","display_name":"Workout Test Owner"}'),
  ('90000000-0000-0000-0000-000000000002', 'workout-other@example.test', '{"username":"workout_test_other","display_name":"Workout Test Other"}');

do $$
declare
  owner_id uuid := '90000000-0000-0000-0000-000000000001';
  other_id uuid := '90000000-0000-0000-0000-000000000002';
  test_workout_id uuid;
  version timestamptz;
  session_id uuid;
  exercises jsonb := '[
    {"exercise_id":"10000000-0000-0000-0000-000000000001","target_sets":3,"target_reps":10,"target_weight":20,"rest_seconds":60,"notes":"first"},
    {"exercise_id":"10000000-0000-0000-0000-000000000001","target_sets":5,"target_reps":8,"target_weight":null,"rest_seconds":0,"notes":"second"}
  ]';
begin
  if has_function_privilege('anon', 'public.save_workout(uuid,timestamptz,text,text,boolean,integer,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_workout(uuid,timestamptz)', 'EXECUTE') then
    raise exception 'Anonymous users must not execute workout mutations';
  end if;
  if has_table_privilege('authenticated', 'public.workouts', 'DELETE')
    or has_column_privilege('authenticated', 'public.workouts', 'name', 'UPDATE')
    or has_column_privilege('authenticated', 'public.workouts', 'owner_id', 'INSERT')
    or has_column_privilege('authenticated', 'public.workout_exercises', 'workout_id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.workout_exercises', 'exercise_id', 'INSERT') then
    raise exception 'Direct client writes must not bypass aggregate RPCs';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.save_workout(null, null, 'Anonymous', '', false, null, exercises);
    raise exception 'Anonymous mutation unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  test_workout_id := public.save_workout(null, null, 'Strength', '', false, 1800, exercises);
  select updated_at into version from public.workouts where id = test_workout_id;
  if (select count(*) from public.workout_exercises where workout_exercises.workout_id = test_workout_id) <> 2 then
    raise exception 'Aggregate create did not save both exercise occurrences';
  end if;
  begin
    perform public.save_workout(null, null, 'Empty', '', false, null, '[]');
    raise exception 'Empty workout unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.save_workout(test_workout_id, version - interval '1 second', 'Stale', '', false, null, exercises);
    raise exception 'Stale edit unexpectedly succeeded';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.delete_workout(test_workout_id, version - interval '1 second');
    raise exception 'Stale deletion unexpectedly succeeded';
  exception when sqlstate '40001' then null; end;

  -- The metadata change and first child insert must roll back when a later child fails.
  begin
    perform public.save_workout(test_workout_id, version, 'Broken', '', false, null,
      jsonb_set(exercises, '{1,target_sets}', '0'));
    raise exception 'Invalid exercise unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  if (select name from public.workouts where id = test_workout_id) <> 'Strength'
    or (select count(*) from public.workout_exercises where workout_exercises.workout_id = test_workout_id) <> 2 then
    raise exception 'Failed save did not roll back the entire aggregate';
  end if;
  perform public.save_workout(test_workout_id, version, 'Reordered', '', true, null,
    jsonb_build_array(exercises->1, exercises->0));
  if (select target_sets from public.workout_exercises where workout_exercises.workout_id = test_workout_id and order_index = 0) <> 5 then
    raise exception 'Reordering lost the per-occurrence configuration';
  end if;
  select updated_at into version from public.workouts where id = test_workout_id;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  begin
    perform public.save_workout(test_workout_id, version, 'Other user edit', '', false, null, exercises);
    raise exception 'Non-owner edit unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.delete_workout(test_workout_id, version);
    raise exception 'Non-owner deletion unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.workout_sessions (user_id, workout_id, name, started_at)
    values (owner_id, test_workout_id, 'Completed history', now()) returning id into session_id;
  perform public.delete_workout(test_workout_id, version);
  if exists (select 1 from public.workout_exercises where workout_exercises.workout_id = test_workout_id)
    or exists (select 1 from public.workouts where id = test_workout_id) then
    raise exception 'Deletion did not cascade to template exercises';
  end if;
  if not exists (select 1 from public.workout_sessions where id = session_id and workout_sessions.workout_id is null) then
    raise exception 'Template deletion must preserve workout history';
  end if;
  raise notice 'Workout aggregate regression checks passed';
end;
$$;

rollback;
