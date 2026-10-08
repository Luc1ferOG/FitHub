begin;
alter table public.progress_photos add column upload_status text not null default 'ready';
alter table public.progress_photos add column upload_checksum text;
alter table public.progress_photos add constraint progress_photos_upload_status check (upload_status in ('pending','ready','deleting'));
alter table public.progress_photos add constraint progress_photos_checksum check (upload_checksum is null or upload_checksum ~ '^[0-9a-f]{64}$');
-- This feature does not support photo sharing. Existing previously-public metadata becomes private.
update public.progress_photos set is_private = true where not is_private;
alter table public.progress_photos add constraint progress_photos_always_private check (is_private);
create index progress_photos_history_idx on public.progress_photos(user_id,taken_at desc,id desc);
drop policy progress_photos_read_visible on public.progress_photos;
create policy progress_photos_read_owner on public.progress_photos for select to authenticated using (user_id = auth.uid());
drop policy progress_photos_insert_own on public.progress_photos;
drop policy progress_photos_update_own on public.progress_photos;
drop policy progress_photos_delete_own on public.progress_photos;
revoke insert,update,delete on public.progress_photos from authenticated;
revoke insert(id,user_id,photo_url,thumbnail_url,pose_type,taken_at,notes,is_private),
  update(photo_url,thumbnail_url,pose_type,taken_at,notes,is_private) on public.progress_photos from authenticated;

