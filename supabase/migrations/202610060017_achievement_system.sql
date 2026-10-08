begin;
-- Existing earned badges remain visible; retired definitions are never newly awarded.
alter table public.achievements add column is_active boolean not null default true;
alter table public.user_achievements add column presented_at timestamptz;
update public.user_achievements set presented_at = unlocked_at;
insert into public.achievements(id,code,title,description,icon,category,requirement_type,requirement_value,is_active) values
('20000000-0000-0000-0000-000000000001','FIRST_WORKOUT','First Workout','Complete your first workout.','barbell-outline','consistency','workout_count',1,true),
('20000000-0000-0000-0000-000000000009','WORKOUTS_5','5 Workouts','Complete five workouts.','barbell-outline','consistency','workout_count',5,true),
('20000000-0000-0000-0000-000000000002','WORKOUTS_10','10 Workouts','Complete ten workouts.','barbell-outline','consistency','workout_count',10,true),
('20000000-0000-0000-0000-000000000010','WORKOUTS_50','50 Workouts','Complete fifty workouts.','ribbon-outline','consistency','workout_count',50,true),
('20000000-0000-0000-0000-000000000003','WORKOUTS_100','100 Workouts','Complete one hundred workouts.','trophy-outline','consistency','workout_count',100,true),
('20000000-0000-0000-0000-000000000011','STREAK_3','3 Day Streak','Train on three consecutive UTC dates.','flame-outline','streaks','streak_days',3,true),
('20000000-0000-0000-0000-000000000004','STREAK_7','7 Day Streak','Train on seven consecutive UTC dates.','flame-outline','streaks','streak_days',7,true),
('20000000-0000-0000-0000-000000000012','STREAK_30','30 Day Streak','Train on thirty consecutive UTC dates.','flame-outline','streaks','streak_days',30,true),
('20000000-0000-0000-0000-000000000013','FIRST_PR','First Personal Record','Set your first confirmed personal record.','trending-up-outline','strength','personal_records',1,true),
('20000000-0000-0000-0000-000000000014','PRS_10','10 Personal Records','Set ten confirmed personal records.','trending-up-outline','strength','personal_records',10,true),
('20000000-0000-0000-0000-000000000006','FIRST_FRIEND','First Friend','Make your first fitness friend.','people-outline','social','friend_count',1,true),
('20000000-0000-0000-0000-000000000015','FIRST_CHALLENGE','First Challenge','Join or create your first challenge.','flag-outline','social','challenges_joined',1,true),
('20000000-0000-0000-0000-000000000007','CHALLENGE_WIN','Challenge Winner','Finish a finalized challenge in shared first place and reach its target.','medal-outline','social','challenge_wins',1,true),
('20000000-0000-0000-0000-000000000016','CHALLENGES_5','Complete 5 Challenges','Reach the target in five different challenges.','checkmark-circle-outline','social','challenges_completed',5,true),
('20000000-0000-0000-0000-000000000005','VOLUME_10000','Lift 10,000 kg','Accumulate 10,000 kg of completed set volume.','fitness-outline','volume','total_volume',10000,true),
('20000000-0000-0000-0000-000000000017','VOLUME_100000','Marathon Lifter','Accumulate 100,000 kg of completed set volume.','fitness-outline','volume','total_volume',100000,true),
('20000000-0000-0000-0000-000000000018','VOLUME_1000000','Lift 1,000,000 kg','Accumulate 1,000,000 kg of completed set volume.','trophy-outline','volume','total_volume',1000000,true),
('20000000-0000-0000-0000-000000000008','PRS_5','Personal Best','Legacy badge: five personal records.','trending-up-outline','strength','personal_records',5,false)
on conflict(code) do update set title=excluded.title,description=excluded.description,icon=excluded.icon,
 category=excluded.category,requirement_type=excluded.requirement_type,requirement_value=excluded.requirement_value,is_active=excluded.is_active;

-- Trusted, durable domain facts. No FK here: emitting under a challenge/friendship
-- lock must not acquire a second user's profile lock. Profile deletion cleans up.
create table public.achievement_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 event_key text not null, event_type text not null check(event_type in
 ('WorkoutCompleted','PersonalRecordCreated','FriendAdded','ChallengeJoined','ChallengeCompleted','ChallengeWon')),
 source_id uuid not null, occurred_at timestamptz not null default now(), processed_at timestamptz,
 unique(user_id,event_key));
