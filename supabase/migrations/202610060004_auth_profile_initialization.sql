begin;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  fallback_username text := 'user_' || left(replace(new.id::text, '-', ''), 12);
  profile_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if requested_username !~ '^[a-z0-9_]{3,30}$' then
    requested_username := fallback_username;
  end if;

  profile_name := left(
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username),
    80
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    preferred_units,
    experience_level
  )
  values (
    new.id,
    requested_username,
    profile_name,
    new.raw_user_meta_data ->> 'avatar_url',
    'metric',
    'beginner'
  );

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

comment on function private.handle_new_user() is
  'Creates one profile transactionally for every Auth user. Valid duplicate usernames fail instead of silently assigning a different name.';

commit;
