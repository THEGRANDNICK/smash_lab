-- Images for every string (front + back packet photos) and provenance for
-- imported external research. Used by the two importers in the admin area
-- (Admin → Imports). Safe to run more than once.

-- 1) Strings: the existing image_url stays the FRONT image; add the back and
--    a small provenance record (source URL, packaging note, content hash per
--    side — the hash makes re-importing an identical image a no-op).
alter table public.strings
  add column if not exists image_back_url text,
  add column if not exists image_meta jsonb;

comment on column public.strings.image_url is 'Front packet image (public URL). Set by the image importer or by hand.';
comment on column public.strings.image_back_url is 'Back packet image (public URL). Set by the image importer.';
comment on column public.strings.image_meta is 'Image provenance: {packId, importedAt, front:{sha256,source,note}, back:{...}}. Display/provenance only.';

-- 2) Specialist profiles: remember which values came from an external research
--    import (dataset id + the exact fields taken), so community-sourced values
--    stay distinguishable from hands-on ones.
alter table public.specialist_profiles
  add column if not exists research_import jsonb;

comment on column public.specialist_profiles.research_import is 'External research provenance: {datasetId, importedAt, fields:[...]} — which dimensions/texts came from an imported research pack.';

-- 3) Storage bucket for the images. Public read (they are shown on the public
--    site); only admins (public.is_admin()) may upload, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('string-images', 'string-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
