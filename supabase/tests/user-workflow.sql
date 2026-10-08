-- Execute as postgres against migrated, seeded LOCAL Supabase, with ON_ERROR_STOP=1.
-- Auth fixture insertion verifies profile automation, not the external Auth HTTP service.
-- All application writes below use the real authenticated role. Everything rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('99000000-0000-0000-0000-000000000011','journey-a@example.test','{"username":"journey_a","display_name":"Journey A"}'),
 ('99000000-0000-0000-0000-000000000012','journey-b@example.test','{"username":"journey_b","display_name":"Journey B"}');
do $$ begin
  if not exists(select 1 from public.profiles where id='99000000-0000-0000-0000-000000000011'
    and username='journey_a' and display_name='Journey A' and preferred_units='metric' and experience_level='beginner') then
    raise exception 'Auth profile initialization/defaults failed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000011',true);
do $$
declare template uuid; challenge uuid; friendship jsonb; version timestamptz;
  exercises jsonb := '[{"exercise_id":"10000000-0000-0000-0000-000000000001","target_sets":2,"target_reps":10,"target_weight":20,"rest_seconds":60,"notes":""}]';
begin
  template := public.save_workout(null,null,'Journey strength','',false,1800,exercises);
  select updated_at into version from public.workouts where id=template;
  perform public.save_workout(template,version,'Journey edited','',false,1800,jsonb_set(exercises,'{0,target_reps}','12'));
  if not exists(select 1 from public.workout_exercises where workout_id=template and target_reps=12) then raise exception 'Edit lost exercise config'; end if;
  challenge := public.create_fitness_challenge(jsonb_build_object('title','Journey count','description','','metric','workout_count','target',1,
    'startDate',(now() at time zone 'UTC')::date,'endDate',(now() at time zone 'UTC')::date+1,'visibility','public','exerciseId',null));
  friendship := public.change_friendship('99000000-0000-0000-0000-000000000012','send');
  insert into public.body_measurements(user_id,recorded_at,weight_kg,waist_cm) values(auth.uid(),date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',80,85);
  perform set_config('test.journey',jsonb_build_object('template',template,'challenge',challenge,'friendship',friendship->>'id')::text,true);
end $$;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000012',true);
do $$ declare fixture jsonb := current_setting('test.journey')::jsonb; begin
  perform public.change_friendship('99000000-0000-0000-0000-000000000011','accept',(fixture->>'friendship')::uuid);
  perform public.manage_challenge_membership((fixture->>'challenge')::uuid,'join');
  perform public.manage_challenge_membership((fixture->>'challenge')::uuid,'join');
  if exists(select 1 from public.body_measurements where user_id <> auth.uid()) then raise exception 'Measurement privacy leak'; end if;
end $$;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000011',true);
do $$
declare fixture jsonb := current_setting('test.journey')::jsonb; session uuid := gen_random_uuid(); payload jsonb; first jsonb; replay jsonb;
begin
  -- Same-transaction timestamps exercise inclusive eligibility, including zero-duration workouts.
  payload := jsonb_build_object('workoutId',fixture->>'template','name','Journey edited','notes','Full workflow',
    'startedAt',now(),'completedAt',now(),'exercises',jsonb_build_array(jsonb_build_object(
      'id',gen_random_uuid(),'exerciseId','10000000-0000-0000-0000-000000000001','name','Back Squat','notes','','skipped',false,'targetSets',2,'targetReps',12,'restSeconds',60,
      'sets',jsonb_build_array(
        jsonb_build_object('id',gen_random_uuid(),'weight',20,'reps',12,'completed',true,'completedAt',now()),
        jsonb_build_object('id',gen_random_uuid(),'weight',20,'reps',12,'completed',true,'completedAt',now())))));
  first := public.sync_workout_session(auth.uid(),session,payload);
  replay := public.sync_workout_session(auth.uid(),session,payload);
  if first is distinct from replay then raise exception 'Replay changed authoritative receipt'; end if;
  if not exists(select 1 from public.workout_sessions where id=session and total_volume=480 and completed_at is not null) then raise exception 'Saved workout totals incorrect'; end if;
  if (select count(*) from public.challenge_progress where workout_session_id=session) <> 1 then raise exception 'Challenge scoring missing or duplicated'; end if;
  if not exists(select 1 from public.challenge_participants where challenge_id=(fixture->>'challenge')::uuid and user_id=auth.uid() and current_value=1 and completed and rank=1) then raise exception 'Automatic progress/rank did not update'; end if;
  if (select count(*) from public.user_achievements ua join public.achievements a on a.id=ua.achievement_id where ua.user_id=auth.uid() and a.code='FIRST_WORKOUT') <> 1 then raise exception 'First workout award missing or duplicated'; end if;
end $$;
rollback;
