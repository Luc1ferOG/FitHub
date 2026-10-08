-- Run as postgres on migrated/seeded local Supabase with ON_ERROR_STOP=1. Rollback-only.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('92000000-0000-0000-0000-000000000001','challenge-a@example.test','{"username":"challenge_test_a"}'),
('92000000-0000-0000-0000-000000000002','challenge-b@example.test','{"username":"challenge_test_b"}'),
('92000000-0000-0000-0000-000000000003','challenge-c@example.test','{"username":"challenge_test_c"}');
insert into public.friendships(requester_id,addressee_id,status) values('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002','accepted');
insert into public.challenges(id,creator_id,title,metric_type,target_value,start_date,end_date,visibility,status,exercise_id) values
('72000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','Count','workout_count',1,(now() at time zone 'UTC')::date-1,(now() at time zone 'UTC')::date+1,'public','active',null),
('72000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','Volume','volume_kg',500,(now() at time zone 'UTC')::date-1,(now() at time zone 'UTC')::date+1,'public','active',null),
('72000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000001','Pushups','repetitions',20,(now() at time zone 'UTC')::date-1,(now() at time zone 'UTC')::date+1,'public','active','10000000-0000-0000-0000-000000000006'),
('72000000-0000-0000-0000-000000000004','92000000-0000-0000-0000-000000000001','Minutes','duration_seconds',1800,(now() at time zone 'UTC')::date-1,(now() at time zone 'UTC')::date+1,'public','active',null),
('72000000-0000-0000-0000-000000000005','92000000-0000-0000-0000-000000000001','Invitation','workout_count',12,(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date+1,'private','active',null),
('72000000-0000-0000-0000-000000000006','92000000-0000-0000-0000-000000000001','Friends','workout_count',12,(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date+1,'friends','active',null),
('72000000-0000-0000-0000-000000000007','92000000-0000-0000-0000-000000000001','Ending','workout_count',12,(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date,'public','active',null);
do $$
declare a uuid := '92000000-0000-0000-0000-000000000001'; b uuid := '92000000-0000-0000-0000-000000000002'; outsider uuid := '92000000-0000-0000-0000-000000000003';
  count_challenge uuid := '72000000-0000-0000-0000-000000000001'; session uuid := gen_random_uuid(); unqualified uuid; payload jsonb; first jsonb; second jsonb; notifications_before bigint;
begin
  if has_column_privilege('authenticated','public.challenge_participants','user_id','INSERT')
    or has_table_privilege('authenticated','public.challenge_participants','DELETE')
    or has_column_privilege('authenticated','public.challenges','target_value','UPDATE')
    or has_function_privilege('authenticated','public.record_challenge_progress(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.run_challenge_deadlines()','EXECUTE')
    or has_function_privilege('authenticated','public.claim_challenge_push_jobs()','EXECUTE') then raise exception 'Unsafe challenge grants'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000006','join'); raise exception 'Nonfriend joined friends challenge'; exception when sqlstate '42501' then null; end;
  begin perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000005','accept'); raise exception 'Uninvited join succeeded'; exception when sqlstate '42501' then null; end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000005','invite',b);
  perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000005','invite',b);
  if (select count(*) from public.challenge_invites where user_id = b) <> 1 then raise exception 'Duplicate invites'; end if;
  if (select count(*) from public.notifications where user_id = b and data->>'kind' = 'invite') <> 1 then raise exception 'Duplicate invite notification'; end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000005','accept');
  perform public.manage_challenge_membership(count_challenge,'join');
  perform public.manage_challenge_membership(count_challenge,'join');
  if (select count(*) from public.challenge_participants where challenge_id = count_challenge and user_id = b) <> 1 then raise exception 'Duplicate member'; end if;
  if exists(select 1 from public.challenge_participants where challenge_id = count_challenge and rank <> 1) then raise exception 'Equal scores must share rank'; end if;
  perform public.manage_challenge_membership('72000000-0000-0000-0000-000000000006','join');
  if (select count(*) from public.notifications where user_id = a and data->>'kind' = 'friend_joined') <> 3 then raise exception 'Friend join notifications missing'; end if;
  -- Fixtures explicitly predate the workout, matching real join-before-start eligibility.
  update public.challenge_participants set joined_at = now()-interval '1 day' where user_id in (a,b);
  perform set_config('request.jwt.claim.sub',a::text,true);
  payload := jsonb_build_object('workoutId',null,'name','Automatic scoring','notes','',
    'startedAt',now()-interval '32 minutes','completedAt',now()-interval '2 minutes','exercises',jsonb_build_array(
      jsonb_build_object('id',gen_random_uuid(),'exerciseId','10000000-0000-0000-0000-000000000006','name','Push-Up','notes','','skipped',false,'targetSets',1,'targetReps',20,'restSeconds',60,
        'sets',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'weight',0,'reps',20,'completed',true,'completedAt',now()-interval '3 minutes'))),
      jsonb_build_object('id',gen_random_uuid(),'exerciseId','10000000-0000-0000-0000-000000000001','name','Squat','notes','','skipped',false,'targetSets',1,'targetReps',10,'restSeconds',60,
        'sets',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'weight',50,'reps',10,'completed',true,'completedAt',now()-interval '2 minutes')))));
  first := public.sync_workout_session(a,session,payload); second := public.sync_workout_session(a,session,payload);
  if first is distinct from second then raise exception 'Replay receipt changed'; end if;
  if (select count(*) from public.challenge_progress where workout_session_id = session and challenge_id in
    ('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000003','72000000-0000-0000-0000-000000000004')) <> 4 then raise exception 'Automatic metrics missing or duplicated'; end if;
  if (select current_value from public.challenge_participants where challenge_id = '72000000-0000-0000-0000-000000000002' and user_id = a) <> 500
    or (select current_value from public.challenge_participants where challenge_id = '72000000-0000-0000-0000-000000000003' and user_id = a) <> 20
    or (select current_value from public.challenge_participants where challenge_id = '72000000-0000-0000-0000-000000000004' and user_id = a) <> 1800 then raise exception 'Metric calculations incorrect'; end if;
  if not exists(select 1 from public.notifications where user_id = b and data->>'kind' = 'rank_passed') then raise exception 'Pass notification missing'; end if;
  if (select rank from public.challenge_participants where challenge_id = count_challenge and user_id = a) <> 1
    or (select rank from public.challenge_participants where challenge_id = count_challenge and user_id = b) <> 2 then raise exception 'Progress ranks incorrect'; end if;
  if not exists(select 1 from public.notifications where user_id = a and data->>'kind' = 'completed') then raise exception 'Goal notification missing'; end if;
  perform public.manage_challenge_membership(count_challenge,'leave');
  if (select rank from public.challenge_participants where challenge_id = count_challenge and user_id = a) is not null then raise exception 'Left member still ranked'; end if;
  perform public.manage_challenge_membership(count_challenge,'join');
  perform public.record_challenge_progress(count_challenge,session);
  if (select current_value from public.challenge_participants where challenge_id = count_challenge and user_id = a) <> 1 then raise exception 'Rejoin double counted'; end if;
  -- New sessions before rejoining and outside the date interval cannot add progress.
  unqualified := gen_random_uuid();
  insert into public.workout_sessions(id,user_id,name,started_at,completed_at,sync_status) values(unqualified,a,'Prejoin',now()-interval '3 minutes',now()-interval '2 minutes','synced');
  perform public.record_challenge_progress(count_challenge,unqualified);
  if exists(select 1 from public.challenge_progress where workout_session_id = unqualified) then raise exception 'Prejoin workout counted'; end if;
  unqualified := gen_random_uuid();
  insert into public.workout_sessions(id,user_id,name,started_at,completed_at,sync_status) values(unqualified,a,'Outside dates',now()-interval '3 days',now()-interval '2 days','synced');
  perform public.record_challenge_progress('72000000-0000-0000-0000-000000000002',unqualified);
  if exists(select 1 from public.challenge_progress where workout_session_id = unqualified) then raise exception 'Outside dates counted'; end if;
  select count(*) into notifications_before from public.notifications where data->>'kind' = 'ending_soon';
  perform public.run_challenge_deadlines(); perform public.run_challenge_deadlines();
  if (select count(*) from public.notifications where data->>'kind' = 'ending_soon') - notifications_before <> 1 then raise exception 'Ending notification not exactly once'; end if;
end;
$$;
-- Real role RLS: outsiders cannot see invite-only challenges or others' workout evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000003',true);
do $$ begin
  if public.get_fitness_challenge('72000000-0000-0000-0000-000000000005') is not null then raise exception 'Private challenge leak'; end if;
  if exists(select 1 from public.challenge_progress where user_id <> auth.uid()) then raise exception 'Private workout evidence leak'; end if;
  if jsonb_array_length(public.list_fitness_challenges('invites',0)) <> 0 then raise exception 'Other user invitation leak'; end if;
end $$;
rollback;