create index achievement_events_pending on public.achievement_events(user_id) where processed_at is null;
create index achievement_events_metrics on public.achievement_events(user_id,event_type);
alter table public.achievement_events enable row level security;
revoke all on public.achievement_events from public,anon,authenticated;
grant select on public.achievement_events to authenticated;
create policy achievement_events_own on public.achievement_events for select to authenticated using(user_id=(select auth.uid()));

create table public.achievement_metrics(user_id uuid primary key references public.profiles(id) on delete cascade,
 progress jsonb not null default '{}'::jsonb);
alter table public.achievement_metrics enable row level security;
revoke all on public.achievement_metrics from public,anon,authenticated;
grant select on public.achievement_metrics to authenticated;
create policy achievement_metrics_own on public.achievement_metrics for select to authenticated using(user_id=(select auth.uid()));

create table private.achievement_finalized_challenges(challenge_id uuid primary key, finalized_at timestamptz not null default now());
alter table private.achievement_finalized_challenges enable row level security;
revoke all on private.achievement_finalized_challenges from public,anon,authenticated;

create function private.emit_achievement_event(p_user uuid,p_type text,p_source uuid,p_key text)
returns void language sql security definer set search_path = '' as $$
 insert into public.achievement_events(user_id,event_type,source_id,event_key)
 values(p_user,p_type,p_source,p_key) on conflict(user_id,event_key) do nothing;
$$;
revoke all on function private.emit_achievement_event(uuid,text,uuid,text) from public,anon,authenticated;

create function private.achievement_source_event() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 if tg_table_name='workout_sync_receipts' then
   perform private.emit_achievement_event(new.user_id,'WorkoutCompleted',new.session_id,'workout:'||new.session_id);
   for r in select ws.id from public.workout_sets ws join public.workout_session_exercises se on se.id=ws.session_exercise_id
     where se.session_id=new.session_id and ws.completed and ws.is_personal_record loop
     perform private.emit_achievement_event(new.user_id,'PersonalRecordCreated',r.id,'pr:'||r.id);
   end loop;
 elsif tg_table_name='friendships' then
   if new.status='accepted' then
     perform private.emit_achievement_event(new.requester_id,'FriendAdded',new.id,'friend:'||new.id);
     perform private.emit_achievement_event(new.addressee_id,'FriendAdded',new.id,'friend:'||new.id);
   end if;
 elsif tg_table_name='challenge_participants' then
   if new.left_at is null then
     perform private.emit_achievement_event(new.user_id,'ChallengeJoined',new.challenge_id,'joined:'||new.challenge_id);
     if new.completed and exists(select 1 from public.challenges c where c.id=new.challenge_id and c.status in ('active','completed')) then
       perform private.emit_achievement_event(new.user_id,'ChallengeCompleted',new.challenge_id,'completed:'||new.challenge_id);
     end if;
   end if;
 end if;
 return new;
end; $$;
revoke all on function private.achievement_source_event() from public,anon,authenticated;
create trigger achievement_workout_event after insert on private.workout_sync_receipts for each row execute function private.achievement_source_event();
create trigger achievement_friend_event after insert or update of status on public.friendships for each row execute function private.achievement_source_event();
create trigger achievement_challenge_event after insert or update of completed,left_at on public.challenge_participants for each row execute function private.achievement_source_event();

create function private.cleanup_achievement_events() returns trigger language plpgsql security definer set search_path = '' as $$
begin delete from public.achievement_events where user_id=old.id; return old; end; $$;
revoke all on function private.cleanup_achievement_events() from public,anon,authenticated;
create trigger achievement_profile_cleanup after delete on public.profiles for each row execute function private.cleanup_achievement_events();

