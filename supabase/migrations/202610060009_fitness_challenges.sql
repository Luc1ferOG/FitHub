begin;

alter table public.challenges add column exercise_id uuid references public.exercises(id) on delete restrict;
alter table public.challenges add constraint challenges_exercise_metric check (exercise_id is null or metric_type = 'repetitions');
alter table public.challenges add column leaderboard_version bigint not null default 0;
alter table public.challenges add constraint challenges_target_finite check(target_value <= 999999999999.99);
alter table public.challenge_participants add column left_at timestamptz;
create index challenge_participants_active_idx on public.challenge_participants(challenge_id,current_value desc,user_id) where left_at is null;

create table public.challenge_invites (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(challenge_id,user_id), check (user_id <> invited_by)
);
create index challenge_invites_user_idx on public.challenge_invites(user_id,status,created_at desc);
alter table public.challenge_invites enable row level security;
create policy challenge_invites_read on public.challenge_invites for select to authenticated using(user_id = auth.uid() or invited_by = auth.uid());
grant select on public.challenge_invites to authenticated;

create or replace function private.can_view_challenge(p_challenge_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.challenges c where c.id = p_challenge_id and (
    c.visibility = 'public' or c.creator_id = auth.uid()
    or exists(select 1 from public.challenge_participants p where p.challenge_id = c.id and p.user_id = auth.uid() and p.left_at is null)
    or exists(select 1 from public.challenge_invites i where i.challenge_id = c.id and i.user_id = auth.uid() and i.status = 'pending')
    or (c.visibility = 'friends' and private.are_friends(c.creator_id,auth.uid()))));
$$;
-- An owner can read their tombstone but other viewers only see current members.
drop policy challenge_participants_read_visible on public.challenge_participants;
create policy challenge_participants_read_visible on public.challenge_participants for select to authenticated
using (user_id = auth.uid() or (left_at is null and private.can_view_challenge(challenge_id)));
drop policy challenge_progress_read_visible on public.challenge_progress;
create policy challenge_progress_read_own on public.challenge_progress for select to authenticated using (user_id = auth.uid());
revoke insert,update,delete on public.challenges,public.challenge_participants from authenticated;
revoke insert(id,creator_id,title,description,challenge_type,metric_type,target_value,start_date,end_date,visibility,status),
  update(title,description,challenge_type,metric_type,target_value,start_date,end_date,visibility,status) on public.challenges from authenticated;
revoke insert(id,challenge_id,user_id) on public.challenge_participants from authenticated;

create table private.challenge_notification_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null, primary key(user_id,event_key)
);
create table public.push_devices (
  token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
create policy push_devices_own on public.push_devices for select to authenticated using(user_id = auth.uid());
create policy push_devices_remove on public.push_devices for delete to authenticated using(user_id = auth.uid());
grant select,delete on public.push_devices to authenticated;
create table private.challenge_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token text not null references public.push_devices(token) on delete cascade,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  receipt_id text,
  state text not null default 'pending' check(state in ('pending','receipt','done','failed')),
  unique(notification_id,token)
);
alter table private.challenge_notification_events enable row level security;
alter table private.challenge_push_outbox enable row level security;
revoke all on private.challenge_notification_events,private.challenge_push_outbox from public,anon,authenticated;

