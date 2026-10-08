-- Rollback-only. Run as postgres on migrated/seeded local Supabase with ON_ERROR_STOP=1.
-- This exercises the actual SQL evaluator at below/exact/above for every active definition.
begin;
do $$
declare badge record; delta integer; value numeric; actor uuid; session uuid; exercise uuid;
  source uuid; i integer; awarded boolean; before_count bigint; notification_count bigint;
begin
  if (select count(*) from public.achievements where is_active) <> 17 then raise exception 'Expected 17 active achievements'; end if;
  for badge in select * from public.achievements where is_active order by code loop
    for delta in -1..1 loop
      value:=badge.requirement_value+delta; actor:=gen_random_uuid();
      insert into auth.users(id,email,raw_user_meta_data)
      values(actor,actor||'@achievement.test',jsonb_build_object('username','ach_'||left(replace(actor::text,'-',''),20)));
      case badge.requirement_type
      when 'workout_count' then
        insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
        select actor,'Count fixture',now()-interval '1 hour',now(),'synced' from generate_series(1,value::integer);
      when 'total_volume' then
        -- Trusted admin fixture: normal session sync derives this total from completed sets.
        insert into public.workout_sessions(user_id,name,started_at,completed_at,total_volume,sync_status)
        values(actor,'Volume fixture',now()-interval '1 hour',now(),value,'synced');
      when 'streak_days' then
        -- Insert reverse chronological; duplicates and a separated day must not extend the streak.
        insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
        select actor,'Streak fixture',(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-make_interval(days=>n),
          (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-make_interval(days=>n)+interval '1 hour','synced'
        from generate_series(1,value::integer) n;
        insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
        values(actor,'Duplicate date',(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-interval '1 day',
          (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-interval '1 day'+interval '1 hour','synced'),
          (actor,'Separated day',(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-make_interval(days=>value::integer+3),
          (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')-make_interval(days=>value::integer+3)+interval '1 hour','synced');
      when 'personal_records' then
        insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
          values(actor,'PR fixture',now()-interval '1 hour',now(),'synced') returning id into session;
        insert into public.workout_session_exercises(session_id,exercise_id,order_index)
          values(session,'10000000-0000-0000-0000-000000000001',0) returning id into exercise;
        insert into public.workout_sets(session_exercise_id,set_number,reps,weight,completed,is_personal_record)
          select exercise,n,1,n,true,true from generate_series(1,value::integer) n;
        -- An incomplete PR flag must never count.
        insert into public.workout_sets(session_exercise_id,set_number,reps,weight,completed,is_personal_record)
          values(exercise,100,1,100,false,true);
      else
        for i in 1..value::integer loop
          source:=gen_random_uuid();
          perform private.emit_achievement_event(actor,case badge.requirement_type
            when 'friend_count' then 'FriendAdded' when 'challenges_joined' then 'ChallengeJoined'
            when 'challenges_completed' then 'ChallengeCompleted' when 'challenge_wins' then 'ChallengeWon' end,
            source,badge.requirement_type||':'||source);
        end loop;
      end case;
      perform private.evaluate_achievements(actor);
      select exists(select 1 from public.user_achievements where user_id=actor and achievement_id=badge.id) into awarded;
      if awarded is distinct from (delta>=0) then raise exception 'Wrong threshold for %, delta %',badge.code,delta; end if;
      if exists(select 1 from public.user_achievements where user_id=actor and presented_at is not null) then raise exception 'New award already acknowledged'; end if;
      select count(*) into before_count from public.user_achievements where user_id=actor;
      perform private.evaluate_achievements(actor);
      if (select count(*) from public.user_achievements where user_id=actor) <> before_count then raise exception 'Duplicate award'; end if;
      select count(*) into notification_count from public.notifications where user_id=actor and type='achievement_unlocked';
      if notification_count<>before_count then raise exception 'Missing or duplicated unlock notification'; end if;
      if exists(select 1 from public.user_achievements ua join public.achievements a on a.id=ua.achievement_id where ua.user_id=actor and not a.is_active) then raise exception 'Retired badge newly awarded'; end if;
    end loop;
  end loop;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
('97000000-0000-0000-0000-000000000001','achievement-owner@example.test','{"username":"achievement_owner"}'),
('97000000-0000-0000-0000-000000000002','achievement-other@example.test','{"username":"achievement_other"}'),
('97000000-0000-0000-0000-000000000003','achievement-third@example.test','{"username":"achievement_third"}');
insert into auth.users(id,email,raw_user_meta_data) values
('97000000-0000-0000-0000-000000000004','achievement-sync@example.test','{"username":"achievement_sync"}');
do $$
declare actor uuid:='97000000-0000-0000-0000-000000000004'; session uuid:=gen_random_uuid();
  payload jsonb; first jsonb; repeated jsonb;
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  payload:=jsonb_build_object('workoutId',null,'name','Achievement sync','notes','',
    'startedAt',now()-interval '1 hour','completedAt',now()-interval '1 minute','exercises',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'exerciseId','10000000-0000-0000-0000-000000000001',
        'name','Squat','notes','','skipped',false,'targetSets',1,'targetReps',10,'restSeconds',60,'sets',jsonb_build_array(
          jsonb_build_object('id',gen_random_uuid(),'weight',10,'reps',10,'completed',true,'completedAt',now()-interval '2 minutes')))));
  first:=public.sync_workout_session(actor,session,payload); repeated:=public.sync_workout_session(actor,session,payload);
  if first is distinct from repeated then raise exception 'Replay receipt changed'; end if;
  if (select count(*) from public.achievement_events where user_id=actor and event_type='WorkoutCompleted')<>1
    or (select count(*) from public.achievement_events where user_id=actor and event_type='PersonalRecordCreated')<>1 then raise exception 'Missing or duplicate workout/PR events'; end if;
  if not exists(select 1 from jsonb_array_elements(first->'achievements') a where a->>'code'='FIRST_WORKOUT')
    or not exists(select 1 from jsonb_array_elements(first->'achievements') a where a->>'code'='FIRST_PR') then raise exception 'Central awards missing from workout receipt'; end if;
end $$;
-- FriendAdded persists after removal, and processing twice never duplicates the badge.
insert into public.friendships(requester_id,addressee_id,status)
values('97000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000002','accepted');
delete from public.friendships where requester_id='97000000-0000-0000-0000-000000000001';
select public.run_achievement_events();
select public.run_achievement_events();
-- Challenge events count distinct challenges; qualified rank-one ties co-win after grace.
insert into public.challenges(id,creator_id,title,metric_type,target_value,start_date,end_date,status) values
('77000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001','Finalized tie','workout_count',1,(now() at time zone 'UTC')::date-20,(now() at time zone 'UTC')::date-8,'completed'),
('77000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000001','Grace window','workout_count',1,(now() at time zone 'UTC')::date-20,(now() at time zone 'UTC')::date-7,'completed');
insert into public.challenge_participants(challenge_id,user_id,current_value,completed,rank) values
('77000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001',1,true,1),
('77000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000002',1,true,1),
('77000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000003',0,false,2),
('77000000-0000-0000-0000-000000000002','97000000-0000-0000-0000-000000000003',1,true,1);
update public.challenge_participants set completed=true where challenge_id='77000000-0000-0000-0000-000000000001' and completed;
select public.finalize_achievement_challenges();
select public.finalize_achievement_challenges();
select public.run_achievement_events();
do $$ begin
  if (select count(*) from public.achievement_events where source_id='77000000-0000-0000-0000-000000000001' and event_type='ChallengeWon')<>2 then raise exception 'Qualified ties did not co-win or duplicated'; end if;
  if exists(select 1 from public.achievement_events where source_id='77000000-0000-0000-0000-000000000002' and event_type='ChallengeWon') then raise exception 'Win awarded before offline grace ended'; end if;
  if (select count(*) from public.achievement_events where source_id='77000000-0000-0000-0000-000000000001' and event_type='ChallengeCompleted')<>2 then raise exception 'Completion duplicated'; end if;
end $$;
-- A post-finalization departure must not manufacture a different winner.
update public.challenge_participants set left_at=now() where challenge_id='77000000-0000-0000-0000-000000000001' and completed;
update public.challenge_participants set rank=1,completed=true where challenge_id='77000000-0000-0000-0000-000000000001' and user_id='97000000-0000-0000-0000-000000000003';
select public.finalize_achievement_challenges();
do $$ begin
  if exists(select 1 from public.achievement_events where user_id='97000000-0000-0000-0000-000000000003' and event_type='ChallengeWon') then raise exception 'Final winner snapshot changed'; end if;
end $$;

select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
declare board jsonb; acknowledged timestamptz;
begin
  perform public.reconcile_achievements(auth.uid()); board:=public.get_my_achievements(auth.uid());
  if jsonb_array_length(board->'entries')<>17 then raise exception 'Catalog missing'; end if;
  if exists(select 1 from public.achievement_events where user_id<>auth.uid()) or exists(select 1 from public.achievement_metrics where user_id<>auth.uid()) then raise exception 'Foreign facts leaked'; end if;
  perform public.acknowledge_achievement(auth.uid(),'20000000-0000-0000-0000-000000000006');
  select presented_at into acknowledged from public.user_achievements where user_id=auth.uid() and achievement_id='20000000-0000-0000-0000-000000000006';
  perform public.acknowledge_achievement(auth.uid(),'20000000-0000-0000-0000-000000000006');
  if acknowledged is null or acknowledged<>(select presented_at from public.user_achievements where user_id=auth.uid() and achievement_id='20000000-0000-0000-0000-000000000006') then raise exception 'Acknowledgment not idempotent'; end if;
  begin perform public.reconcile_achievements('97000000-0000-0000-0000-000000000002'); raise exception 'Foreign reconcile allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_my_achievements('97000000-0000-0000-0000-000000000002'); raise exception 'Foreign board allowed'; exception when insufficient_privilege then null; end;
  begin perform public.acknowledge_achievement('97000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000006'); raise exception 'Foreign acknowledgment allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.user_achievements(user_id,achievement_id) values(auth.uid(),'20000000-0000-0000-0000-000000000008'); raise exception 'Direct unlock allowed'; exception when insufficient_privilege then null; end;
  begin perform public.run_achievement_events(); raise exception 'Client worker allowed'; exception when insufficient_privilege then null; end;
  begin perform public.finalize_achievement_challenges(); raise exception 'Client finalization allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.achievement_events(user_id,event_key,event_type,source_id) values(auth.uid(),'forged','FriendAdded',gen_random_uuid()); raise exception 'Forged fact allowed'; exception when insufficient_privilege then null; end;
  begin update public.achievement_metrics set progress='{"total_volume":1000000}' where user_id=auth.uid(); raise exception 'Forged metric allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id='97000000-0000-0000-0000-000000000003';
do $$ begin
  if exists(select 1 from public.achievement_events where user_id='97000000-0000-0000-0000-000000000003') then raise exception 'Deleted account facts retained'; end if;
end $$;
rollback;
