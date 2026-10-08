begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('exercise-media', 'exercise-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('progress-photos', 'progress-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_public_read
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy avatars_insert_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_update_own_folder
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own_folder
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy exercise_media_public_read
on storage.objects for select
to public
using (bucket_id = 'exercise-media');

create policy progress_photos_read_visible
on storage.objects for select
to authenticated
using (
  bucket_id = 'progress-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.progress_photos p
      where not p.is_private and (p.photo_url = name or p.thumbnail_url = name)
    )
  )
);

create policy progress_photos_insert_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy progress_photos_update_own_folder
on storage.objects for update
to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy progress_photos_delete_own_folder
on storage.objects for delete
to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

comment on column public.progress_photos.photo_url is 'Object path inside the private progress-photos bucket, not a permanent signed URL.';
comment on column public.progress_photos.thumbnail_url is 'Optional thumbnail object path inside the progress-photos bucket.';

commit;
