begin;

alter table public.workout_exercises add constraint workout_exercises_weight_finite
  check (target_weight is null or (target_weight <> 'NaN'::numeric and target_weight <= 999999.99));

-- Aggregate writes are only possible through transactional, ownership-checked RPCs.
revoke insert, update, delete on public.workouts, public.workout_exercises from authenticated;
-- Earlier migrations granted column-level privileges; revoke those explicitly too.
revoke insert (id, owner_id, name, description, is_public, estimated_duration),
  update (name, description, is_public, estimated_duration) on public.workouts from authenticated;
revoke insert (id, workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes),
  update (workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes)
  on public.workout_exercises from authenticated;

create function public.save_workout(
  p_workout_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_description text, p_is_public boolean,
  p_estimated_duration integer, p_exercises jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved_id uuid;
  current_version timestamptz;
  item jsonb;
  position integer := 0;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_name is null or p_name ~ '^[[:space:]]*$' or char_length(btrim(p_name)) not between 1 and 120
    or p_description is null or char_length(p_description) > 2000 or p_is_public is null
    or (p_estimated_duration is not null and p_estimated_duration not between 1 and 86400)
    or p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'Invalid workout details' using errcode = '22023';
  end if;
  if jsonb_array_length(p_exercises) not between 1 and 100 then
    raise exception 'A workout requires between 1 and 100 exercises' using errcode = '22023';
  end if;
  if p_workout_id is null then
    insert into public.workouts (owner_id, name, description, is_public, estimated_duration)
    values (actor, btrim(p_name), p_description, p_is_public, p_estimated_duration)
    returning id into saved_id;
  else
    select updated_at into current_version from public.workouts
      where id = p_workout_id and owner_id = actor for update;
    if not found then raise exception 'Workout not found or not owned' using errcode = '42501'; end if;
    if p_expected_updated_at is null or current_version <> p_expected_updated_at then
      raise exception 'Workout version conflict' using errcode = '40001';
    end if;
    saved_id := p_workout_id;
    update public.workouts set name = btrim(p_name), description = p_description,
      is_public = p_is_public, estimated_duration = p_estimated_duration where id = saved_id;
    delete from public.workout_exercises where workout_id = saved_id;
  end if;
  for item in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(item) <> 'object' or item->>'exercise_id' is null
      or item->>'target_sets' is null or item->>'target_reps' is null
      or item->>'rest_seconds' is null or item->>'notes' is null then
      raise exception 'Invalid exercise configuration' using errcode = '22023';
    end if;
    if (item->>'target_sets')::integer not between 1 and 100
      or (item->>'target_reps')::integer not between 1 and 10000
      or (item->>'rest_seconds')::integer not between 0 and 86400
      or char_length(item->>'notes') > 1000
      or ((item->>'target_weight') is not null and
        ((item->>'target_weight')::numeric < 0 or (item->>'target_weight')::numeric > 999999.99
          or (item->>'target_weight')::numeric = 'NaN'::numeric)) then
      raise exception 'Invalid sets, reps, weight, rest or notes' using errcode = '22023';
    end if;
    insert into public.workout_exercises
      (workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes)
    values (saved_id, (item->>'exercise_id')::uuid, position,
      (item->>'target_sets')::integer, (item->>'target_reps')::integer,
      (item->>'target_weight')::numeric, (item->>'rest_seconds')::integer, item->>'notes');
    position := position + 1;
  end loop;
  return saved_id;
end;
$$;

create function public.delete_workout(p_workout_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  current_version timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select updated_at into current_version from public.workouts
    where id = p_workout_id and owner_id = actor for update;
  if not found then raise exception 'Workout not found or not owned' using errcode = '42501'; end if;
  if p_expected_updated_at is null or current_version <> p_expected_updated_at then
    raise exception 'Workout version conflict' using errcode = '40001';
  end if;
  delete from public.workouts where id = p_workout_id;
end;
$$;

revoke all on function public.save_workout(uuid, timestamptz, text, text, boolean, integer, jsonb) from public, anon;
revoke all on function public.delete_workout(uuid, timestamptz) from public, anon;
grant execute on function public.save_workout(uuid, timestamptz, text, text, boolean, integer, jsonb) to authenticated;
grant execute on function public.delete_workout(uuid, timestamptz) to authenticated;

commit;