-- One central calculation; callers supply an identity, never a score.
create function private.evaluate_achievements(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare metrics jsonb; awards jsonb; workouts bigint; volume numeric; prs bigint; streak bigint;
begin
 -- Same lock order as session sync. Unique award key makes retries idempotent.
 perform id from public.profiles where id=p_user for update;
 if not found then return '[]'::jsonb; end if;
 select count(*),coalesce(sum(total_volume),0) into workouts,volume from public.workout_sessions
 where user_id=p_user and completed_at is not null and sync_status='synced';
 select count(*) into prs from public.workout_sets ws join public.workout_session_exercises se on se.id=ws.session_exercise_id
 join public.workout_sessions s on s.id=se.session_id where s.user_id=p_user and s.completed_at is not null
 and s.sync_status='synced' and ws.completed and ws.is_personal_record;
 with workout_days as(select distinct (started_at at time zone 'UTC')::date as workout_day from public.workout_sessions
   where user_id=p_user and completed_at is not null and sync_status='synced'),
 streak_groups as(select workout_day-row_number() over(order by workout_day)::integer as streak_group from workout_days),
 streak_lengths as(select count(*) as streak_length from streak_groups group by streak_group)
 select coalesce(max(streak_length),0) into streak from streak_lengths;
 metrics:=jsonb_build_object('workout_count',workouts,'total_volume',volume,'personal_records',prs,'streak_days',streak,
 'friend_count',case when exists(select 1 from public.achievement_events where user_id=p_user and event_type='FriendAdded')
   or exists(select 1 from public.friendships where status='accepted' and p_user in(requester_id,addressee_id)) then 1 else 0 end,
 'challenges_joined',(select count(*) from public.achievement_events where user_id=p_user and event_type='ChallengeJoined'),
 'challenges_completed',(select count(*) from public.achievement_events where user_id=p_user and event_type='ChallengeCompleted'),
 'challenge_wins',(select count(*) from public.achievement_events where user_id=p_user and event_type='ChallengeWon'));
 insert into public.achievement_metrics(user_id,progress) values(p_user,metrics)
 on conflict(user_id) do update set progress=excluded.progress where achievement_metrics.progress is distinct from excluded.progress;
 with unlocked as(
 insert into public.user_achievements(user_id,achievement_id)
 select p_user,a.id from public.achievements a where a.is_active and coalesce((metrics->>a.requirement_type::text)::numeric,0)>=a.requirement_value
 on conflict(user_id,achievement_id) do nothing returning achievement_id)
 select coalesce(jsonb_agg(jsonb_build_object('code',a.code,'title',a.title) order by a.code),'[]'::jsonb)
 into awards from unlocked u join public.achievements a on a.id=u.achievement_id;
 return awards;
end; $$;
revoke all on function private.evaluate_achievements(uuid) from public,anon,authenticated;

create function public.reconcile_achievements(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Authentication mismatch' using errcode='42501'; end if;
 perform private.evaluate_achievements(p_user);
end; $$;
revoke all on function public.reconcile_achievements(uuid) from public,anon;
grant execute on function public.reconcile_achievements(uuid) to authenticated;

create function public.get_my_achievements(p_user uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare board jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Authentication mismatch' using errcode='42501'; end if;
 select jsonb_build_object('entries',coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'code',a.code,'title',a.title,'description',a.description,'icon',a.icon,'category',a.category,
 'metric',a.requirement_type,'target',a.requirement_value,'current',coalesce((m.progress->>a.requirement_type::text)::numeric,0),
 'unlockedAt',ua.unlocked_at,'presentedAt',ua.presented_at,'active',a.is_active) order by a.category,a.requirement_value,a.code),'[]'::jsonb))
 into board from public.achievements a left join public.user_achievements ua on ua.achievement_id=a.id and ua.user_id=p_user
 left join public.achievement_metrics m on m.user_id=p_user where a.is_active or ua.id is not null;
 return board;
end; $$;
revoke all on function public.get_my_achievements(uuid) from public,anon;
grant execute on function public.get_my_achievements(uuid) to authenticated;

