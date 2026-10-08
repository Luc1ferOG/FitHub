begin;

create or replace function public.sync_workout_session(p_user_id uuid, p_session_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  fingerprint text := md5(p_payload::text);
  stored private.workout_sync_receipts%rowtype;
  existing_owner uuid;
  template_id uuid;
  start_time timestamptz;
  finish_time timestamptz;
  entry jsonb;
  logged jsonb;
  entry_id uuid;
  entry_index integer := 0;
  set_index integer;
  done boolean;
  done_time timestamptz;
  weight_value numeric;
  reps_value integer;
  sets_count integer;
  reps_count bigint;
  exercise_count integer;
  session_volume numeric;
  pr_count integer;
  workout_count integer;
  lifetime_volume numeric;
  streak integer;
  friend_count integer;
  wins integer;
  awarded jsonb;
  records jsonb;
  changes jsonb := '[]'::jsonb;
  result jsonb;
  challenge record;
  progress public.challenge_progress%rowtype;
begin
  if actor is null or actor is distinct from p_user_id then raise exception 'Authentication mismatch' using errcode = '42501'; end if;
  if p_session_id is null then raise exception 'Session ID is required' using errcode = '22023'; end if;
  -- Serialize this account's submissions and achievement evaluation.
  perform id from public.profiles where id = actor for update;
  if not found then raise exception 'Profile not found' using errcode = '42501'; end if;
  select * into stored from private.workout_sync_receipts where session_id = p_session_id;
  if found then
    if stored.user_id <> actor then raise exception 'Session belongs to another account' using errcode = '42501'; end if;
    if stored.payload_hash is distinct from fingerprint then raise exception 'Submitted session is immutable' using errcode = '40001'; end if;
    return stored.receipt;
  end if;
  select user_id into existing_owner from public.workout_sessions where id = p_session_id;
  if found then raise exception 'Session ID already exists' using errcode = '40001'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload->'exercises') is distinct from 'array'
    or p_payload->>'name' is null or char_length(p_payload->>'name') not between 1 and 120
    or p_payload->>'name' ~ '^[[:space:]]*$'
    or p_payload->>'notes' is null or char_length(p_payload->>'notes') > 4000 then
    raise exception 'Invalid workout session' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload->'exercises') not between 1 and 100 then raise exception 'Invalid exercise count' using errcode = '22023'; end if;
  start_time := (p_payload->>'startedAt')::timestamptz;
  finish_time := (p_payload->>'completedAt')::timestamptz;
  if start_time is null or finish_time is null or not isfinite(start_time) or not isfinite(finish_time)
    or finish_time < start_time or finish_time > now() + interval '5 minutes'
    or finish_time - start_time > interval '365 days' then raise exception 'Invalid session timestamps' using errcode = '22023'; end if;
  -- Deleted/revoked templates never prevent preserving independently logged history.
  select id into template_id from public.workouts where id = (p_payload->>'workoutId')::uuid and (owner_id = actor or is_public);
  insert into public.workout_sessions(id, user_id, workout_id, name, started_at, completed_at, notes, sync_status)
    values (p_session_id, actor, template_id, p_payload->>'name', start_time, finish_time, p_payload->>'notes', 'synced');
  for entry in select value from jsonb_array_elements(p_payload->'exercises') loop
    if jsonb_typeof(entry->'sets') is distinct from 'array' or entry->>'name' is null or char_length(entry->>'name') not between 1 and 120
      or entry->>'notes' is null or jsonb_typeof(entry->'skipped') is distinct from 'boolean'
      or jsonb_typeof(entry->'targetSets') is distinct from 'number'
      or jsonb_typeof(entry->'targetReps') is distinct from 'number'
      or jsonb_typeof(entry->'restSeconds') is distinct from 'number' then raise exception 'Invalid exercise' using errcode = '22023'; end if;
    if jsonb_array_length(entry->'sets') > 100 then raise exception 'Too many sets' using errcode = '22023'; end if;
    entry_id := (entry->>'id')::uuid;
    insert into public.workout_session_exercises(id, session_id, exercise_id, order_index, notes, exercise_name, target_sets, target_reps, rest_seconds, skipped)
      values (entry_id, p_session_id, (entry->>'exerciseId')::uuid, entry_index, entry->>'notes', entry->>'name',
        (entry->>'targetSets')::integer, (entry->>'targetReps')::integer, (entry->>'restSeconds')::integer, (entry->>'skipped')::boolean);
    entry_index := entry_index + 1;
    set_index := 1;
    for logged in select value from jsonb_array_elements(entry->'sets') loop
      if jsonb_typeof(logged->'completed') is distinct from 'boolean'
        or jsonb_typeof(logged->'weight') is distinct from 'number'
        or jsonb_typeof(logged->'reps') is distinct from 'number' then raise exception 'Invalid set' using errcode = '22023'; end if;
      done := (logged->>'completed')::boolean;
      done_time := (logged->>'completedAt')::timestamptz;
      weight_value := (logged->>'weight')::numeric;
      reps_value := (logged->>'reps')::integer;
      if weight_value not between 0 and 999999.99 or weight_value <> round(weight_value, 2)
        or reps_value not between 0 and 10000 or (done and reps_value = 0)
        or (done and (done_time is null or not isfinite(done_time) or done_time < start_time or done_time > finish_time))
        or (not done and done_time is not null) then raise exception 'Invalid set values' using errcode = '22023'; end if;
      insert into public.workout_sets(id, session_exercise_id, set_number, weight, reps, completed, completed_at)
        values ((logged->>'id')::uuid, entry_id, set_index, weight_value, reps_value, done, done_time);
      set_index := set_index + 1;
    end loop;
  end loop;
  select count(*), coalesce(sum(ws.reps), 0) into sets_count, reps_count
    from public.workout_sets ws join public.workout_session_exercises se on se.id = ws.session_exercise_id where se.session_id = p_session_id and ws.completed;
  if sets_count = 0 then raise exception 'Complete at least one set' using errcode = '22023'; end if;
  -- PRs compare against records already confirmed at sync, then earlier sets in this session.
  with candidates as (
    select ws.id, ws.weight * ws.reps as volume,
      coalesce((select max(prior.weight * prior.reps) from public.workout_sets prior
        join public.workout_session_exercises pe on pe.id = prior.session_exercise_id
        join public.workout_sessions ps on ps.id = pe.session_id
        where ps.user_id = actor and ps.id <> p_session_id and ps.completed_at is not null and pe.exercise_id = se.exercise_id and prior.completed), 0) as historical_best,
      coalesce(max(ws.weight * ws.reps) over (partition by se.exercise_id order by ws.completed_at, se.order_index, ws.set_number rows between unbounded preceding and 1 preceding), 0) as session_best
    from public.workout_sets ws join public.workout_session_exercises se on se.id = ws.session_exercise_id where se.session_id = p_session_id and ws.completed
  ) update public.workout_sets ws set is_personal_record = c.volume > greatest(c.historical_best, c.session_best) from candidates c where ws.id = c.id;
  select s.total_volume into session_volume from public.workout_sessions s where s.id = p_session_id;
  select count(*) into exercise_count from public.workout_session_exercises se where se.session_id = p_session_id and not se.skipped
    and exists (select 1 from public.workout_sets ws where ws.session_exercise_id = se.id)
    and not exists (select 1 from public.workout_sets ws where ws.session_exercise_id = se.id and not ws.completed);
  select coalesce(jsonb_agg(jsonb_build_object('exerciseName', se.exercise_name, 'setNumber', ws.set_number, 'volume', ws.weight * ws.reps) order by ws.completed_at, se.order_index, ws.set_number), '[]'::jsonb) into records
    from public.workout_sets ws join public.workout_session_exercises se on se.id = ws.session_exercise_id where se.session_id = p_session_id and ws.is_personal_record;

  -- Lock eligible challenges in a deterministic order before leaderboard mutations.
  for challenge in select c.* from public.challenges c join public.challenge_participants cp on cp.challenge_id = c.id
    where cp.user_id = actor and cp.left_at is null and c.status in ('active','completed') and (start_time at time zone 'UTC')::date between c.start_date and c.end_date
      and (c.metric_type = 'workout_count' or (c.metric_type = 'volume_kg' and session_volume > 0)
        or (c.metric_type = 'repetitions' and reps_count > 0) or (c.metric_type = 'duration_seconds' and finish_time > start_time))
    order by c.id for update of c loop
    if not exists (select 1 from public.challenge_progress where challenge_id = challenge.id and user_id = actor and workout_session_id = p_session_id) then
      progress := public.record_challenge_progress(challenge.id, p_session_id);
      if progress.id is not null then
        changes := changes || jsonb_build_array(jsonb_build_object('id', challenge.id, 'title', challenge.title, 'value', progress.value));
      end if;
    end if;
  end loop;

  select count(*), coalesce(sum(s.total_volume), 0) into workout_count, lifetime_volume from public.workout_sessions s where s.user_id = actor and s.completed_at is not null;
  select count(*) into pr_count from public.workout_sets ws join public.workout_session_exercises se on se.id = ws.session_exercise_id
    join public.workout_sessions s on s.id = se.session_id where s.user_id = actor and s.completed_at is not null and ws.is_personal_record;
  with days as (select distinct (s.started_at at time zone 'UTC')::date as day from public.workout_sessions s where s.user_id = actor and s.completed_at is not null),
    groups as (select day - row_number() over (order by day)::integer as grp from days), lengths as (select count(*) as n from groups group by grp)
    select coalesce(max(n), 0) into streak from lengths;
  select count(*) into friend_count from public.friendships where status = 'accepted' and (requester_id = actor or addressee_id = actor);
  select count(*) into wins from public.challenge_participants cp join public.challenges c on c.id = cp.challenge_id where cp.user_id = actor and c.status = 'completed' and cp.rank = 1 and cp.completed and cp.left_at is null and c.end_date + 7 < (now() at time zone 'UTC')::date;
  with unlocked as (
    insert into public.user_achievements(user_id, achievement_id)
    select actor, a.id from public.achievements a where (case a.requirement_type
      when 'workout_count' then workout_count when 'total_volume' then lifetime_volume when 'personal_records' then pr_count
      when 'streak_days' then streak when 'friend_count' then friend_count when 'challenge_wins' then wins end) >= a.requirement_value
    on conflict (user_id, achievement_id) do nothing returning achievement_id
  ) select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title) order by a.code), '[]'::jsonb) into awarded from unlocked u join public.achievements a on a.id = u.achievement_id;
  result := jsonb_build_object('durationSeconds', floor(extract(epoch from finish_time - start_time)), 'totalSets', sets_count, 'totalReps', reps_count,
    'volume', session_volume, 'exercisesCompleted', exercise_count, 'personalRecords', records, 'achievements', awarded, 'challengeChanges', changes);
  insert into private.workout_sync_receipts(session_id, user_id, payload_hash, receipt) values (p_session_id, actor, fingerprint, result);
  return result;
end;
$$;

commit;
