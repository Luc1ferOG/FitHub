-- Run as postgres against migrated/seeded local Supabase; all fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('91000000-0000-0000-0000-000000000001','social-a@example.test','{"username":"social_test_a","display_name":"Social Alpha"}'),
('91000000-0000-0000-0000-000000000002','social-b@example.test','{"username":"social_test_b","display_name":"Social Beta"}'),
('91000000-0000-0000-0000-000000000003','social-c@example.test','{"username":"social_test_c","display_name":"Social Gamma"}');
do $$
declare a uuid := '91000000-0000-0000-0000-000000000001'; b uuid := '91000000-0000-0000-0000-000000000002';
  c uuid := '91000000-0000-0000-0000-000000000003'; request_id uuid; fresh_id uuid; result jsonb;
begin
  if has_column_privilege('authenticated','public.friendships','requester_id','INSERT')
    or has_column_privilege('authenticated','public.friendships','status','UPDATE')
    or has_table_privilege('authenticated','public.friendships','DELETE')
    or has_function_privilege('anon','public.change_friendship(uuid,text,uuid)','EXECUTE') then raise exception 'Unsafe friend grants'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.change_friendship(b,'send'); raise exception 'Anonymous write succeeded'; exception when sqlstate '42501' then null; end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin perform public.change_friendship(a,'send'); raise exception 'Self request succeeded'; exception when sqlstate '22023' then null; end;
  request_id := (public.change_friendship(b,'send')->>'id')::uuid;
  begin perform public.change_friendship(b,'send'); raise exception 'Duplicate succeeded'; exception when sqlstate '23505' then null; end;
  begin perform public.change_friendship(b,'accept',request_id); raise exception 'Sender accepted own request'; exception when sqlstate '42501' then null; end;
  if jsonb_array_length(public.list_social_friends('outgoing',0)) <> 1 then raise exception 'Outgoing list failed'; end if;
  perform set_config('request.jwt.claim.sub',c::text,true);
  begin perform public.change_friendship(a,'accept',request_id); raise exception 'Third party accepted'; exception when sqlstate '40001' then null; end;
  perform set_config('request.jwt.claim.sub',b::text,true);
  if jsonb_array_length(public.list_social_friends('incoming',0)) <> 1 then raise exception 'Incoming list failed'; end if;
  begin perform public.change_friendship(a,'send'); raise exception 'Reverse duplicate succeeded'; exception when sqlstate '23505' then null; end;
  result := public.change_friendship(a,'reject',request_id);
  if result->>'status' <> 'declined' then raise exception 'Reject failed'; end if;
  perform set_config('request.jwt.claim.sub',a::text,true);
  fresh_id := (public.change_friendship(b,'send')->>'id')::uuid;
  if fresh_id = request_id then raise exception 'Re-request reused stale identity'; end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  begin perform public.change_friendship(a,'accept',request_id); raise exception 'Stale accept succeeded'; exception when sqlstate '40001' then null; end;
  result := public.change_friendship(a,'accept',fresh_id);
  if result->>'status' <> 'accepted' then raise exception 'Accept failed'; end if;
  if jsonb_array_length(public.list_social_friends('friends',0)) <> 1 then raise exception 'Friends list failed'; end if;
  perform public.change_friendship(a,'remove',fresh_id);
  if exists(select 1 from public.friendships where id = fresh_id) then raise exception 'Remove failed'; end if;
  request_id := (public.change_friendship(a,'send')->>'id')::uuid;
  perform public.change_friendship(a,'cancel',request_id);
  result := public.get_social_profile(a);
  if (result->'profile') ?| array['email','date_of_birth','height_cm','weight_kg'] or result ? 'workout_sessions' then raise exception 'Private profile leak'; end if;
  if jsonb_array_length(public.search_social_users('social_test_',0)) <> 2 then raise exception 'Username search failed'; end if;
  if jsonb_array_length(public.search_social_users('Social Alpha',0)) <> 1 then raise exception 'Display-name search failed'; end if;
  begin perform public.search_social_users('%',0); raise exception 'Short search succeeded'; exception when sqlstate '22023' then null; end;
  if jsonb_array_length(public.search_social_users('%%',0)) <> 0 then raise exception 'Wildcard search was not literal'; end if;
  perform public.change_friendship(a,'send');
end;
$$;
-- Verify actual role RLS isolation while a different pair's request exists.
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists(select 1 from public.friendships where requester_id in ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002')) then raise exception 'RLS leaked another pair'; end if;
  if jsonb_array_length(public.list_social_friends('friends',0)) <> 0
    or jsonb_array_length(public.list_social_friends('incoming',0)) <> 0
    or jsonb_array_length(public.list_social_friends('outgoing',0)) <> 0 then raise exception 'Unrelated friendship leaked'; end if;
end $$;
rollback;
