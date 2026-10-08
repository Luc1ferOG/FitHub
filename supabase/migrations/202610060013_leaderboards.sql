begin;

-- Friends counts are deliberately opt-in, not a public projection of history.
alter table public.profiles add column share_friends_leaderboard boolean not null default false;
grant update(share_friends_leaderboard) on public.profiles to authenticated;
alter table public.challenges add column participant_count integer not null default 0 check(participant_count >= 0);
update public.challenges c set participant_count = (select count(*) from public.challenge_participants where challenge_id = c.id and left_at is null);
create function private.refresh_leaderboard_participant_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare delta integer := 0; board uuid;
begin
  if tg_op = 'INSERT' then board := new.challenge_id; if new.left_at is null then delta := 1; end if;
  elsif tg_op = 'DELETE' then board := old.challenge_id; if old.left_at is null then delta := -1; end if;
  else board := new.challenge_id; delta := (new.left_at is null)::integer - (old.left_at is null)::integer;
  end if;
  if delta <> 0 then update public.challenges set participant_count = greatest(0,participant_count + delta) where id = board; end if;
  return null;
end;
$$;
create trigger leaderboard_participant_count after insert or delete or update of left_at on public.challenge_participants
for each row execute function private.refresh_leaderboard_participant_count();
revoke all on function private.refresh_leaderboard_participant_count() from public,anon,authenticated;
create table private.daily_workout_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null, workout_count bigint not null check(workout_count >= 0),
  primary key(user_id,day)
);
alter table private.daily_workout_scores enable row level security;
revoke all on private.daily_workout_scores from public,anon,authenticated;
insert into private.daily_workout_scores(user_id,day,workout_count)
select user_id,(started_at at time zone 'UTC')::date,count(*) from public.workout_sessions where completed_at is not null group by 1,2;

-- This signal contains no score or friendship information. Each viewer sees only their row.
create table public.leaderboard_revisions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 0 check(revision >= 0)
);
alter table public.leaderboard_revisions enable row level security;
create policy leaderboard_revisions_own on public.leaderboard_revisions for select to authenticated using(user_id = auth.uid());
grant select on public.leaderboard_revisions to authenticated;
insert into public.leaderboard_revisions(user_id) select id from public.profiles;

