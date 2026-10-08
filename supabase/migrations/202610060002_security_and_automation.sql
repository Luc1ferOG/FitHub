begin;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function private.set_updated_at();

create or replace function private.set_workout_session_duration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed_at is null then
    new.duration_seconds := null;
  else
    new.duration_seconds := floor(extract(epoch from (new.completed_at - new.started_at)))::integer;
  end if;
  return new;
end;
$$;

create trigger workout_sessions_set_duration
before insert or update of started_at, completed_at on public.workout_sessions
for each row execute function private.set_workout_session_duration();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  fallback_username text := 'user_' || left(replace(new.id::text, '-', ''), 12);
  profile_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if requested_username !~ '^[a-z0-9_]{3,30}$' then
    requested_username := fallback_username;
  end if;

  profile_name := left(
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username),
    80
  );

  begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, requested_username, profile_name, new.raw_user_meta_data ->> 'avatar_url');
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, fallback_username, profile_name, new.raw_user_meta_data ->> 'avatar_url');
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.owns_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id and w.owner_id = auth.uid()
  );
$$;

create or replace function private.can_read_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id and (w.is_public or w.owner_id = auth.uid())
  );
$$;

create or replace function private.owns_workout_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session_id and s.user_id = auth.uid()
  );
$$;

create or replace function private.owns_session_exercise(p_session_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = p_session_exercise_id and s.user_id = auth.uid()
  );
$$;

create or replace function private.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_user_a and f.addressee_id = p_user_b)
        or (f.requester_id = p_user_b and f.addressee_id = p_user_a))
  );
$$;

create or replace function private.owns_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = p_challenge_id and c.creator_id = auth.uid()
  );
$$;

create or replace function private.can_view_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.challenges c
    where c.id = p_challenge_id
      and (
        c.visibility = 'public'
        or c.creator_id = auth.uid()
        or exists (
          select 1 from public.challenge_participants cp
          where cp.challenge_id = c.id and cp.user_id = auth.uid()
        )
        or (
          c.visibility = 'friends'
          and private.are_friends(c.creator_id, auth.uid())
        )
      )
  );
$$;

create or replace function private.can_join_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.challenges c
    where c.id = p_challenge_id
      and c.status = 'active'
      and current_date <= c.end_date
      and (
        c.creator_id = auth.uid()
        or c.visibility = 'public'
        or (c.visibility = 'friends' and private.are_friends(c.creator_id, auth.uid()))
      )
  );
$$;

