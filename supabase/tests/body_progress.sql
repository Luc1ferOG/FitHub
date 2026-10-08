-- Run against migrated local Supabase as postgres, with ON_ERROR_STOP=1.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('95000000-0000-0000-0000-000000000001','progress-owner@example.test','{"username":"progress_owner","display_name":"Owner"}'),
  ('95000000-0000-0000-0000-000000000002','progress-other@example.test','{"username":"progress_other","display_name":"Other"}');
insert into public.body_measurements(user_id,recorded_at,weight_kg,waist_cm) values
  ('95000000-0000-0000-0000-000000000001',now()-interval '60 days',80,90),
  ('95000000-0000-0000-0000-000000000001',now()-interval '1 day',78,null),
  ('95000000-0000-0000-0000-000000000001',now(),null,88),
  ('95000000-0000-0000-0000-000000000002',now(),100,100);
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$
declare dashboard jsonb; affected integer;
begin
  dashboard := public.get_body_progress('30d');
  if (dashboard->>'count')::int <> 3 then raise exception 'Other user data leaked'; end if;
  if (dashboard->'summaries'->'weightKg'->>'latest')::numeric <> 78 or
    (dashboard->'summaries'->'weightKg'->>'previous')::numeric <> 80 or
    (dashboard->'summaries'->'waistCm'->>'latest')::numeric <> 88 or
    (dashboard->'summaries'->'waistCm'->>'previous')::numeric <> 90 then raise exception 'Non-empty metric comparisons wrong'; end if;
  if jsonb_array_length(dashboard->'points') <> 2 then raise exception 'Period eligibility wrong'; end if;
  if jsonb_array_length(public.get_body_progress('all')->'points') <> 3 then raise exception 'All time excludes historical points'; end if;
  update public.body_measurements set weight_kg = 101 where user_id = '95000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user measurement modified'; end if;
  delete from public.body_measurements where user_id = '95000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user measurement deleted'; end if;
  begin
    insert into public.body_measurements(user_id,weight_kg) values('95000000-0000-0000-0000-000000000002',80);
    raise exception 'Foreign owner insertion permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.body_measurements(user_id) values(auth.uid()); raise exception 'Empty measurement accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements(user_id,weight_kg) values(auth.uid(),501); raise exception 'Out of range weight accepted';
  exception when check_violation then null; end;
  begin
    insert into public.body_measurements(user_id,waist_cm) values(auth.uid(),'NaN'::numeric); raise exception 'NaN accepted';
  exception when check_violation then null; end;
  begin perform public.get_body_progress('bad'); raise exception 'Invalid period accepted'; exception when invalid_parameter_value then null; end;
end;
$$;
insert into public.body_measurements(user_id,recorded_at,weight_kg)
select auth.uid(),now()-make_interval(days => i),80 from generate_series(1,400) i;
do $$ begin
  if jsonb_array_length(public.get_body_progress('all')->'points') > 120 then raise exception 'Unbounded chart'; end if;
end $$;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (public.get_body_progress('all')->>'count')::int <> 1 then raise exception 'Other account summary leaked'; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.get_body_progress(text,date)','EXECUTE') then raise exception 'Anonymous access'; end if;
end $$;
rollback;