create function private.emit_challenge_notification(p_user uuid,p_event text,p_challenge uuid,p_kind text,p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare notification uuid;
begin
  insert into private.challenge_notification_events values(p_user,p_event) on conflict do nothing;
  if not found then return; end if;
  insert into public.notifications(user_id,type,title,message,data)
    values(p_user,case when p_kind = 'invite' then 'challenge_invite'::public.notification_type else 'challenge_update'::public.notification_type end,
      'FitHub challenge',p_message,jsonb_build_object('kind',p_kind,'challengeId',p_challenge,'userId',p_user)) returning id into notification;
  insert into private.challenge_push_outbox(notification_id,token) select notification,token from public.push_devices where user_id = p_user;
end;
$$;

create or replace function private.recalculate_challenge_leaderboard(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare old_scores jsonb; changed record; other record; challenge_title text;
begin
  -- Caller holds the challenge row lock. Capture before scores for pass/completion events.
  select title into challenge_title from public.challenges where id = p_challenge_id;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'value',current_value,'completed',completed)),'[]'::jsonb)
    into old_scores from public.challenge_participants where challenge_id = p_challenge_id and left_at is null;
  with totals as (
    select p.id,p.user_id,coalesce(sum(g.value),0)::numeric(14,2) as value,c.target_value
    from public.challenge_participants p join public.challenges c on c.id = p.challenge_id
    left join public.challenge_progress g on g.challenge_id = p.challenge_id and g.user_id = p.user_id
    where p.challenge_id = p_challenge_id and p.left_at is null group by p.id,p.user_id,c.target_value
  ), ranked as(select *,dense_rank() over(order by value desc)::integer as place from totals)
  update public.challenge_participants p set current_value = r.value,completed = r.value >= r.target_value,rank = r.place from ranked r where p.id = r.id;
  update public.challenge_participants set rank = null where challenge_id = p_challenge_id and left_at is not null;
  for changed in select p.*,o.value as old_value,o.completed as old_completed from public.challenge_participants p
    join jsonb_to_recordset(old_scores) as o(user_id uuid,value numeric,completed boolean) on o.user_id = p.user_id
    where p.challenge_id = p_challenge_id and p.left_at is null and p.current_value > o.value loop
    if changed.completed and not changed.old_completed then
      perform private.emit_challenge_notification(changed.user_id,'goal:'||p_challenge_id,p_challenge_id,'completed','You reached the target in '||challenge_title||'!');
    end if;
    for other in select p.user_id from public.challenge_participants p
      where p.challenge_id = p_challenge_id and p.left_at is null and p.user_id <> changed.user_id
        and changed.old_value <= p.current_value and changed.current_value > p.current_value loop
      perform private.emit_challenge_notification(other.user_id,'pass:'||p_challenge_id||':'||changed.user_id||':'||changed.current_value,
        p_challenge_id,'rank_passed','Another participant passed your score in '||challenge_title||'.');
    end loop;
  end loop;
  update public.challenges set leaderboard_version = leaderboard_version + 1 where id = p_challenge_id;
end;
$$;