create or replace function private.recalculate_session_volume(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workout_sessions s
  set total_volume = coalesce((
    select sum(coalesce(ws.reps, 0) * coalesce(ws.weight, 0))
    from public.workout_session_exercises se
    join public.workout_sets ws on ws.session_exercise_id = se.id
    where se.session_id = p_session_id and ws.completed
  ), 0)
  where s.id = p_session_id;
$$;

create or replace function private.refresh_session_volume()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_session_id uuid;
  old_session_id uuid;
begin
  if tg_op <> 'DELETE' then
    select se.session_id into new_session_id
    from public.workout_session_exercises se
    where se.id = new.session_exercise_id;
  end if;

  if tg_op <> 'INSERT' then
    select se.session_id into old_session_id
    from public.workout_session_exercises se
    where se.id = old.session_exercise_id;
  end if;

  perform private.recalculate_session_volume(new_session_id);

  if old_session_id is distinct from new_session_id then
    perform private.recalculate_session_volume(old_session_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workout_sets_refresh_volume
after insert or update or delete on public.workout_sets
for each row execute function private.refresh_session_volume();

create or replace function private.refresh_volume_after_session_exercise_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_session_volume(old.session_id);
    return old;
  end if;

  perform private.recalculate_session_volume(new.session_id);
  if tg_op = 'UPDATE' and old.session_id <> new.session_id then
    perform private.recalculate_session_volume(old.session_id);
  end if;
  return new;
end;
$$;

create trigger session_exercises_refresh_volume
after update of session_id or delete on public.workout_session_exercises
for each row execute function private.refresh_volume_after_session_exercise_change();

create or replace function private.recalculate_challenge_leaderboard(p_challenge_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with totals as (
    select
      cp.id,
      coalesce(sum(progress.value), 0)::numeric(14, 2) as total_value,
      c.target_value,
      cp.joined_at
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    left join public.challenge_progress progress
      on progress.challenge_id = cp.challenge_id and progress.user_id = cp.user_id
    where cp.challenge_id = p_challenge_id
    group by cp.id, c.target_value, cp.joined_at
  ), ranked as (
    select
      id,
      total_value,
      target_value,
      dense_rank() over (order by total_value desc, joined_at asc)::integer as calculated_rank
    from totals
  )
  update public.challenge_participants cp
  set
    current_value = ranked.total_value,
    completed = ranked.total_value >= ranked.target_value,
    rank = ranked.calculated_rank
  from ranked
  where cp.id = ranked.id;
$$;

create or replace function private.refresh_challenge_after_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.challenge_id <> new.challenge_id then
    perform private.recalculate_challenge_leaderboard(old.challenge_id);
  end if;
  if tg_op = 'DELETE' then
    perform private.recalculate_challenge_leaderboard(old.challenge_id);
    return old;
  end if;
  perform private.recalculate_challenge_leaderboard(new.challenge_id);
  return new;
end;
$$;

create trigger challenge_progress_refresh_leaderboard
after insert or update or delete on public.challenge_progress
for each row execute function private.refresh_challenge_after_progress();

create or replace function private.handle_challenge_participant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.recalculate_challenge_leaderboard(old.challenge_id);
    return old;
  end if;
  perform private.recalculate_challenge_leaderboard(new.challenge_id);
  return new;
end;
$$;

create trigger challenge_participant_refresh_leaderboard
after insert or delete on public.challenge_participants
for each row execute function private.handle_challenge_participant_change();

create or replace function private.add_challenge_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.challenge_participants (challenge_id, user_id)
  values (new.id, new.creator_id);
  return new;
end;
$$;

create trigger challenges_add_creator
after insert on public.challenges
for each row execute function private.add_challenge_creator();

create or replace function private.validate_challenge_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    old.metric_type is distinct from new.metric_type
    or old.target_value is distinct from new.target_value
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
  ) then
    raise exception 'Active or finished challenge scoring rules cannot be changed'
      using errcode = '23514';
  end if;

  if not (
    new.status = old.status
    or (old.status = 'draft' and new.status in ('active', 'cancelled'))
    or (old.status = 'active' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Invalid challenge status transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger challenges_validate_update
before update on public.challenges
for each row execute function private.validate_challenge_update();

create or replace function public.record_challenge_progress(
  p_challenge_id uuid,
  p_workout_session_id uuid
)
returns public.challenge_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  selected_challenge public.challenges%rowtype;
  selected_session public.workout_sessions%rowtype;
  calculated_value numeric(14, 2);
  inserted_progress public.challenge_progress%rowtype;
begin
  if acting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into selected_challenge
  from public.challenges
  where id = p_challenge_id
  for share;

  if not found or selected_challenge.status <> 'active' then
    raise exception 'Challenge is not active' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.challenge_participants
    where challenge_id = p_challenge_id and user_id = acting_user_id
  ) then
    raise exception 'User is not a challenge participant' using errcode = '42501';
  end if;

  select * into selected_session
  from public.workout_sessions
  where id = p_workout_session_id and user_id = acting_user_id and completed_at is not null;

  if not found then
    raise exception 'Completed workout session not found' using errcode = 'P0002';
  end if;

  if (selected_session.started_at at time zone 'UTC')::date
    not between selected_challenge.start_date and selected_challenge.end_date then
    raise exception 'Workout session is outside the challenge period' using errcode = '22007';
  end if;

  calculated_value := case selected_challenge.metric_type
    when 'workout_count' then 1
    when 'duration_seconds' then coalesce(
      selected_session.duration_seconds,
      extract(epoch from (selected_session.completed_at - selected_session.started_at))::numeric
    )
    when 'volume_kg' then (
      select coalesce(sum(coalesce(ws.reps, 0) * coalesce(ws.weight, 0)), 0)
      from public.workout_session_exercises se
      join public.workout_sets ws on ws.session_exercise_id = se.id
      where se.session_id = selected_session.id and ws.completed
    )
    when 'repetitions' then (
      select coalesce(sum(coalesce(ws.reps, 0)), 0)
      from public.workout_session_exercises se
      join public.workout_sets ws on ws.session_exercise_id = se.id
      where se.session_id = selected_session.id and ws.completed
    )
    when 'distance_m' then (
      select coalesce(sum(coalesce(ws.distance, 0)), 0)
      from public.workout_session_exercises se
      join public.workout_sets ws on ws.session_exercise_id = se.id
      where se.session_id = selected_session.id and ws.completed
    )
  end;

  if calculated_value is null or calculated_value <= 0 then
    raise exception 'Workout session has no qualifying progress' using errcode = '22023';
  end if;

  insert into public.challenge_progress (challenge_id, user_id, value, workout_session_id)
  values (p_challenge_id, acting_user_id, calculated_value, p_workout_session_id)
  returning * into inserted_progress;

  return inserted_progress;
end;
$$;

create view public.public_profiles
with (security_barrier = true, security_invoker = false)
as
select
  id,
  username,
  display_name,
  avatar_url,
  bio,
  experience_level,
  created_at
from public.profiles;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.friendships enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy exercises_read on public.exercises
for select to anon, authenticated using (true);

create policy workouts_read_visible on public.workouts
for select to authenticated using (owner_id = auth.uid() or is_public);
create policy workouts_insert_own on public.workouts
for insert to authenticated with check (owner_id = auth.uid());
create policy workouts_update_own on public.workouts
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy workouts_delete_own on public.workouts
for delete to authenticated using (owner_id = auth.uid());

create policy workout_exercises_read_visible on public.workout_exercises
for select to authenticated using (private.can_read_workout(workout_id));
create policy workout_exercises_insert_own on public.workout_exercises
for insert to authenticated with check (private.owns_workout(workout_id));
create policy workout_exercises_update_own on public.workout_exercises
for update to authenticated using (private.owns_workout(workout_id)) with check (private.owns_workout(workout_id));
create policy workout_exercises_delete_own on public.workout_exercises
for delete to authenticated using (private.owns_workout(workout_id));

create policy workout_sessions_select_own on public.workout_sessions
for select to authenticated using (user_id = auth.uid());
create policy workout_sessions_insert_own on public.workout_sessions
for insert to authenticated with check (
  user_id = auth.uid()
  and (workout_id is null or private.can_read_workout(workout_id))
);
create policy workout_sessions_update_own on public.workout_sessions
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (workout_id is null or private.can_read_workout(workout_id))
);
create policy workout_sessions_delete_own on public.workout_sessions
for delete to authenticated using (user_id = auth.uid());

create policy session_exercises_select_own on public.workout_session_exercises
for select to authenticated using (private.owns_workout_session(session_id));
create policy session_exercises_insert_own on public.workout_session_exercises
for insert to authenticated with check (private.owns_workout_session(session_id));
create policy session_exercises_update_own on public.workout_session_exercises
for update to authenticated using (private.owns_workout_session(session_id)) with check (private.owns_workout_session(session_id));
create policy session_exercises_delete_own on public.workout_session_exercises
for delete to authenticated using (private.owns_workout_session(session_id));

create policy workout_sets_select_own on public.workout_sets
for select to authenticated using (private.owns_session_exercise(session_exercise_id));
create policy workout_sets_insert_own on public.workout_sets
for insert to authenticated with check (private.owns_session_exercise(session_exercise_id));
create policy workout_sets_update_own on public.workout_sets
for update to authenticated using (private.owns_session_exercise(session_exercise_id)) with check (private.owns_session_exercise(session_exercise_id));
create policy workout_sets_delete_own on public.workout_sets
for delete to authenticated using (private.owns_session_exercise(session_exercise_id));

create policy friendships_select_involved on public.friendships
for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert_as_requester on public.friendships
for insert to authenticated with check (requester_id = auth.uid() and addressee_id <> auth.uid() and status = 'pending');
create policy friendships_respond_as_addressee on public.friendships
for update to authenticated
using (addressee_id = auth.uid() and status = 'pending')
with check (addressee_id = auth.uid() and status in ('accepted', 'declined'));
create policy friendships_delete_involved on public.friendships
for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy challenges_read_visible on public.challenges
for select to authenticated using (private.can_view_challenge(id));
create policy challenges_insert_own on public.challenges
for insert to authenticated with check (creator_id = auth.uid());
create policy challenges_update_own on public.challenges
for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy challenges_delete_own on public.challenges
for delete to authenticated using (creator_id = auth.uid());

create policy challenge_participants_read_visible on public.challenge_participants
for select to authenticated using (private.can_view_challenge(challenge_id));
create policy challenge_participants_join_or_invite on public.challenge_participants
for insert to authenticated with check (
  (user_id = auth.uid() and private.can_join_challenge(challenge_id))
  or private.owns_challenge(challenge_id)
);
create policy challenge_participants_leave_or_remove on public.challenge_participants
for delete to authenticated using (user_id = auth.uid() or private.owns_challenge(challenge_id));

create policy challenge_progress_read_visible on public.challenge_progress
for select to authenticated using (private.can_view_challenge(challenge_id));

create policy body_measurements_select_own on public.body_measurements
for select to authenticated using (user_id = auth.uid());
create policy body_measurements_insert_own on public.body_measurements
for insert to authenticated with check (user_id = auth.uid());
create policy body_measurements_update_own on public.body_measurements
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy body_measurements_delete_own on public.body_measurements
for delete to authenticated using (user_id = auth.uid());

create policy progress_photos_read_visible on public.progress_photos
for select to authenticated using (user_id = auth.uid() or not is_private);
create policy progress_photos_insert_own on public.progress_photos
for insert to authenticated with check (user_id = auth.uid());
create policy progress_photos_update_own on public.progress_photos
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_photos_delete_own on public.progress_photos
for delete to authenticated using (user_id = auth.uid());

create policy achievements_read on public.achievements
for select to anon, authenticated using (true);
create policy user_achievements_select_own on public.user_achievements
for select to authenticated using (user_id = auth.uid());

create policy notifications_select_own on public.notifications
for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications
for delete to authenticated using (user_id = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

grant select on public.exercises, public.achievements, public.public_profiles to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio, date_of_birth, gender, height_cm, weight_kg, preferred_units, experience_level)
  on public.profiles to authenticated;

grant select on public.workouts to authenticated;
grant insert (id, owner_id, name, description, is_public, estimated_duration) on public.workouts to authenticated;
grant update (name, description, is_public, estimated_duration) on public.workouts to authenticated;
grant delete on public.workouts to authenticated;

grant select on public.workout_exercises to authenticated;
grant insert (id, workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes)
  on public.workout_exercises to authenticated;
grant update (workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, rest_seconds, notes)
  on public.workout_exercises to authenticated;
grant delete on public.workout_exercises to authenticated;

grant select on public.workout_sessions to authenticated;
grant insert (id, user_id, workout_id, name, started_at, completed_at, notes, sync_status)
  on public.workout_sessions to authenticated;
grant update (workout_id, name, started_at, completed_at, notes, sync_status)
  on public.workout_sessions to authenticated;
grant delete on public.workout_sessions to authenticated;

grant select on public.workout_session_exercises to authenticated;
grant insert (id, session_id, exercise_id, order_index, notes) on public.workout_session_exercises to authenticated;
grant update (session_id, exercise_id, order_index, notes) on public.workout_session_exercises to authenticated;
grant delete on public.workout_session_exercises to authenticated;
grant select on public.workout_sets to authenticated;
grant insert (id, session_exercise_id, set_number, reps, weight, duration_seconds, distance, completed, is_personal_record)
  on public.workout_sets to authenticated;
grant update (session_exercise_id, set_number, reps, weight, duration_seconds, distance, completed, is_personal_record)
  on public.workout_sets to authenticated;
grant delete on public.workout_sets to authenticated;

grant select on public.friendships to authenticated;
grant insert (id, requester_id, addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
grant delete on public.friendships to authenticated;

grant select on public.challenges to authenticated;
grant insert (id, creator_id, title, description, challenge_type, metric_type, target_value, start_date, end_date, visibility, status)
  on public.challenges to authenticated;
grant update (title, description, challenge_type, metric_type, target_value, start_date, end_date, visibility, status)
  on public.challenges to authenticated;
grant delete on public.challenges to authenticated;

grant select on public.challenge_participants to authenticated;
grant insert (id, challenge_id, user_id) on public.challenge_participants to authenticated;
grant delete on public.challenge_participants to authenticated;
grant select on public.challenge_progress to authenticated;

grant select on public.body_measurements to authenticated;
grant insert (id, user_id, recorded_at, weight_kg, body_fat_percentage, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm)
  on public.body_measurements to authenticated;
grant update (recorded_at, weight_kg, body_fat_percentage, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm)
  on public.body_measurements to authenticated;
grant delete on public.body_measurements to authenticated;

grant select on public.progress_photos to authenticated;
grant insert (id, user_id, photo_url, thumbnail_url, pose_type, taken_at, notes, is_private)
  on public.progress_photos to authenticated;
grant update (photo_url, thumbnail_url, pose_type, taken_at, notes, is_private)
  on public.progress_photos to authenticated;
grant delete on public.progress_photos to authenticated;

grant select on public.user_achievements to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

revoke execute on all functions in schema private from public;
grant execute on function private.owns_workout(uuid) to authenticated;
grant execute on function private.can_read_workout(uuid) to authenticated;
grant execute on function private.owns_workout_session(uuid) to authenticated;
grant execute on function private.owns_session_exercise(uuid) to authenticated;
grant execute on function private.owns_challenge(uuid) to authenticated;
grant execute on function private.can_view_challenge(uuid) to authenticated;
grant execute on function private.can_join_challenge(uuid) to authenticated;

revoke execute on function public.record_challenge_progress(uuid, uuid) from public;
grant execute on function public.record_challenge_progress(uuid, uuid) to authenticated;

comment on view public.public_profiles is 'Public-safe profile projection. Sensitive health and demographic fields remain owner-only.';
comment on function public.record_challenge_progress(uuid, uuid) is 'Records challenge progress derived from an authenticated user-owned completed workout session.';

commit;
