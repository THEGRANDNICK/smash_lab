-- Phase 6: decimal manufacturer ratings, hybrid-string metadata, and a
-- `reviewer` column on specialist_profiles.
--
-- Does NOT edit the Phase 1 migration (20260727123901_initial_schema.sql) —
-- this is a new, additive migration on top of it, per the project's
-- migration policy. Safe to re-run: column type/constraint changes use
-- IF EXISTS/OR REPLACE-style guards where Postgres supports them, and
-- ADD COLUMN uses IF NOT EXISTS.
--
-- Backward compatible: existing whole-number ratings (e.g. 10) convert
-- cleanly to numeric; is_hybrid defaults to false for every existing row;
-- main_string_meta/cross_string_meta/reviewer are all nullable, so
-- existing rows need no backfill. Existing catalog ids, inventory rows,
-- and admin_users are untouched by this migration.

-- ---------------------------------------------------------------------------
-- Part 1: decimal manufacturer ratings
-- ---------------------------------------------------------------------------
--
-- Deliberately UNBOUNDED `numeric`, NOT `numeric(3,1)`. A declared-scale
-- numeric(3,1) column ROUNDS an over-precise value (e.g. 9.55 -> 9.6) at
-- assignment time, BEFORE any CHECK constraint on that column ever runs —
-- so a `x = round(x, 1)` check on a numeric(3,1) column is a no-op, it
-- always trivially passes because x has already been rounded to 1 decimal
-- by the column's own type. This was caught by local integration testing
-- (inserting 9.55 through a numeric(3,1) column silently stored 9.6 and
-- passed the check). Plain `numeric` stores the value exactly as given,
-- so the CHECK below genuinely rejects anything with more than one
-- decimal place instead of silently rounding it.

alter table public.strings
  alter column repulsion type numeric,
  alter column durability type numeric,
  alter column hitting_sound type numeric,
  alter column shock_absorption type numeric,
  alter column control type numeric;

-- Replace the old integer-range checks with ones that also reject more than
-- one decimal place (e.g. 9.55) rather than silently rounding it.
alter table public.strings drop constraint if exists strings_repulsion_range;
alter table public.strings add constraint strings_repulsion_range
  check (repulsion between 0 and 11 and repulsion = round(repulsion, 1));

alter table public.strings drop constraint if exists strings_durability_range;
alter table public.strings add constraint strings_durability_range
  check (durability between 0 and 11 and durability = round(durability, 1));

alter table public.strings drop constraint if exists strings_hitting_sound_range;
alter table public.strings add constraint strings_hitting_sound_range
  check (hitting_sound between 0 and 11 and hitting_sound = round(hitting_sound, 1));

alter table public.strings drop constraint if exists strings_shock_absorption_range;
alter table public.strings add constraint strings_shock_absorption_range
  check (shock_absorption is null or (shock_absorption between 0 and 11 and shock_absorption = round(shock_absorption, 1)));

alter table public.strings drop constraint if exists strings_control_range;
alter table public.strings add constraint strings_control_range
  check (control between 0 and 11 and control = round(control, 1));

-- ---------------------------------------------------------------------------
-- Part 2: hybrid string support
-- ---------------------------------------------------------------------------
--
-- Each side (main/cross) is a single jsonb blob rather than separate flat
-- columns — it's sparse, display/admin-only metadata (never a
-- recommendation input), mirroring how tension_meta is already modeled.
-- Shape (all fields optional): { gauge?: number, material?: string,
-- construction?: string, coating?: string, color?: string }.

alter table public.strings add column if not exists is_hybrid boolean not null default false;
alter table public.strings add column if not exists main_string_meta jsonb;
alter table public.strings add column if not exists cross_string_meta jsonb;

comment on column public.strings.is_hybrid is 'True for a dual-string (main+cross) construction, e.g. Yonex AeroBite. Display/admin metadata only — never a recommendation input.';
comment on column public.strings.main_string_meta is 'Sparse hybrid metadata for the main string side: {gauge?, material?, construction?, coating?, color?}. Null for non-hybrid strings.';
comment on column public.strings.cross_string_meta is 'Sparse hybrid metadata for the cross string side: {gauge?, material?, construction?, coating?, color?}. Null for non-hybrid strings.';

-- ---------------------------------------------------------------------------
-- Part 3: specialist_profiles.reviewer
-- ---------------------------------------------------------------------------
--
-- Who made this specialist assessment (e.g. a name, or "club consensus") —
-- distinct from experience_source (HOW the knowledge was gained) and
-- confidence (how much to trust it). Nullable: existing/older profiles
-- simply have no reviewer on record.

alter table public.specialist_profiles add column if not exists reviewer text;

comment on column public.specialist_profiles.reviewer is 'Who made this assessment (a name, or e.g. "club consensus") — distinct from experience_source and confidence.';