create function private.bump_friends_leaderboards(p_users uuid[],p_include_unshared boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare viewer record;
begin
  for viewer in select id from public.profiles where id = any(p_users) or id in (
    select f.addressee_id from public.friendships f join public.profiles p on p.id = f.requester_id
      where f.status = 'accepted' and f.requester_id = any(p_users) and (p_include_unshared or p.share_friends_leaderboard)
    union select f.requester_id from public.friendships f join public.profiles p on p.id = f.addressee_id
      where f.status = 'accepted' and f.addressee_id = any(p_users) and (p_include_unshared or p.share_friends_leaderboard)) order by id loop
    insert into public.leaderboard_revisions(user_id,revision) values(viewer.id,1)
      on conflict(user_id) do update set revision = public.leaderboard_revisions.revision + 1;
  end loop;
end;
$$;
create function private.refresh_workout_leaderboard_score()
returns trigger language plpgsql security definer set search_path = '' as $$
declare previous_user uuid; next_user uuid; previous_day date; next_day date;
begin
  if tg_op <> 'INSERT' and old.completed_at is not null then previous_user := old.user_id; previous_day := (old.started_at at time zone 'UTC')::date; end if;
  if tg_op <> 'DELETE' and new.completed_at is not null then next_user := new.user_id; next_day := (new.started_at at time zone 'UTC')::date; end if;
  if previous_user is not distinct from next_user and previous_day is not distinct from next_day then return null; end if;
  if previous_user is not null then
    update private.daily_workout_scores set workout_count = greatest(0,workout_count-1) where user_id = previous_user and day = previous_day;
  end if;
  if next_user is not null then
    insert into private.daily_workout_scores values(next_user,next_day,1) on conflict(user_id,day)
      do update set workout_count = private.daily_workout_scores.workout_count + 1;
  end if;
  perform private.bump_friends_leaderboards(array[previous_user,next_user]);
  return null;
end;
$$;
create trigger workout_leaderboard_score after insert or update or delete on public.workout_sessions for each row execute function private.refresh_workout_leaderboard_score();

create function private.refresh_social_leaderboard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare affected uuid[] := '{}'; board record;
begin
  if tg_table_name = 'profiles' then
    if tg_op = 'INSERT' or old.share_friends_leaderboard is distinct from new.share_friends_leaderboard
      or old.display_name is distinct from new.display_name or old.username is distinct from new.username or old.avatar_url is distinct from new.avatar_url then
      perform private.bump_friends_leaderboards(array[new.id],true);
      -- Challenge podium/rows also need a new version when public identity changes.
      if tg_op = 'UPDATE' then
        for board in select c.id from public.challenges c join public.challenge_participants p on p.challenge_id = c.id
          where p.user_id = new.id and p.left_at is null order by c.id for update of c loop
          update public.challenges set leaderboard_version = leaderboard_version + 1 where id = board.id;
        end loop;
      end if;
    end if;
  else
    if tg_op <> 'INSERT' then affected := affected || array[old.requester_id,old.addressee_id]; end if;
    if tg_op <> 'DELETE' then affected := affected || array[new.requester_id,new.addressee_id]; end if;
    perform private.bump_friends_leaderboards(affected,true);
  end if;
  return null;
end;
$$;
create trigger profiles_leaderboard_signal after insert or update on public.profiles for each row execute function private.refresh_social_leaderboard();
create trigger friendships_leaderboard_signal after insert or update or delete on public.friendships for each row execute function private.refresh_social_leaderboard();

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
  update public.challenge_participants p set current_value = r.value,completed = r.value >= r.target_value,rank = r.place from ranked r where p.id = r.id
    and (p.current_value,p.completed,p.rank) is distinct from (r.value,r.value >= r.target_value,r.place);
  update public.challenge_participants set rank = null where challenge_id = p_challenge_id and left_at is not null and rank is not null;
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

create function public.get_friends_leaderboard(p_value numeric default null,p_user uuid default null,p_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); version text; last_day date := (now() at time zone 'UTC')::date; result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if (p_value is null) <> (p_user is null) or (p_value is not null and (p_value < 0 or p_value > 9007199254740991 or p_value <> trunc(p_value) or p_version is null)) then raise exception 'Invalid cursor' using errcode = '22023'; end if;
  select revision::text||':'||last_day::text into version from public.leaderboard_revisions where user_id = actor for share;
  if version is null then raise exception 'Profile unavailable' using errcode = '42501'; end if;
  if p_version is not null and p_version is distinct from version then raise exception 'Leaderboard changed' using errcode = '40001'; end if;
  with peer_ids as materialized (
    select actor as id union select addressee_id from public.friendships where requester_id = actor and status = 'accepted'
    union select requester_id from public.friendships where addressee_id = actor and status = 'accepted'
  ), peers as materialized (
    select p.id,p.display_name,p.username,p.avatar_url from peer_ids i join public.profiles p on p.id = i.id
    where p.id = actor or p.share_friends_leaderboard
  ), scores as materialized (
    select p.*,coalesce(sum(d.workout_count),0)::numeric as value from peers p left join private.daily_workout_scores d
      on d.user_id = p.id and d.day between last_day-29 and last_day group by p.id,p.display_name,p.username,p.avatar_url
  ), ranked as materialized (
    select id as user_id,display_name,username,avatar_url,value,dense_rank() over(order by value desc)::integer as rank from scores
  ) select jsonb_build_object('version',version,'title','Friends · last 30 UTC days','metric','workout_count','target',null,
    'sharing',(select share_friends_leaderboard from public.profiles where id = actor),
    'participant_count',(select count(*) from ranked),'me',(select to_jsonb(r) from ranked r where user_id = actor),
    'podium',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from (select * from ranked order by value desc,user_id limit 3) p),
    'entries',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from (
      select * from ranked where p_value is null or value < p_value or (value = p_value and user_id > p_user)
      order by value desc,user_id limit 21) p)) into result;
  return result;
