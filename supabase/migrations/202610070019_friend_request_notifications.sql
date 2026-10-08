begin;

-- Persist delivery atomically with the request. Trigger functions are not client RPCs.
create function private.notify_friend_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare notification uuid;
begin
  if new.status <> 'pending' then return new; end if;
  insert into public.notifications(user_id,type,title,message,data)
  values(new.addressee_id,'friend_request','New friend request','You have a new FitHub friend request.',
    jsonb_build_object('kind','friend_request','userId',new.addressee_id,'requesterId',new.requester_id,'friendshipId',new.id))
  returning id into notification;
  insert into private.challenge_push_outbox(notification_id,token)
    select notification,token from public.push_devices where user_id=new.addressee_id
    on conflict(notification_id,token) do nothing;
  return new;
end;
$$;
revoke all on function private.notify_friend_request() from public,anon,authenticated;
create trigger friend_request_notification after insert on public.friendships
for each row execute function private.notify_friend_request();

commit;
