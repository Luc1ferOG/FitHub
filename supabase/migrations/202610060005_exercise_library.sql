begin;

alter table public.exercises
  add column form_tips text[] not null default '{}',
  add column common_mistakes text[] not null default '{}';

create extension if not exists pg_trgm with schema extensions;
create index exercises_name_search_idx on public.exercises using gin (name extensions.gin_trgm_ops);
create index exercises_name_id_idx on public.exercises (name, id);

-- SECURITY INVOKER keeps catalogue RLS and caller privileges in force.
create function public.get_exercise_filter_options()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'muscles', coalesce((
      select jsonb_agg(primary_muscle order by primary_muscle)
      from (select distinct primary_muscle from public.exercises) muscles
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(equipment order by equipment)
      from (select distinct equipment from public.exercises) equipment_options
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_exercise_filter_options() from public;
grant execute on function public.get_exercise_filter_options() to authenticated;

comment on column public.exercises.form_tips is 'Ordered exercise-specific coaching cues.';
comment on column public.exercises.common_mistakes is 'Ordered common technique errors to avoid.';

commit;
