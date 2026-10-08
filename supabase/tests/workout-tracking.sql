-- Local migrated/seeded database only. Run with psql -v ON_ERROR_STOP=1 as postgres.
begin;
insert into auth.users(id, email, raw_user_meta_data) values
  ('90000000-0000-0000-0000-000000000001', 'tracking-owner@example.test', '{"username":"tracking_test_owner"}'),
  ('90000000-0000-0000-0000-000000000002', 'tracking-other@example.test', '{"username":"tracking_test_other"}');
insert into public.challenges(id, creator_id, title, description, challenge_type, metric_type, target_value, start_date, end_date, visibility, status)
  values ('70000000-0000-4000-8000-000000000001', '90000000-0000-0000-0000-000000000001', 'Tracking Test', '', 'individual', 'workout_count', 10,
    (now() at time zone 'UTC')::date - 1, (now() at time zone 'UTC')::date + 1, 'public', 'active');
update public.challenge_participants set joined_at = now() - interval '1 day'
where challenge_id = '70000000-0000-4000-8000-000000000001';
do $$
declare
  actor uuid := '90000000-0000-0000-0000-000000000001';
  session_id uuid := '80000000-0000-4000-8000-000000000001';
  payload jsonb := jsonb_build_object('workoutId', null, 'name', 'Tracking test', 'notes', 'Offline workout',
    'startedAt', now() - interval '2 minutes', 'completedAt', now() - interval '1 minute',
    'exercises', jsonb_build_array(jsonb_build_object('id', '80000000-0000-4000-8000-000000000002',
      'exerciseId', '10000000-0000-0000-0000-000000000001', 'name', 'Back Squat', 'notes', '', 'skipped', false, 'targetSets', 1, 'targetReps', 10, 'restSeconds', 60,
      'sets', jsonb_build_array(jsonb_build_object('id', '80000000-0000-4000-8000-000000000003', 'weight', 20, 'reps', 10, 'completed', true, 'completedAt', now() - interval '90 seconds')))));
  first_receipt jsonb;
  replay_receipt jsonb;
  history jsonb;
begin
  if has_function_privilege('anon', 'public.sync_workout_session(uuid,uuid,jsonb)', 'EXECUTE')
    or has_column_privilege('authenticated', 'public.workout_sets', 'is_personal_record', 'UPDATE')
    or has_column_privilege('authenticated', 'public.workout_sessions', 'completed_at', 'UPDATE') then
    raise exception 'Session rewards and history must not be directly client-writable';
  end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  first_receipt := public.sync_workout_session(actor, session_id, payload);
  replay_receipt := public.sync_workout_session(actor, session_id, payload);
  if first_receipt <> replay_receipt or (first_receipt->>'volume')::numeric <> 200
    or (first_receipt->>'totalSets')::integer <> 1 or jsonb_array_length(first_receipt->'personalRecords') <> 1 then
    raise exception 'Idempotent synchronization or server totals/PR calculation failed';
  end if;
  if (select count(*) from public.workout_sessions s where s.user_id = actor) <> 1
    or (select count(*) from public.challenge_progress cp where cp.user_id = actor and cp.workout_session_id = session_id) <> 1
    or (select current_value from public.challenge_participants cp where cp.user_id = actor and cp.challenge_id = '70000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Retry duplicated session or challenge effects';
  end if;
  if not exists (select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = actor and a.code = 'FIRST_WORKOUT') then
    raise exception 'First workout achievement was not awarded';
  end if;
  history := public.get_workout_exercise_history(array['10000000-0000-0000-0000-000000000001'::uuid]);
  if (history->0->>'bestVolume')::numeric <> 200 or jsonb_array_length(history->0->'previousSets') <> 1 then
    raise exception 'Previous performance history is incorrect';
  end if;
  begin
    perform public.sync_workout_session(actor, session_id, jsonb_set(payload, '{notes}', '"Changed"'));
    raise exception 'An idempotent session accepted a different payload';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.sync_workout_session(actor, '80000000-0000-4000-8000-000000000099', jsonb_set(payload, '{exercises,0,sets}', '[]'));
    raise exception 'Empty completion unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  if exists (select 1 from public.workout_sessions s where s.id = '80000000-0000-4000-8000-000000000099') then
    raise exception 'Invalid session did not roll back completely';
  end if;
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  begin
    perform public.sync_workout_session(actor, session_id, payload);
    raise exception 'Cross-account synchronization unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
  raise notice 'Workout tracking database regression checks passed';
end;
$$;
rollback;
