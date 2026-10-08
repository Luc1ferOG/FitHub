begin;
-- Optional values allow circumference-only entries. Existing owner-only RLS remains in force.
alter table public.body_measurements alter column weight_kg drop not null;
alter table public.body_measurements add constraint body_measurements_has_value check (
  num_nonnulls(weight_kg,body_fat_percentage,chest_cm,waist_cm,hips_cm,left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm) > 0
) not valid;
-- NOT VALID preserves old imported data; PostgreSQL still checks every new/updated row.
alter table public.body_measurements add constraint body_measurements_supported_ranges check (
  (weight_kg is null or weight_kg between 20 and 500) and
  (body_fat_percentage is null or body_fat_percentage between 1 and 75) and
  (chest_cm is null or chest_cm between 20 and 300) and
  (waist_cm is null or waist_cm between 20 and 300) and
  (hips_cm is null or hips_cm between 20 and 300) and
  (left_arm_cm is null or left_arm_cm between 5 and 100) and
  (right_arm_cm is null or right_arm_cm between 5 and 100) and
  (left_thigh_cm is null or left_thigh_cm between 10 and 200) and
  (right_thigh_cm is null or right_thigh_cm between 10 and 200)
) not valid;
alter table public.body_measurements add constraint body_measurements_date_supported check (
  recorded_at >= '1900-01-01T00:00:00Z'::timestamptz and recorded_at <= now() + interval '1 day'
) not valid;
create index body_measurements_history_idx on public.body_measurements(user_id,recorded_at desc,id desc);

-- SECURITY INVOKER: ordinary SELECT grants and owner-only RLS apply to all reads.
-- No owner parameter can be spoofed. Summaries are exact all-history values, charts bounded averages.
create function public.get_body_progress(p_period text default '30d', p_today date default ((now() at time zone 'UTC')::date)) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare actor uuid := auth.uid(); first_day timestamptz; end_day timestamptz;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_period is null or p_period not in ('30d','3m','6m','1y','all') then raise exception 'Invalid period' using errcode = '22023'; end if;
  if p_today is null or p_today not between (now() at time zone 'UTC')::date - 1 and (now() at time zone 'UTC')::date + 1 then
    raise exception 'Invalid local day' using errcode = '22023';
  end if;
  end_day := ((p_today + 1)::timestamp at time zone 'UTC');
  first_day := case p_period
    when '30d' then ((p_today + 1)::timestamp - interval '30 days') at time zone 'UTC'
    when '3m' then ((p_today + 1)::timestamp - interval '3 months') at time zone 'UTC'
    when '6m' then ((p_today + 1)::timestamp - interval '6 months') at time zone 'UTC'
    when '1y' then ((p_today + 1)::timestamp - interval '1 year') at time zone 'UTC'
    else (select min(recorded_at) from public.body_measurements where user_id = actor) end;
  return (
    with history as materialized (
      select id,recorded_at,weight_kg,body_fat_percentage,chest_cm,waist_cm,hips_cm,
        left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm
      from public.body_measurements where user_id = actor
    ), expanded as (
      select h.id,h.recorded_at,v.key,v.value from history h cross join lateral (
        values ('weightKg',h.weight_kg),('bodyFatPercentage',h.body_fat_percentage),('chestCm',h.chest_cm),
          ('waistCm',h.waist_cm),('hipsCm',h.hips_cm),('leftArmCm',h.left_arm_cm),('rightArmCm',h.right_arm_cm),
          ('leftThighCm',h.left_thigh_cm),('rightThighCm',h.right_thigh_cm)
      ) v(key,value)
    ), summaries as (
      select key,jsonb_build_object(
        'latest',(array_agg(value order by recorded_at desc,id desc) filter(where value is not null))[1],
        'previous',(array_agg(value order by recorded_at desc,id desc) filter(where value is not null))[2],
        'starting',(array_agg(value order by recorded_at,id) filter(where value is not null))[1],
        'recordedAt',(array_agg(recorded_at order by recorded_at desc,id desc) filter(where value is not null))[1]
      ) as summary from expanded group by key
    ), buckets as (
      select *,least(119,greatest(0,floor(extract(epoch from (recorded_at - first_day)) /
        greatest(1,extract(epoch from (end_day - first_day))) * 120)::integer)) as bucket
      from history where recorded_at >= first_day and recorded_at < end_day
    ), points as (
      select bucket,min(recorded_at) as date,avg(weight_kg) as weight,avg(waist_cm) as waist,avg(body_fat_percentage) as fat
      from buckets group by bucket
    )
    select jsonb_build_object('count',(select count(*) from history),
      'summaries',coalesce((select jsonb_object_agg(key,summary) from summaries),
        (select jsonb_object_agg(key,jsonb_build_object('latest',null,'previous',null,'starting',null,'recordedAt',null))
          from unnest(array['weightKg','bodyFatPercentage','chestCm','waistCm','hipsCm','leftArmCm','rightArmCm','leftThighCm','rightThighCm']) as fields(key))),
      'points',coalesce((select jsonb_agg(jsonb_build_object('date',date,'weightKg',weight,'waistCm',waist,'bodyFatPercentage',fat) order by date) from points),'[]'::jsonb))
  );
end;
$$;
revoke all on function public.get_body_progress(text,date) from public,anon;
grant execute on function public.get_body_progress(text,date) to authenticated;
commit;
