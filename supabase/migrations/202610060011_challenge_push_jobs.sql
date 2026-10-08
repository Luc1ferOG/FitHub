begin;
alter table private.challenge_push_outbox add column lease_id uuid;
create index challenge_push_ready_idx on private.challenge_push_outbox(available_at) where state in ('pending','receipt');

create function public.claim_challenge_push_jobs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare jobs jsonb;
begin
  with candidates as(select id from private.challenge_push_outbox where state in ('pending','receipt') and available_at <= now()
    and (lease_until is null or lease_until < now()) and attempts < 12 order by available_at,id for update skip locked limit 50),
  claimed as(update private.challenge_push_outbox o set lease_until = now() + interval '5 minutes',lease_id = gen_random_uuid(),attempts = attempts + 1
    from candidates c where o.id = c.id returning o.*)
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'leaseId',c.lease_id,'token',c.token,'state',c.state,'receiptId',c.receipt_id,
    'attempts',c.attempts,'title',n.title,'body',n.message,'data',n.data || jsonb_build_object('notificationId',n.id))),'[]'::jsonb)
    into jobs from claimed c join public.notifications n on n.id = c.notification_id;
  update private.challenge_push_outbox set state = 'failed' where state in ('pending','receipt') and attempts >= 12 and lease_until < now();
  return jobs;
end;
$$;

create function public.finish_challenge_push_job(p_id uuid,p_lease uuid,p_outcome text,p_receipt text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare job private.challenge_push_outbox;
begin
  select * into job from private.challenge_push_outbox where id = p_id and lease_id = p_lease for update;
  if not found then return; end if;
  if p_outcome = 'unregistered' then delete from public.push_devices where token = job.token; return; end if;
  if p_outcome not in ('done','retry','receipt','failed') or (p_outcome = 'receipt' and p_receipt is null) then raise exception 'Invalid delivery outcome'; end if;
  update private.challenge_push_outbox set state = case when p_outcome = 'retry' then state else p_outcome end,
    receipt_id = coalesce(p_receipt,receipt_id),lease_until = null,lease_id = null,
    available_at = now() + case when p_outcome = 'receipt' then interval '15 minutes' else least(3600,power(2,attempts)::integer * 30) * interval '1 second' end
    where id = job.id;
end;
$$;
revoke all on function public.claim_challenge_push_jobs(),public.finish_challenge_push_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_challenge_push_jobs(),public.finish_challenge_push_job(uuid,uuid,text,text) to service_role;
commit;
