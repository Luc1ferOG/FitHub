begin;

create extension if not exists pg_trgm with schema extensions;
create index profiles_username_search_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_search_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- Writes go through an atomic, identity-checked state machine, not table grants.
revoke insert, update, delete on public.friendships from authenticated;
revoke insert (id, requester_id, addressee_id, status), update (status) on public.friendships from authenticated;
drop index public.friendships_requester_status_idx;
drop index public.friendships_addressee_status_idx;
create index friendships_requester_status_idx on public.friendships (requester_id, status, created_at desc, id);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status, created_at desc, id);

create function public.change_friendship(p_target uuid, p_action text, p_expected_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); relation public.friendships;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_target is null or actor = p_target then raise exception 'Cannot befriend yourself' using errcode = '22023'; end if;
  -- Every transition for an unordered pair shares a transaction lock, including absent rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(actor,p_target)::text || greatest(actor,p_target)::text, 0));
  select * into relation from public.friendships
    where least(requester_id,addressee_id) = least(actor,p_target)
      and greatest(requester_id,addressee_id) = greatest(actor,p_target) for update;
  if p_action = 'send' then
    if relation.id is not null and relation.status <> 'declined' then
      raise exception 'A request or friendship already exists' using errcode = '23505';
    end if;
    -- New identity prevents stale actions against a previously rejected request.
    if relation.id is not null then delete from public.friendships where id = relation.id; end if;
    insert into public.friendships(requester_id,addressee_id) values(actor,p_target) returning * into relation;
  else
    if relation.id is null or p_expected_id is distinct from relation.id then
      raise exception 'Friendship changed; refresh and try again' using errcode = '40001';
    end if;
    if p_action in ('accept','reject') and relation.status = 'pending' and relation.addressee_id = actor then
      update public.friendships set status = case when p_action = 'accept' then 'accepted'::public.friendship_status else 'declined'::public.friendship_status end
        where id = relation.id returning * into relation;
    elsif (p_action = 'remove' and relation.status = 'accepted')
      or (p_action = 'cancel' and relation.status = 'pending' and relation.requester_id = actor) then
      delete from public.friendships where id = relation.id;
      return null;
    else raise exception 'This action is not permitted' using errcode = '42501';
    end if;
  end if;
  return to_jsonb(relation);
end;
$$;

create function public.search_social_users(p_search text, p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare needle text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_search is null or p_offset is null or p_offset not between 0 and 10000 or char_length(trim(p_search)) not between 2 and 80 then
    raise exception 'Invalid search' using errcode = '22023';
  end if;
  needle := '%' || replace(replace(replace(trim(p_search), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  return (select coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb) from (
    select * from public.public_profiles where id <> auth.uid()
      and (username ilike needle escape E'\\' or display_name ilike needle escape E'\\')
    order by username, id limit 21 offset p_offset
  ) result);
end;
$$;

create function public.list_social_friends(p_kind text, p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('friends','incoming','outgoing') or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid list' using errcode = '22023';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(result)), '[]'::jsonb) from (
    select to_jsonb(p) as profile, to_jsonb(f) as friendship from public.friendships f
    join public.public_profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    where (p_kind = 'friends' and f.status = 'accepted' and auth.uid() in (f.requester_id,f.addressee_id))
      or (p_kind = 'incoming' and f.status = 'pending' and f.addressee_id = auth.uid())
      or (p_kind = 'outgoing' and f.status = 'pending' and f.requester_id = auth.uid())
    order by f.created_at desc, f.id limit 21 offset p_offset
  ) result);
end;
$$;

-- Explicit public aggregate: never expose private history, body measurements or email.
create function public.get_social_profile(p_target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select jsonb_build_object('profile',to_jsonb(p),
    'public_workout_count',(select count(*) from public.workouts where owner_id = p.id and is_public),
    'achievement_count',(select count(*) from public.user_achievements where user_id = p.id),
    'achievements',(select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from (
      select a.code,a.title,a.icon,u.unlocked_at from public.user_achievements u
      join public.achievements a on a.id = u.achievement_id where u.user_id = p.id
      order by u.unlocked_at desc,a.code limit 50) a))
    from public.public_profiles p where p.id = p_target);
end;
$$;

revoke all on function public.change_friendship(uuid,text,uuid), public.search_social_users(text,integer), public.list_social_friends(text,integer), public.get_social_profile(uuid) from public, anon;
grant execute on function public.change_friendship(uuid,text,uuid), public.search_social_users(text,integer), public.list_social_friends(text,integer), public.get_social_profile(uuid) to authenticated;
commit;