create function public.create_fitness_challenge(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid; metric public.challenge_metric; exercise uuid; target numeric;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  metric := (p_input->>'metric')::public.challenge_metric; exercise := nullif(p_input->>'exerciseId','')::uuid; target := (p_input->>'target')::numeric;
  if metric is null or metric not in ('workout_count','volume_kg','repetitions','duration_seconds') or target is null or target <= 0 or target > 999999999999.99
    or (metric in ('workout_count','repetitions') and target <> trunc(target))
    or (metric = 'repetitions' and exercise is null) or (metric <> 'repetitions' and exercise is not null)
    or (p_input->>'startDate')::date < (now() at time zone 'UTC')::date
    or (p_input->>'endDate')::date > (p_input->>'startDate')::date + 366 then
    raise exception 'Invalid challenge rules' using errcode = '22023';
  end if;
  insert into public.challenges(creator_id,title,description,challenge_type,metric_type,target_value,start_date,end_date,visibility,status,exercise_id)
    values(actor,trim(p_input->>'title'),coalesce(p_input->>'description',''),'community',metric,target,
      (p_input->>'startDate')::date,(p_input->>'endDate')::date,(p_input->>'visibility')::public.challenge_visibility,'active',exercise)
    returning id into result;
  return result;
end;
$$;

create function public.manage_challenge_membership(p_challenge uuid,p_action text,p_user uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); c public.challenges; target uuid; member public.challenge_participants; invite public.challenge_invites; friend record;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into c from public.challenges where id = p_challenge for update;
  if not found or not private.can_view_challenge(p_challenge) then raise exception 'Challenge unavailable' using errcode = '42501'; end if;
  if p_action = 'leave' then
    update public.challenge_participants set left_at = now(),rank = null where challenge_id = p_challenge and user_id = actor and left_at is null;
    if not found then return; end if;
    perform private.recalculate_challenge_leaderboard(p_challenge); return;
  end if;
  if c.status <> 'active' or (now() at time zone 'UTC')::date > c.end_date then raise exception 'Challenge closed' using errcode = '22023'; end if;
  if p_action = 'invite' then
    target := p_user;
    if c.creator_id <> actor or target is null or target = actor or not private.are_friends(actor,target) then raise exception 'Invite an accepted friend' using errcode = '42501'; end if;
    if exists(select 1 from public.challenge_participants where challenge_id = c.id and user_id = target and left_at is null) then return; end if;
    insert into public.challenge_invites(challenge_id,user_id,invited_by) values(c.id,target,actor) on conflict(challenge_id,user_id)
      do update set id = gen_random_uuid(),status = 'pending',created_at = now() where public.challenge_invites.status <> 'pending' returning * into invite;
    if found then perform private.emit_challenge_notification(target,'invite:'||invite.id,c.id,'invite','You were invited to '||c.title||'.'); end if;
    return;
  end if;
  select * into invite from public.challenge_invites where challenge_id = c.id and user_id = actor and status = 'pending';
  if p_action = 'decline' and invite.id is not null then
    update public.challenge_invites set status = 'declined' where id = invite.id; return;
  end if;
  if not ((p_action = 'accept' and invite.id is not null) or (p_action = 'join' and
    (c.visibility = 'public' or (c.visibility = 'friends' and private.are_friends(c.creator_id,actor)) or c.creator_id = actor))) then
    raise exception 'Cannot join this challenge' using errcode = '42501';
  end if;
  select * into member from public.challenge_participants where challenge_id = c.id and user_id = actor;
  if member.id is not null and member.left_at is null then return; end if;
  insert into public.challenge_participants(challenge_id,user_id) values(c.id,actor)
    on conflict(challenge_id,user_id) do update set left_at = null,joined_at = now();
  if invite.id is not null then update public.challenge_invites set status = 'accepted' where id = invite.id; end if;
  perform private.recalculate_challenge_leaderboard(c.id);
  for friend in select p.user_id from public.challenge_participants p where p.challenge_id = c.id and p.left_at is null and p.user_id <> actor and private.are_friends(p.user_id,actor) loop
    perform private.emit_challenge_notification(friend.user_id,'joined:'||c.id||':'||actor,c.id,'friend_joined','Your friend joined '||c.title||'.');
  end loop;
end;
$$;

create or replace function public.record_challenge_progress(p_challenge_id uuid,p_workout_session_id uuid)
returns public.challenge_progress language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); c public.challenges; s public.workout_sessions; p public.challenge_participants; result public.challenge_progress; value numeric;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into c from public.challenges where id = p_challenge_id for update;
  select * into p from public.challenge_participants where challenge_id = c.id and user_id = actor and left_at is null;
  if p.id is null then return null; end if;
  select * into s from public.workout_sessions where id = p_workout_session_id and user_id = actor and completed_at is not null;
  if s.id is null then raise exception 'Workout unavailable' using errcode = '42501'; end if;
  select * into result from public.challenge_progress where challenge_id = c.id and user_id = actor and workout_session_id = s.id;
  if result.id is not null then return result; end if;
  if c.status not in ('active','completed') or s.started_at < p.joined_at
    or (s.started_at at time zone 'UTC')::date not between c.start_date and c.end_date
    or (s.completed_at at time zone 'UTC')::date not between c.start_date and c.end_date
    or (now() at time zone 'UTC')::date > c.end_date + 7 then return null; end if;
  value := case c.metric_type
    when 'workout_count' then 1
    when 'duration_seconds' then s.duration_seconds
    when 'volume_kg' then (select coalesce(sum(ws.reps * ws.weight),0) from public.workout_sets ws join public.workout_session_exercises e on e.id = ws.session_exercise_id where e.session_id = s.id and ws.completed)
    when 'repetitions' then (select coalesce(sum(ws.reps),0) from public.workout_sets ws join public.workout_session_exercises e on e.id = ws.session_exercise_id where e.session_id = s.id and ws.completed and (c.exercise_id is null or e.exercise_id = c.exercise_id))
    when 'distance_m' then (select coalesce(sum(ws.distance),0) from public.workout_sets ws join public.workout_session_exercises e on e.id = ws.session_exercise_id where e.session_id = s.id and ws.completed)
  end;
  if value is null or value <= 0 then return null; end if;
  insert into public.challenge_progress(challenge_id,user_id,value,workout_session_id) values(c.id,actor,value,s.id)
    on conflict(challenge_id,user_id,workout_session_id) where workout_session_id is not null do nothing returning * into result;
  return result;
