-- Player feedback on a string (optional fields, anonymous): which racket, which tension, how it
-- played. Visitors may only INSERT; only admins can read or delete. Every limit is enforced here,
-- so it also holds for anyone talking to the database directly instead of using the form.
-- Safe to run again.

create table if not exists public.string_feedback (
  id uuid primary key default gen_random_uuid(),
  string_id text not null references public.strings(id) on delete cascade,
  created_at timestamptz not null default now(),
  racket_name text check (racket_name is null or char_length(racket_name) between 1 and 80),
  racket_balance text check (racket_balance is null or racket_balance in ('headHeavy', 'even', 'headLight')),
  tension_kg numeric(4, 1) check (tension_kg is null or tension_kg between 6 and 16),
  level text check (level is null or level in ('beginner', 'intermediate', 'advanced', 'tournament')),
  play_style text check (play_style is null or play_style in ('attacking', 'doubles', 'control', 'defensive', 'allRound')),
  rating_power smallint check (rating_power is null or rating_power between 1 and 5),
  rating_control smallint check (rating_control is null or rating_control between 1 and 5),
  rating_comfort smallint check (rating_comfort is null or rating_comfort between 1 and 5),
  rating_durability smallint check (rating_durability is null or rating_durability between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 500)
);

create index if not exists string_feedback_string_idx on public.string_feedback (string_id, created_at desc);

alter table public.string_feedback enable row level security;

grant insert on public.string_feedback to anon, authenticated;
grant select, delete on public.string_feedback to authenticated;

drop policy if exists "string_feedback public insert" on public.string_feedback;
create policy "string_feedback public insert" on public.string_feedback
  for insert to anon, authenticated
  with check (true);

drop policy if exists "string_feedback admin read" on public.string_feedback;
create policy "string_feedback admin read" on public.string_feedback
  for select to authenticated
  using (public.is_admin());

drop policy if exists "string_feedback admin delete" on public.string_feedback;
create policy "string_feedback admin delete" on public.string_feedback
  for delete to authenticated
  using (public.is_admin());
