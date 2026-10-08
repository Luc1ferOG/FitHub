-- Local migrated Supabase, postgres, ON_ERROR_STOP=1. All fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data)
select ('94000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'leaderboard-'||i||'@example.test',
  jsonb_build_object('username','lb_test_'||i,'display_name','Athlete '||i) from generate_series(1,44) i;
insert into public.friendships(requester_id,addressee_id,status)
select '94000000-0000-0000-0000-000000000001',('94000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
  case when i = 43 then 'pending'::public.friendship_status else 'accepted'::public.friendship_status end from generate_series(2,44) i;
update public.profiles set share_friends_leaderboard = true where username like 'lb_test_%' and username <> 'lb_test_44';
insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
select p.id,'Leaderboard fixture',now()-interval '2 hours',now()-interval '1 hour','synced'
from public.profiles p cross join generate_series(1,3) i where p.username like 'lb_test_%' and (p.username <> 'lb_test_1' or i < 3);
insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status)
values('94000000-0000-0000-0000-000000000002','Outside 30 day window',
  ((now() at time zone 'UTC')::date-30)::timestamp at time zone 'UTC',
  (((now() at time zone 'UTC')::date-30)::timestamp at time zone 'UTC')+interval '1 hour','synced');
do $$
declare actor uuid := '94000000-0000-0000-0000-000000000001'; hidden uuid := '94000000-0000-0000-0000-000000000044';
  first jsonb; second jsonb; cursor jsonb; revision_before bigint;
begin
  if has_function_privilege('anon','public.get_friends_leaderboard(numeric,uuid,text)','EXECUTE')
    or has_table_privilege('authenticated','private.daily_workout_scores','SELECT')
    or has_table_privilege('authenticated','public.leaderboard_revisions','UPDATE') then raise exception 'Unsafe leaderboard privileges'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  first := public.get_friends_leaderboard();
  if (first->>'participant_count')::integer <> 42 then raise exception 'Only me and opted-in accepted friends should appear'; end if;
  if (first->'me'->>'value')::integer <> 2 or (first->'me'->>'rank')::integer <> 2 then raise exception 'Current-user score/rank wrong'; end if;
  if (first->'entries'->0->>'value')::integer <> 3 or (first->'entries'->0->>'rank')::integer <> 1 then raise exception 'Ties or date-window calculation incorrect'; end if;
  if (first->'entries'->0->>'user_id') <> '94000000-0000-0000-0000-000000000002' then raise exception 'Tied ordering unstable'; end if;
  cursor := first->'entries'->19;
  second := public.get_friends_leaderboard((cursor->>'value')::numeric,(cursor->>'user_id')::uuid,first->>'version');
  if jsonb_array_length(second->'entries') <> 21 or second->'entries'->0->>'user_id' <> '94000000-0000-0000-0000-000000000022' then raise exception 'Tie spanning pages skipped or repeated users'; end if;
  -- An unshared workout must not even emit a timing signal to its friends.
  select revision into revision_before from public.leaderboard_revisions where user_id = actor;
  insert into public.workout_sessions(user_id,name,started_at,completed_at,sync_status) values(hidden,'Unshared',now()-interval '2 hours',now()-interval '1 hour','synced');
  if (select revision from public.leaderboard_revisions where user_id = actor) <> revision_before then raise exception 'Unshared workout leaked a revision signal'; end if;
  update public.profiles set share_friends_leaderboard = false where id = '94000000-0000-0000-0000-000000000002';
  begin perform public.get_friends_leaderboard((cursor->>'value')::numeric,(cursor->>'user_id')::uuid,first->>'version'); raise exception 'Stale cursor accepted'; exception when sqlstate '40001' then null; end;
  first := public.get_friends_leaderboard();
  if (first->>'participant_count')::integer <> 41 then raise exception 'Opt-out failed'; end if;
  delete from public.friendships where requester_id = actor and addressee_id = '94000000-0000-0000-0000-000000000003';
  if (public.get_friends_leaderboard()->>'participant_count')::integer <> 40 then raise exception 'Removed friend remained ranked'; end if;
end;
$$;
insert into public.challenges(id,creator_id,title,metric_type,target_value,start_date,end_date,visibility,status)
values('74000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','Leaderboard ties','workout_count',20,current_date,current_date+1,'private','active');
insert into public.challenge_participants(challenge_id,user_id)
select '74000000-0000-0000-0000-000000000001',('94000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(2,23) i;
insert into public.challenge_progress(challenge_id,user_id,value)
select challenge_id,user_id,15 from public.challenge_participants where challenge_id = '74000000-0000-0000-0000-000000000001' and user_id <> '94000000-0000-0000-0000-000000000001';
do $$
declare board uuid := '74000000-0000-0000-0000-000000000001'; first jsonb; second jsonb; cursor jsonb;
begin
  first := public.get_challenge_leaderboard(board);
  if (first->>'participant_count')::integer <> 23 then raise exception 'Cached challenge participant count incorrect'; end if;
  if jsonb_array_length(first->'podium') <> 3 or exists(select 1 from jsonb_array_elements(first->'podium') p where (p->>'rank')::integer <> 1) then raise exception 'Podium invented distinct ranks for ties'; end if;
  cursor := first->'entries'->19;
  second := public.get_challenge_leaderboard(board,(cursor->>'value')::numeric,(cursor->>'user_id')::uuid,first->>'version');
  if jsonb_array_length(second->'entries') <> 3 then raise exception 'Challenge keyset pagination failed'; end if;
  insert into public.challenge_progress(challenge_id,user_id,value) values(board,auth.uid(),16);
  begin perform public.get_challenge_leaderboard(board,(cursor->>'value')::numeric,(cursor->>'user_id')::uuid,first->>'version'); raise exception 'Old challenge cursor accepted'; exception when sqlstate '40001' then null; end;
  if (public.get_challenge_leaderboard(board)->'me'->>'rank')::integer <> 1 then raise exception 'Challenge rank did not update'; end if;
  perform set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000044',true);
  begin perform public.get_challenge_leaderboard(board); raise exception 'Private leaderboard leaked'; exception when sqlstate '42501' then null; end;
end;
$$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.leaderboard_revisions where user_id <> auth.uid()) then raise exception 'Another viewer signal leaked'; end if;
  begin update public.profiles set share_friends_leaderboard = false where id = '94000000-0000-0000-0000-000000000001'; exception when sqlstate '42501' then null; end;
end $$;
reset role;
do $$ begin
  if not (select share_friends_leaderboard from public.profiles where id = '94000000-0000-0000-0000-000000000001') then raise exception 'Own consent unexpectedly changed'; end if;
end $$;
rollback;