update storage.buckets set public = false,file_size_limit = 4194304,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'progress-photos';
drop policy progress_photos_read_visible on storage.objects;
create policy progress_photos_read_owner on storage.objects for select to authenticated using (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.progress_photos p where p.user_id = auth.uid() and (p.photo_url = name or p.thumbnail_url = name))
);
drop policy progress_photos_insert_own_folder on storage.objects;
-- Immutable objects: retries use the same paths/checksum, never silently overwrite photos.
drop policy progress_photos_update_own_folder on storage.objects;
drop policy progress_photos_delete_own_folder on storage.objects;
create policy progress_photos_delete_registered on storage.objects for delete to authenticated using (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.progress_photos p where p.user_id = auth.uid() and p.upload_status = 'deleting' and (p.photo_url = name or p.thumbnail_url = name))
);
-- Hold the parent row while registering an object, preventing a concurrent delete from
-- finishing between its policy check and INSERT commit and leaving an orphan object.
create function private.can_upload_progress_photo(p_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare photo public.progress_photos;
begin
  select * into photo from public.progress_photos where user_id = auth.uid() and (photo_url = p_name or thumbnail_url = p_name) for share;
  if not found then return false; end if;
  return photo.upload_status = 'pending';
end $$;
revoke all on function private.can_upload_progress_photo(text) from public,anon;
grant execute on function private.can_upload_progress_photo(text) to authenticated;
create policy progress_photos_insert_pending on storage.objects for insert to authenticated with check (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
  and private.can_upload_progress_photo(name)
);

create function public.reserve_progress_photo(p_user uuid,p_id uuid,p_date date,p_pose public.progress_pose,p_notes text,p_checksum text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.progress_photos;
begin
  if actor is null or actor is distinct from p_user then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or p_date is null or p_date < '1900-01-01'::date or p_date > (now() at time zone 'UTC')::date + 1
    or p_pose is null or p_pose::text not in ('front','side','back') or p_notes is null or char_length(p_notes) > 1000
    or p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Invalid photo metadata' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,15));
  select * into result from public.progress_photos where id = p_id for update;
  if found then
    if result.user_id <> actor then raise exception 'Photo unavailable' using errcode = '42501'; end if;
    if result.upload_status = 'deleting' or result.upload_checksum is distinct from p_checksum
      or result.taken_at is distinct from (p_date::timestamp at time zone 'UTC') or result.pose_type is distinct from p_pose
      or result.notes is distinct from btrim(p_notes) then raise exception 'Photo upload changed; discard it before starting again' using errcode = '40001'; end if;
    return to_jsonb(result);
  end if;
  insert into public.progress_photos(id,user_id,photo_url,thumbnail_url,taken_at,pose_type,notes,is_private,upload_status,upload_checksum)
  values(p_id,actor,actor::text||'/'||p_id::text||'/full.jpg',actor::text||'/'||p_id::text||'/thumbnail.jpg',
    p_date::timestamp at time zone 'UTC',p_pose,btrim(p_notes),true,'pending',p_checksum) returning * into result;
  return to_jsonb(result);
end $$;
create function public.finish_progress_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result public.progress_photos;
begin
  select * into result from public.progress_photos where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Photo unavailable' using errcode = '42501'; end if;
  if result.upload_status = 'ready' then return to_jsonb(result); end if;
  if result.upload_status <> 'pending' then raise exception 'Photo is being deleted' using errcode = '40001'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'progress-photos' and name = result.photo_url)
    or not exists(select 1 from storage.objects where bucket_id = 'progress-photos' and name = result.thumbnail_url) then
    raise exception 'Upload both images before finishing' using errcode = '22023'; end if;
  update public.progress_photos set upload_status = 'ready' where id = p_id returning * into result;
  return to_jsonb(result);
end $$;
create function public.begin_delete_progress_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result public.progress_photos;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.progress_photos set upload_status = 'deleting' where id = p_id and user_id = auth.uid() returning * into result;
  if not found then return null; end if;
  return to_jsonb(result);
end $$;
create function public.finish_delete_progress_photo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare result public.progress_photos;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into result from public.progress_photos where id = p_id and user_id = auth.uid() for update;
  if not found then return; end if;
  if result.upload_status <> 'deleting' or exists(select 1 from storage.objects where bucket_id = 'progress-photos' and name in (result.photo_url,result.thumbnail_url)) then
    raise exception 'Remove stored images before metadata' using errcode = '40001'; end if;
  delete from public.progress_photos where id = p_id;
end $$;
revoke all on function public.reserve_progress_photo(uuid,uuid,date,public.progress_pose,text,text),public.finish_progress_photo(uuid),
  public.begin_delete_progress_photo(uuid),public.finish_delete_progress_photo(uuid) from public,anon;
grant execute on function public.reserve_progress_photo(uuid,uuid,date,public.progress_pose,text,text),public.finish_progress_photo(uuid),
  public.begin_delete_progress_photo(uuid),public.finish_delete_progress_photo(uuid) to authenticated;
comment on column public.progress_photos.upload_status is 'Recoverable two-resource upload/delete workflow. Pending/deleting rows remain visible only to their owner for cleanup.';
create function public.get_photo_date_measurements(p_user uuid,p_day date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_day is null then raise exception 'Choose a date' using errcode = '22023'; end if;
  return (select case when count(*) = 0 then null else jsonb_build_object(
    'weightKg',(array_agg(weight_kg order by recorded_at desc,id desc) filter(where weight_kg is not null))[1],
    'bodyFatPercentage',(array_agg(body_fat_percentage order by recorded_at desc,id desc) filter(where body_fat_percentage is not null))[1],
    'chestCm',(array_agg(chest_cm order by recorded_at desc,id desc) filter(where chest_cm is not null))[1],
    'waistCm',(array_agg(waist_cm order by recorded_at desc,id desc) filter(where waist_cm is not null))[1],
    'hipsCm',(array_agg(hips_cm order by recorded_at desc,id desc) filter(where hips_cm is not null))[1],
    'leftArmCm',(array_agg(left_arm_cm order by recorded_at desc,id desc) filter(where left_arm_cm is not null))[1],
    'rightArmCm',(array_agg(right_arm_cm order by recorded_at desc,id desc) filter(where right_arm_cm is not null))[1],
    'leftThighCm',(array_agg(left_thigh_cm order by recorded_at desc,id desc) filter(where left_thigh_cm is not null))[1],
    'rightThighCm',(array_agg(right_thigh_cm order by recorded_at desc,id desc) filter(where right_thigh_cm is not null))[1]) end
    from public.body_measurements where user_id = auth.uid()
      and recorded_at >= (p_day::timestamp at time zone 'UTC') and recorded_at < ((p_day + 1)::timestamp at time zone 'UTC'));
end $$;
revoke all on function public.get_photo_date_measurements(uuid,date) from public,anon;
grant execute on function public.get_photo_date_measurements(uuid,date) to authenticated;
commit;