end;
$$;

create function public.get_challenge_leaderboard(p_challenge uuid,p_value numeric default null,p_user uuid default null,p_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.challenges; result jsonb;
begin
  if auth.uid() is null or not private.can_view_challenge(p_challenge) then raise exception 'Challenge unavailable' using errcode = '42501'; end if;
  if (p_value is null) <> (p_user is null) or (p_value is not null and (p_value < 0 or p_value > 999999999999.99 or p_version is null)) then raise exception 'Invalid cursor' using errcode = '22023'; end if;
  select * into c from public.challenges where id = p_challenge for share;
  if not found then raise exception 'Challenge unavailable' using errcode = '42501'; end if;
  if p_version is not null and p_version is distinct from c.leaderboard_version::text then raise exception 'Leaderboard changed' using errcode = '40001'; end if;
  -- Existing per-challenge scores/ranks are cached by the server. No history scans.
  select jsonb_build_object('version',c.leaderboard_version::text,'title',c.title,'metric',c.metric_type,'target',c.target_value,'sharing',null,
    'participant_count',c.participant_count,
    'me',(select jsonb_build_object('user_id',p.user_id,'value',p.current_value,'rank',p.rank,'display_name',u.display_name,'username',u.username,'avatar_url',u.avatar_url)
      from public.challenge_participants p join public.public_profiles u on u.id = p.user_id where p.challenge_id = c.id and p.user_id = auth.uid() and p.left_at is null),
    'podium',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
      select p.user_id,p.current_value as value,p.rank,u.display_name,u.username,u.avatar_url from public.challenge_participants p
      join public.public_profiles u on u.id = p.user_id where p.challenge_id = c.id and p.left_at is null order by p.current_value desc,p.user_id limit 3) r),
    'entries',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
      select p.user_id,p.current_value as value,p.rank,u.display_name,u.username,u.avatar_url from public.challenge_participants p
      join public.public_profiles u on u.id = p.user_id where p.challenge_id = c.id and p.left_at is null
        and (p_value is null or p.current_value < p_value or (p.current_value = p_value and p.user_id > p_user))
      order by p.current_value desc,p.user_id limit 21) r)) into result;
  return result;
end;
$$;

create or replace function public.get_fitness_challenge(p_challenge uuid,p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid page' using errcode = '22023'; end if;
  return (select jsonb_build_object('challenge',to_jsonb(c),'creator',to_jsonb(creator),
    'exercise_name',(select name from public.exercises where id = c.exercise_id),
    'participant_count',c.participant_count,
    'membership',(select to_jsonb(p) from public.challenge_participants p where p.challenge_id = c.id and p.user_id = auth.uid()),
    'invited',exists(select 1 from public.challenge_invites where challenge_id = c.id and user_id = auth.uid() and status = 'pending'),
    'leaderboard',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
      select p.user_id,p.current_value,p.rank,p.completed,u.username,u.display_name,u.avatar_url from public.challenge_participants p
      join public.public_profiles u on u.id = p.user_id where p.challenge_id = c.id and p.left_at is null
      order by p.current_value desc,p.user_id limit 21 offset p_offset) r))
    from public.challenges c join public.public_profiles creator on creator.id = c.creator_id where c.id = p_challenge);
end;
$$;

revoke all on function private.bump_friends_leaderboards(uuid[],boolean),private.refresh_workout_leaderboard_score(),private.refresh_social_leaderboard() from public,anon,authenticated;
revoke all on function public.get_friends_leaderboard(numeric,uuid,text),public.get_challenge_leaderboard(uuid,numeric,uuid,text) from public,anon;
grant execute on function public.get_friends_leaderboard(numeric,uuid,text),public.get_challenge_leaderboard(uuid,numeric,uuid,text) to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leaderboard_revisions') then
    alter publication supabase_realtime add table public.leaderboard_revisions;
  end if;
end $$;
commit;