end;
$$;

create function public.get_fitness_challenge(p_challenge uuid,p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid page' using errcode = '22023'; end if;
  return (select jsonb_build_object('challenge',to_jsonb(c),'creator',to_jsonb(creator),
    'exercise_name',(select name from public.exercises where id = c.exercise_id),
    'participant_count',(select count(*) from public.challenge_participants where challenge_id = c.id and left_at is null),
    'membership',(select to_jsonb(p) from public.challenge_participants p where p.challenge_id = c.id and p.user_id = auth.uid()),
    'invited',exists(select 1 from public.challenge_invites where challenge_id = c.id and user_id = auth.uid() and status = 'pending'),
    'leaderboard',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
      select p.user_id,p.current_value,p.rank,p.completed,u.username,u.display_name,u.avatar_url from public.challenge_participants p
      join public.public_profiles u on u.id = p.user_id where p.challenge_id = c.id and p.left_at is null
      order by p.current_value desc,p.user_id limit 21 offset p_offset) r))
    from public.challenges c join public.public_profiles creator on creator.id = c.creator_id where c.id = p_challenge);
end;
$$;

create function public.register_challenge_push(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.push_devices(token,user_id) values(p_token,auth.uid()) on conflict(token)
    do update set updated_at = now() where public.push_devices.user_id = auth.uid();
  if not found then raise exception 'Token belongs to another account; unregister it first' using errcode = '42501'; end if;
end;
$$;

create function public.list_fitness_challenges(p_kind text,p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('discover','invites') or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid list' using errcode = '22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
    select c.* from public.challenges c where c.status in ('active','completed') and
      (p_kind = 'discover' or (c.status = 'active' and c.end_date >= (now() at time zone 'UTC')::date and exists(
        select 1 from public.challenge_invites i where i.challenge_id = c.id and i.user_id = auth.uid() and i.status = 'pending')))
    order by c.created_at desc,c.id limit 21 offset p_offset) r);
end;
$$;

create function public.run_challenge_deadlines()
returns void language plpgsql security definer set search_path = '' as $$
declare c record; p record; closes timestamptz;
begin
  for c in select * from public.challenges where status = 'active' order by id for update loop
    closes := (c.end_date + 1)::timestamp at time zone 'UTC';
    if closes <= now() + interval '24 hours' then
      for p in select user_id from public.challenge_participants where challenge_id = c.id and left_at is null loop
        perform private.emit_challenge_notification(p.user_id,case when closes > now() then 'ending:' else 'ended:' end||c.id,c.id,
          case when closes > now() then 'ending_soon' else 'completed' end,
          case when closes > now() then c.title||' ends within 24 hours.' else c.title||' has ended. Offline workouts may sync for seven more days.' end);
      end loop;
    end if;
    if closes <= now() then update public.challenges set status = 'completed' where id = c.id; end if;
  end loop;
end;
$$;

-- Realtime listens to the visible parent revision, including soft leaves/re-ranks.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'challenges') then
    alter publication supabase_realtime add table public.challenges;
  end if;
end $$;
revoke all on function private.emit_challenge_notification(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.create_fitness_challenge(jsonb),public.manage_challenge_membership(uuid,text,uuid),public.get_fitness_challenge(uuid,integer),public.register_challenge_push(text) from public,anon;
revoke all on function public.list_fitness_challenges(text,integer) from public,anon;
grant execute on function public.list_fitness_challenges(text,integer) to authenticated;
grant execute on function public.create_fitness_challenge(jsonb),public.manage_challenge_membership(uuid,text,uuid),public.get_fitness_challenge(uuid,integer),public.register_challenge_push(text) to authenticated;
revoke all on function public.run_challenge_deadlines() from public,anon,authenticated;
revoke all on function public.record_challenge_progress(uuid,uuid) from public,anon,authenticated;
grant execute on function public.run_challenge_deadlines() to service_role;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.challenge_push_outbox,public.push_devices to service_role;

commit;
