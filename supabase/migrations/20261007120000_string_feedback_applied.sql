-- Feedback that has been folded into the hands-on ratings is marked, so it is never counted twice.
-- Only admins may set the mark. Safe to run again.
alter table public.string_feedback add column if not exists applied_at timestamptz;

grant update (applied_at) on public.string_feedback to authenticated;

drop policy if exists "string_feedback admin update" on public.string_feedback;
create policy "string_feedback admin update" on public.string_feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