create function public.acknowledge_achievement(p_user uuid,p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Authentication mismatch' using errcode='42501'; end if;
 update public.user_achievements set presented_at=coalesce(presented_at,now()) where user_id=p_user and achievement_id=p_id;
 if not found then raise exception 'Award not found' using errcode='22023'; end if;
end; $$;
revoke all on function public.acknowledge_achievement(uuid,uuid) from public,anon;
grant execute on function public.acknowledge_achievement(uuid,uuid) to authenticated;

-- Finalize once, after the inclusive seven-day late-sync allowance. Qualified ties share the win.
create function public.finalize_achievement_challenges() returns void language plpgsql security definer set search_path = '' as $$
declare c record; participant record;
begin
 for c in select ch.id from public.challenges ch where ch.status='completed'
 and ch.end_date+7<(now() at time zone 'UTC')::date
 and not exists(select 1 from private.achievement_finalized_challenges f where f.challenge_id=ch.id)
 order by ch.id limit 100 for update of ch skip locked loop
   insert into private.achievement_finalized_challenges(challenge_id) values(c.id) on conflict do nothing;
   if found then
     for participant in select user_id from public.challenge_participants where challenge_id=c.id and left_at is null and completed and rank=1 loop
       perform private.emit_achievement_event(participant.user_id,'ChallengeWon',c.id,'won:'||c.id);
     end loop;
   end if;
 end loop;
end; $$;
revoke all on function public.finalize_achievement_challenges() from public,anon,authenticated;
grant execute on function public.finalize_achievement_challenges() to service_role;
-- Separate transaction/job: never hold challenge locks while acquiring profile locks.
create function public.run_achievement_events() returns void language plpgsql security definer set search_path = '' as $$
declare actor record; ids uuid[];
begin
 for actor in select distinct user_id from public.achievement_events where processed_at is null order by user_id limit 100 loop
   perform id from public.profiles where id=actor.user_id for update skip locked;
   if not found then
     delete from public.achievement_events e where e.user_id=actor.user_id and not exists(select 1 from public.profiles p where p.id=e.user_id);
     continue;
   end if;
   select array_agg(id) into ids from public.achievement_events where user_id=actor.user_id and processed_at is null;
   perform private.evaluate_achievements(actor.user_id);
   -- Do not consume events arriving after the evaluator's snapshot.
   update public.achievement_events set processed_at=now() where id=any(ids);
 end loop;
end; $$;
revoke all on function public.run_achievement_events() from public,anon,authenticated;
grant execute on function public.run_achievement_events() to service_role;

-- Durable backfill of existing social milestones; do not resurrect removed relationships.
insert into public.achievement_events(user_id,event_key,event_type,source_id)
 select user_id,'friend:'||id,'FriendAdded',id from(
 select requester_id user_id,id from public.friendships where status='accepted'
 union all select addressee_id,id from public.friendships where status='accepted') f on conflict do nothing;
insert into public.achievement_events(user_id,event_key,event_type,source_id)
 select user_id,'joined:'||challenge_id,'ChallengeJoined',challenge_id from public.challenge_participants on conflict do nothing;
insert into public.achievement_events(user_id,event_key,event_type,source_id)
 select cp.user_id,'completed:'||cp.challenge_id,'ChallengeCompleted',cp.challenge_id from public.challenge_participants cp
 join public.challenges c on c.id=cp.challenge_id where cp.completed and c.status in('active','completed') on conflict do nothing;
insert into public.achievement_events(user_id,event_key,event_type,source_id)
 select user_id,'workout:'||id,'WorkoutCompleted',id from public.workout_sessions where completed_at is not null and sync_status='synced' on conflict do nothing;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='achievement_events') then
     alter publication supabase_realtime add table public.achievement_events;
   end if;
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_achievements') then
     alter publication supabase_realtime add table public.user_achievements;
   end if;
 end if;
end; $$;
select cron.schedule('fithub-achievement-finalization','* * * * *','select public.finalize_achievement_challenges()');
select cron.schedule('fithub-achievement-events','* * * * *','select public.run_achievement_events()');

-- Notifications are emitted only by a successful unique unlock INSERT.
create function private.notify_achievement_unlock() returns trigger language plpgsql security definer set search_path = '' as $$
declare badge public.achievements; notification uuid;
begin
 select * into badge from public.achievements where id=new.achievement_id;
 insert into public.notifications(user_id,type,title,message,data) values(new.user_id,'achievement_unlocked','Achievement unlocked',badge.title,
 jsonb_build_object('kind','achievement_unlocked','achievementId',badge.id,'userId',new.user_id)) returning id into notification;
 insert into private.challenge_push_outbox(notification_id,token) select notification,token from public.push_devices where user_id=new.user_id;
 return new;
end; $$;
revoke all on function private.notify_achievement_unlock() from public,anon,authenticated;
create trigger achievement_unlock_notification after insert on public.user_achievements for each row execute function private.notify_achievement_unlock();

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

  awarded := private.evaluate_achievements(actor);
  result := jsonb_build_object('durationSeconds', floor(extract(epoch from finish_time - start_time)), 'totalSets', sets_count, 'totalReps', reps_count,
    'volume', session_volume, 'exercisesCompleted', exercise_count, 'personalRecords', records, 'achievements', awarded, 'challengeChanges', changes);
  insert into private.workout_sync_receipts(session_id, user_id, payload_hash, receipt) values (p_session_id, actor, fingerprint, result);
  return result;
end;
$$;

commit;
