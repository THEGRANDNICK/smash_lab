-- Phase 1: Supabase backend foundation for Smash Lab.
--
-- Creates the four data tables (strings, inventory, specialist_profiles,
-- retailer_prices) plus admin_users, enables Row Level Security on all
-- five, and wires up public-read / admin-only-write policies via a
-- SECURITY DEFINER helper function.
--
-- IMPORTANT: applying this migration does NOT change the live website.
-- Nothing in src/ reads from or writes to these tables yet — the site
-- continues using src/data/strings.ts and
-- src/data/stringSpecialistProfiles.ts exactly as before. This migration
-- only creates the backend foundation for later phases.
--
-- Safe to re-run: tables use IF NOT EXISTS, functions use CREATE OR
-- REPLACE, and triggers/policies are dropped and recreated so this file
-- can be applied more than once without erroring.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.strings (
  id                  text primary key,
  brand               text not null,
  name                text not null,
  category            text not null,
  gauge_mm            numeric,
  repulsion           smallint not null,
  durability          smallint not null,
  hitting_sound       smallint not null,
  shock_absorption    smallint,
  control             smallint not null,
  string_cost_eur     numeric,
  description         text,
  tension_meta        jsonb,
  popularity_rank     smallint,
  product_url         text,
  image_url           text,
  colors              text[],
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint strings_category_check
    check (category in ('repulsion', 'control', 'durability')),
  constraint strings_repulsion_range
    check (repulsion between 0 and 11),
  constraint strings_durability_range
    check (durability between 0 and 11),
  constraint strings_hitting_sound_range
    check (hitting_sound between 0 and 11),
  constraint strings_shock_absorption_range
    check (shock_absorption is null or shock_absorption between 0 and 11),
  constraint strings_control_range
    check (control between 0 and 11),
  constraint strings_gauge_not_negative
    check (gauge_mm is null or gauge_mm >= 0),
  constraint strings_cost_not_negative
    check (string_cost_eur is null or string_cost_eur >= 0)

  -- Deliberately NOT adding a UNIQUE(brand, name) constraint: a single
  -- string name legitimately sometimes ships in more than one gauge or
  -- regional variant, and `id` is already the true unique catalog key.
  -- Blocking duplicate (brand, name) pairs here risks rejecting a
  -- legitimate future catalog entry for no real safety benefit.
);
comment on table public.strings is 'Permanent catalog data: ratings, description, pricing, links. Recommendation-algorithm inputs live in Git, not here.';

create table if not exists public.inventory (
  string_id       text primary key references public.strings(id) on delete cascade,
  stock_status    text not null default 'unavailable',
  quantity        integer,
  package_type    text not null default 'unknown',
  color           text,
  notes           text,
  updated_at      timestamptz not null default now(),

  constraint inventory_stock_status_check
    check (stock_status in ('in-stock', 'low-stock', 'unavailable')),
  constraint inventory_package_type_check
    check (package_type in ('reel', 'set', 'mixed', 'unknown')),
  constraint inventory_quantity_not_negative
    check (quantity is null or quantity >= 0)
);
comment on table public.inventory is 'Operational stock data, changes frequently. Presentation-only — never read by the recommendation algorithm. quantity is internal and must not be surfaced as an exact public count.';

create table if not exists public.specialist_profiles (
  string_id                   text primary key references public.strings(id) on delete cascade,
  feel                        text,
  personal_tension_min_kg     numeric,
  personal_tension_max_kg     numeric,
  experience_source           text not null,
  confidence                  text not null,
  dimensions                  jsonb not null default '{}'::jsonb,
  dimension_confidence        jsonb,
  strengths                   text[],
  weaknesses                  text[],
  specialist_tags             text[],
  subjective_notes            text,
  updated_at                  timestamptz not null default now(),

  constraint specialist_profiles_feel_check
    check (feel is null or feel in ('hard', 'medium', 'soft')),
  constraint specialist_profiles_experience_source_check
    check (experience_source in ('personal', 'club', 'stringing-observation', 'manufacturer', 'community', 'mixed')),
  constraint specialist_profiles_confidence_check
    check (confidence in ('very-high', 'high', 'medium', 'low', 'unknown')),
  constraint specialist_profiles_tension_min_positive
    check (personal_tension_min_kg is null or personal_tension_min_kg > 0),
  constraint specialist_profiles_tension_max_positive
    check (personal_tension_max_kg is null or personal_tension_max_kg > 0),
  constraint specialist_profiles_tension_min_le_max
    check (
      personal_tension_min_kg is null
      or personal_tension_max_kg is null
      or personal_tension_min_kg <= personal_tension_max_kg
    )

  -- dimensions / dimension_confidence are intentionally NOT validated key-
  -- by-key in SQL (that would mean hand-maintaining ~17 CHECK expressions
  -- in two places, in the DB and in the app). The admin form is the
  -- schema gatekeeper for those; see src/types/database.ts for the
  -- TypeScript shape both sides agree on.
);
comment on table public.specialist_profiles is 'Smash Lab''s own curated, provenance-tracked experience data. Never manufacturer claims. Recommendation WEIGHTING logic (specialistWeights.ts) stays in Git regardless of where this data lives.';

