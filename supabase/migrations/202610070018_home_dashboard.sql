begin;

create index dashboard_completed_sessions_idx on public.workout_sessions(user_id,completed_at desc,id)
  where completed_at is not null and sync_status = 'synced';
create index dashboard_templates_idx on public.workouts(owner_id,updated_at desc,id);
create index dashboard_achievements_idx on public.user_achievements(user_id,unlocked_at desc,id);
create index dashboard_memberships_idx on public.challenge_participants(user_id,challenge_id) where left_at is null;

-- One snapshot, no caller-supplied identity. The only cross-user data is the same
-- public achievement information exposed by get_social_profile, for accepted friends.
create function public.get_home_dashboard(p_timezone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); local_day date; day_start timestamptz;
  day_end timestamptz; week_start timestamptz; utc_day date := (now() at time zone 'UTC')::date;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception 'Invalid time zone' using errcode = '22023';
  end if;
  local_day := (now() at time zone p_timezone)::date;
  day_start := local_day::timestamp at time zone p_timezone;
  day_end := (local_day+1)::timestamp at time zone p_timezone;
  week_start := date_trunc('week',local_day::timestamp) at time zone p_timezone;
  return (
    with eligible as (
      select c.id,c.title,c.target_value,c.metric_type,c.end_date,p.current_value
      from public.challenge_participants p join public.challenges c on c.id=p.challenge_id
      where p.user_id=actor and p.left_at is null and c.status='active'
        and c.start_date<=utc_day and c.end_date>=utc_day and private.can_view_challenge(c.id)
    ), recent_sessions as (
      select id,name,completed_at from public.workout_sessions
      where user_id=actor and completed_at is not null and sync_status='synced'
      order by completed_at desc,id limit 5
    ), friends as (
      select case when requester_id=actor then addressee_id else requester_id end as id
      from public.friendships where status='accepted' and actor in(requester_id,addressee_id)
    ), friend_awards as (
      select u.id,u.user_id,u.unlocked_at,a.title,p.display_name from friends f
      join public.user_achievements u on u.user_id=f.id
      join public.achievements a on a.id=u.achievement_id
      join public.public_profiles p on p.id=f.id
      order by u.unlocked_at desc,u.id limit 5
    ), challenge_updates as (
      select id,title,message,created_at from public.notifications
      where user_id=actor and type in('challenge_invite','challenge_update')
      order by created_at desc,id limit 5
    ), activity as (
      select 'workout:'||id as id,'workout' as kind,'Workout completed: '||name as title,
        'Saved to your workout history' as detail,completed_at as occurred_at,null::uuid as user_id from recent_sessions
      union all
      select 'award:'||id,'friend_achievement',display_name||' unlocked '||title,
        'Friend achievement',unlocked_at,user_id from friend_awards
      union all
      select 'notification:'||id,'challenge_update',title,message,created_at,null::uuid from challenge_updates
    )
    select jsonb_build_object(
      'generatedAt',now(),'localDay',local_day,
      'profile',(select jsonb_build_object('displayName',display_name,'units',preferred_units) from public.profiles where id=actor),
      'today',(select jsonb_build_object('workouts',count(*)) from public.workout_sessions
        where user_id=actor and sync_status='synced' and completed_at>=day_start and completed_at<day_end),
      'week',(select jsonb_build_object('workouts',count(*),'durationSeconds',coalesce(sum(duration_seconds),0),'volumeKg',coalesce(sum(total_volume),0))
        from public.workout_sessions where user_id=actor and sync_status='synced' and completed_at>=week_start and completed_at<day_end),
      'activeChallengeCount',(select count(*) from eligible),
      'templates',(select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id),'[]'::jsonb) from (
        select id,name,estimated_duration,updated_at from public.workouts where owner_id=actor order by updated_at desc,id limit 3) t),
      'challenges',(select coalesce(jsonb_agg(to_jsonb(c) order by c.end_date,c.id),'[]'::jsonb) from (
        select * from eligible order by end_date,id limit 3) c),
      'latestAchievement',(select jsonb_build_object('title',a.title,'description',a.description,'unlockedAt',u.unlocked_at)
        from public.user_achievements u join public.achievements a on a.id=u.achievement_id
        where u.user_id=actor order by u.unlocked_at desc,u.id limit 1),
      'activity',(select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at desc,r.id),'[]'::jsonb)
        from(select * from activity order by occurred_at desc,id limit 8) r)
    )
  );
end;
$$;
revoke all on function public.get_home_dashboard(text) from public,anon;
grant execute on function public.get_home_dashboard(text) to authenticated;
commit;
