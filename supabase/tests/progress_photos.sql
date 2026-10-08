-- Rollback-only metadata/RLS tests on migrated local Supabase, as postgres.
-- These simulate Storage metadata, not real binary uploads or signed HTTP requests.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('96000000-0000-0000-0000-000000000001','photo-owner@example.test','{"username":"photo_owner","display_name":"Owner"}'),
  ('96000000-0000-0000-0000-000000000002','photo-other@example.test','{"username":"photo_other","display_name":"Other"}');
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
set local role authenticated;
insert into public.body_measurements(user_id,recorded_at,weight_kg,waist_cm) values
  (auth.uid(),'2020-01-01T00:00:00Z',80,90), (auth.uid(),'2020-01-01T12:00:00Z',null,88);
do $$
declare actor uuid := auth.uid(); photo_id uuid := '86000000-0000-0000-0000-000000000001'; result jsonb;
begin
  if (public.get_photo_date_measurements(actor,'2020-01-01')->>'weightKg')::numeric <> 80 or
    (public.get_photo_date_measurements(actor,'2020-01-01')->>'waistCm')::numeric <> 88 then raise exception 'Sparse same-day measurements lost'; end if;
  if public.get_photo_date_measurements(actor,'2019-01-01') is not null then raise exception 'Invented missing snapshot'; end if;
  result := public.reserve_progress_photo(actor,photo_id,'2020-01-01','front','Private',repeat('a',64));
  if result->>'upload_status' <> 'pending' or (result->>'is_private')::boolean <> true or result->>'photo_url' <> actor::text||'/'||photo_id::text||'/full.jpg' then raise exception 'Metadata privacy/path invalid'; end if;
  perform public.reserve_progress_photo(actor,photo_id,'2020-01-01','front','Private',repeat('a',64));
  if (select count(*) from public.progress_photos where id = photo_id) <> 1 then raise exception 'Duplicate metadata'; end if;
  begin perform public.reserve_progress_photo(actor,photo_id,'2020-01-01','front','Changed',repeat('a',64)); raise exception 'Changed retry allowed'; exception when sqlstate '40001' then null; end;
  begin perform public.reserve_progress_photo('96000000-0000-0000-0000-000000000002','86000000-0000-0000-0000-000000000009','2020-01-01','front','',repeat('a',64)); raise exception 'Account mismatch allowed'; exception when insufficient_privilege then null; end;
  begin perform public.finish_progress_photo(photo_id); raise exception 'Incomplete upload published'; exception when invalid_parameter_value then null; end;
  begin insert into public.progress_photos(user_id,photo_url,pose_type) values(actor,actor::text||'/arbitrary.jpg','front'); raise exception 'Direct insert allowed'; exception when insufficient_privilege then null; end;
  begin update public.progress_photos set is_private = false where id = photo_id; raise exception 'Public sharing permitted'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name) values('progress-photos',actor::text||'/not-reserved.jpg'); raise exception 'Unreserved storage write permitted'; exception when insufficient_privilege then null; end;
end $$;
insert into storage.objects(bucket_id,name,metadata) values
  ('progress-photos','96000000-0000-0000-0000-000000000001/86000000-0000-0000-0000-000000000001/full.jpg','{"mimetype":"image/jpeg","size":4}'),
  ('progress-photos','96000000-0000-0000-0000-000000000001/86000000-0000-0000-0000-000000000001/thumbnail.jpg','{"mimetype":"image/jpeg","size":4}');
do $$
declare photo_id uuid := '86000000-0000-0000-0000-000000000001';
begin
  if public.finish_progress_photo(photo_id)->>'upload_status' <> 'ready' then raise exception 'Completed upload not visible'; end if;
  if public.finish_progress_photo(photo_id)->>'upload_status' <> 'ready' then raise exception 'Finish retry not idempotent'; end if;
  if (select count(*) from storage.objects where bucket_id = 'progress-photos') <> 2 then raise exception 'Owner cannot read own images'; end if;
end $$;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000002',true);
do $$
begin
  if public.get_photo_date_measurements(auth.uid(),'2020-01-01') is not null then raise exception 'Another owner measurement snapshot leaked'; end if;
  begin perform public.get_photo_date_measurements('96000000-0000-0000-0000-000000000001','2020-01-01'); raise exception 'Spoofed snapshot owner accepted'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.progress_photos) or exists(select 1 from storage.objects where bucket_id = 'progress-photos') then raise exception 'Another account can read private media'; end if;
  if public.begin_delete_progress_photo('86000000-0000-0000-0000-000000000001') is not null then raise exception 'Another owner marked deletion'; end if;
  begin perform public.finish_progress_photo('86000000-0000-0000-0000-000000000001'); raise exception 'Another owner finished upload'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
do $$
declare photo_id uuid := '86000000-0000-0000-0000-000000000001'; empty_id uuid := '86000000-0000-0000-0000-000000000002';
begin
  perform public.begin_delete_progress_photo(photo_id);
  begin perform public.finish_delete_progress_photo(photo_id); raise exception 'Metadata removed before binary cleanup'; exception when sqlstate '40001' then null; end;
  if (select upload_status from public.progress_photos where id = photo_id) <> 'deleting' then raise exception 'Recoverable deletion lost'; end if;
  if private.can_upload_progress_photo(auth.uid()::text||'/'||photo_id::text||'/full.jpg') then raise exception 'Deletion race permits new object'; end if;
  perform public.reserve_progress_photo(auth.uid(),empty_id,'2020-01-01','side','',repeat('b',64));
  perform public.begin_delete_progress_photo(empty_id); perform public.finish_delete_progress_photo(empty_id); perform public.finish_delete_progress_photo(empty_id);
  if exists(select 1 from public.progress_photos where id = empty_id) then raise exception 'Empty upload cleanup failed'; end if;
end $$;
reset role;
do $$ begin
  if (select public or file_size_limit <> 4194304 from storage.buckets where id = 'progress-photos') then raise exception 'Unsafe bucket'; end if;
  if has_function_privilege('anon','public.reserve_progress_photo(uuid,uuid,date,public.progress_pose,text,text)','EXECUTE') then raise exception 'Anonymous upload RPC'; end if;
end $$;
rollback;