create table if not exists public.retailer_prices (
  id                      bigint generated always as identity primary key,
  string_id               text not null references public.strings(id) on delete cascade,
  retailer_name           text not null,
  retailer_product_url    text,
  set_price_eur           numeric,
  reel_price_eur          numeric,
  sale_price_eur          numeric,
  retailer_in_stock       boolean,
  last_checked_at         timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint retailer_prices_set_price_not_negative
    check (set_price_eur is null or set_price_eur >= 0),
  constraint retailer_prices_reel_price_not_negative
    check (reel_price_eur is null or reel_price_eur >= 0),
  constraint retailer_prices_sale_price_not_negative
    check (sale_price_eur is null or sale_price_eur >= 0),
  constraint retailer_prices_unique_per_retailer
    unique (string_id, retailer_name)
);
comment on table public.retailer_prices is 'Future feature (Phase 7) — created now for schema stability, not yet used by the website. Never affects recommendation scoring unless price is explicitly added as a quiz preference later.';

create table if not exists public.admin_users (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);
comment on table public.admin_users is 'Marks which Supabase Auth accounts may write to the tables above. No RLS policies are defined for this table on purpose — see the RLS section below. Only manage this table via the SQL editor / service role, never from the app.';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
comment on function public.set_updated_at() is 'Generic BEFORE UPDATE trigger: stamps updated_at with the current time on every row update.';

drop trigger if exists set_strings_updated_at on public.strings;
create trigger set_strings_updated_at
  before update on public.strings
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at
  before update on public.inventory
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_specialist_profiles_updated_at on public.specialist_profiles;
create trigger set_specialist_profiles_updated_at
  before update on public.specialist_profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_retailer_prices_updated_at on public.retailer_prices;
create trigger set_retailer_prices_updated_at
  before update on public.retailer_prices
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Baseline role grants
--
-- RLS policies restrict which ROWS a role can see/touch, but Postgres
-- still requires the underlying table-level GRANT before RLS is even
-- consulted — without these, anon/authenticated would be refused access
-- entirely regardless of how permissive the policies below are. Supabase
-- projects are typically pre-configured with schema-level default
-- privileges that would cover this automatically, but granting explicitly
-- here makes this migration correct and self-contained on its own,
-- without depending on that assumption. admin_users intentionally gets no
-- grants at all — see the RLS section below.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.strings, public.inventory, public.specialist_profiles, public.retailer_prices
  to anon, authenticated;

grant insert, update, delete on public.strings, public.inventory, public.specialist_profiles, public.retailer_prices
  to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-check helper
--
-- SECURITY DEFINER so it can read admin_users even though admin_users has
-- no RLS policies granting read access to anyone — this is what lets the
-- four data tables' policies check admin status WITHOUT admin_users
-- itself ever needing to be readable by authenticated/anon roles (which
-- would otherwise let any logged-in user enumerate admin UUIDs).
--
-- `set search_path = ''` + fully-qualified `public.admin_users` and
-- `auth.uid()` closes the classic SECURITY DEFINER search_path-hijacking
-- hole (a user-owned schema earlier in search_path shadowing admin_users
-- with a fake table). `stable` allows the planner to cache the result
-- within a single statement/transaction — this function only reads data,
-- never writes.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;
comment on function public.is_admin() is 'True if the currently-authenticated user (auth.uid()) is present in admin_users. Used by RLS write policies on strings/inventory/specialist_profiles/retailer_prices.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.strings enable row level security;
alter table public.inventory enable row level security;
alter table public.specialist_profiles enable row level security;
alter table public.retailer_prices enable row level security;
alter table public.admin_users enable row level security;
-- No policies are created for admin_users below — with RLS enabled and
-- zero policies, Postgres denies ALL access to anon and authenticated by
-- default. Only the service role (which bypasses RLS entirely) or the
-- is_admin() SECURITY DEFINER function above can read it. This is
-- intentional, not an oversight.

-- strings: public read, admin-only write
drop policy if exists "public read access" on public.strings;
create policy "public read access" on public.strings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert" on public.strings;
create policy "admin insert" on public.strings
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.strings;
create policy "admin update" on public.strings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete" on public.strings;
create policy "admin delete" on public.strings
  for delete
  to authenticated
  using (public.is_admin());

-- inventory: public read, admin-only write
drop policy if exists "public read access" on public.inventory;
create policy "public read access" on public.inventory
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert" on public.inventory;
create policy "admin insert" on public.inventory
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.inventory;
create policy "admin update" on public.inventory
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete" on public.inventory;
create policy "admin delete" on public.inventory
  for delete
  to authenticated
  using (public.is_admin());

-- specialist_profiles: public read, admin-only write
drop policy if exists "public read access" on public.specialist_profiles;
create policy "public read access" on public.specialist_profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert" on public.specialist_profiles;
create policy "admin insert" on public.specialist_profiles
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.specialist_profiles;
create policy "admin update" on public.specialist_profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete" on public.specialist_profiles;
create policy "admin delete" on public.specialist_profiles
  for delete
  to authenticated
  using (public.is_admin());

-- retailer_prices: public read, admin-only write
drop policy if exists "public read access" on public.retailer_prices;
create policy "public read access" on public.retailer_prices
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert" on public.retailer_prices;
create policy "admin insert" on public.retailer_prices
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.retailer_prices;
create policy "admin update" on public.retailer_prices
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete" on public.retailer_prices;
create policy "admin delete" on public.retailer_prices
  for delete
  to authenticated
  using (public.is_admin());
