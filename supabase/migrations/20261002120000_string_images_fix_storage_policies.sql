-- Fix for the string-image importer, and a complete, re-runnable setup.
--
-- The first version (20261001120000) gave admins insert/update/delete on the
-- string-images bucket but no SELECT. Supabase Storage needs SELECT as well for
-- uploads that may overwrite, and to list files — so every upload was refused.
--
-- This file repeats everything from 20261001120000 (all statements are safe to
-- run again) and adds the missing SELECT policy, so running THIS file alone is
-- enough, whether or not the first one was ever run.

alter table public.strings
  add column if not exists image_back_url text,
  add column if not exists image_meta jsonb;

alter table public.specialist_profiles
  add column if not exists research_import jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('string-images', 'string-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "string-images admin select" on storage.objects;
create policy "string-images admin select" on storage.objects
  for select to authenticated
  using (bucket_id = 'string-images' and public.is_admin());

drop policy if exists "string-images admin insert" on storage.objects;
create policy "string-images admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'string-images' and public.is_admin());

drop policy if exists "string-images admin update" on storage.objects;
create policy "string-images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'string-images' and public.is_admin())
  with check (bucket_id = 'string-images' and public.is_admin());

drop policy if exists "string-images admin delete" on storage.objects;
create policy "string-images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'string-images' and public.is_admin());
