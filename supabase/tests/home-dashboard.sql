-- Run as postgres on migrated/seeded local Supabase with ON_ERROR_STOP=1.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('96000000-0000-0000-0000-000000000001','dashboard1@test.invalid','{"username":"dashboard_owner","display_name":"Alex"}'),
('96000000-0000-0000-0000-000000000002','dashboard2@test.invalid','{"username":"dashboard_other"}');
insert into public.workout_sessions(user_id,name,started_at,completed_at,duration_seconds,total_volume,sync_status) values
('96000000-0000-0000-0000-000000000001','Owner completed',date_trunc('day',now())-interval '1 hour',date_trunc('day',now()),3600,1000,'synced'),
('96000000-0000-0000-0000-000000000001','Pending',date_trunc('day',now())-interval '1 hour',date_trunc('day',now()),3600,999999,'pending'),
('96000000-0000-0000-0000-000000000002','Private other history',date_trunc('day',now())-interval '1 hour',date_trunc('day',now()),3600,999999,'synced');
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
do $$
declare result jsonb;
begin
  result:=public.get_home_dashboard(current_setting('TimeZone'));
  if (result->'today'->>'workouts')::integer<>1 then raise exception 'Wrong daily count'; end if;
  if (result->'week'->>'volumeKg')::numeric<>1000 then raise exception 'Unconfirmed or foreign volume leaked'; end if;
  if result::text like '%Private other history%' or result::text like '%Pending%' then raise exception 'Private history leaked'; end if;
  if jsonb_array_length(result->'activity')<>1 then raise exception 'Wrong activity count'; end if;
  begin
    perform public.get_home_dashboard('invalid/timezone'); raise exception 'Accepted invalid timezone';
  exception when invalid_parameter_value then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.get_home_dashboard('UTC'); raise exception 'Accepted anonymous identity';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
