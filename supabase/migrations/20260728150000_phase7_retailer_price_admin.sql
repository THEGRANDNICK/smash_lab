-- Phase 7: retailer price administration.
--
-- Part 1 of this phase (done before writing this file) reviewed the
-- EXISTING public.retailer_prices table, created in Phase 1 for "schema
-- stability, not yet used by the website" (see its comment in
-- 20260727123901_initial_schema.sql). It was genuinely never read or
-- written by any application code — confirmed by searching src/ and
-- scripts/ — so this migration is free to restructure it, but still does
-- so via an explicit, data-preserving conversion rather than a drop, in
-- case a real project already has rows in it.
--
-- EXISTING SCHEMA FOUND (before this migration):
--   id                      bigint generated always as identity primary key
--   string_id               text not null references public.strings(id) on delete cascade
--   retailer_name           text not null
--   retailer_product_url    text
--   set_price_eur           numeric
--   reel_price_eur          numeric
--   sale_price_eur          numeric
--   retailer_in_stock       boolean
--   last_checked_at         timestamptz
--   created_at              timestamptz not null default now()
--   updated_at              timestamptz not null default now() (+ trigger)
--   constraints: set/reel/sale price >= 0 if not null; unique(string_id, retailer_name)
--   RLS: public read, admin-only insert/update/delete (already correct, unchanged)
--   grants: already correct for anon/authenticated (from Phase 1), unchanged
--
-- FINAL MODEL (this migration, revised before ever being applied anywhere —
-- this file was rewritten in place rather than layered under a Phase 8,
-- since Phase 7 had not yet been installed or pushed): retailers are
-- reusable entities, not free text repeated on every listing. Two tables:
--   public.retailers        — retailer-level metadata (name, logo, website,
--                              country, active) — one row per real retailer.
--   public.retailer_prices  — one row per listing (a retailer selling one
--                              string in one package) — references
--                              retailers(id) instead of storing a name.
--
-- WHY: the original three-price-column shape bakes "package type" into
-- set_price_eur/reel_price_eur/sale_price_eur — one row can't represent an
-- arbitrary listing. Fixing that (Phase 7's first draft) still left
-- retailer_name as a free-text string repeated on every listing row, which
-- duplicates retailer-level metadata (name, logo, website, country) across
-- however many listings that retailer has, and admits typo'd near-duplicate
-- retailers with no way to manage them (deactivate, correct a logo URL,
-- etc.) as first-class entities.
--
-- DOES NOT modify 20260727123901_initial_schema.sql or
-- 20260728090000_phase6_decimal_ratings_hybrid_reviewer.sql. Additive only.
-- Preserves string ids, inventory, specialist_profiles, admin_users —
-- none of those tables are touched here at all.
--
-- DATA PRESERVATION (two-stage conversion, both stages idempotent/guarded):
--   Stage A — legacy price columns -> the flat, single-price-per-row shape.
--     A row's set_price_eur (if present) becomes its new package_type =
--     'set' / price; if reel_price_eur is ALSO present on the same row, a
--     second row is inserted for it (package_type = 'reel') since one
--     listing can no longer hold two package prices. sale_price_eur (a
--     price TIER, not a package type) is preserved as its own 'other'-typed
--     row with a note explaining its origin, rather than silently discarded
--     or misfiled as a package type it never was. retailer_in_stock
--     converts to availability_status ('in_stock' / 'out_of_stock' /
--     'unknown'). Guarded on set_price_eur still existing, so a second run
--     of this file no-ops this stage.
--   Stage B — retailer_name (now flat text on every row from Stage A) ->
--     normalized public.retailers + retailer_id. Every distinct retailer
--     name (case-insensitively) becomes exactly one retailers row (reused
--     across every listing that already named it); every retailer_prices
--     row is then linked via retailer_id. Guarded on retailer_name still
--     existing, so a second run of this file no-ops this stage too.

-- ---------------------------------------------------------------------------
-- Stage A, Step 1: add the new columns, nullable — existing rows must not
-- be blocked before the backfill below has a chance to populate them.
-- ---------------------------------------------------------------------------

alter table public.retailer_prices add column if not exists price numeric;
alter table public.retailer_prices add column if not exists currency text;
alter table public.retailer_prices add column if not exists availability_status text;
alter table public.retailer_prices add column if not exists package_type text;
alter table public.retailer_prices add column if not exists package_length_m numeric;
alter table public.retailer_prices add column if not exists is_preferred boolean;
alter table public.retailer_prices add column if not exists notes text;

-- The OLD unique(string_id, retailer_name) constraint must be dropped
-- BEFORE the backfill below, not after: a legacy row with more than one
-- of set/reel/sale_price_eur populated needs to become more than one row
-- for the SAME (string_id, retailer_name) pair, which the old constraint
-- would otherwise reject mid-backfill (caught by local integration
-- testing — a row with all three legacy prices set failed here until
-- this drop was moved ahead of the backfill). The new, correct uniqueness
-- rule (keyed on retailer_id, not retailer_name) is created fresh in
-- Stage B, once every row has been linked to a real retailer.
alter table public.retailer_prices drop constraint if exists retailer_prices_unique_per_retailer;

-- ---------------------------------------------------------------------------
-- Stage A, Step 2: one-time backfill from the legacy price/stock columns,
-- guarded so it only ever runs against a table that still has them
-- (idempotent re-run safe).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'retailer_prices' and column_name = 'set_price_eur'
  ) then
    for r in select * from public.retailer_prices loop
      declare
        primary_used boolean := false;
        avail text := case
          when r.retailer_in_stock is true then 'in_stock'
          when r.retailer_in_stock is false then 'out_of_stock'
          else 'unknown'
        end;
      begin
        -- 'set' price, if present, claims the original row.
        if r.set_price_eur is not null then
          update public.retailer_prices
            set price = r.set_price_eur, currency = 'EUR', package_type = 'set', availability_status = avail
            where id = r.id;
          primary_used := true;
        end if;

        -- 'reel' price: claims the original row if 'set' didn't, else becomes a new row.
        if r.reel_price_eur is not null then
          if not primary_used then
            update public.retailer_prices
              set price = r.reel_price_eur, currency = 'EUR', package_type = 'reel', availability_status = avail
              where id = r.id;
            primary_used := true;
          else
            insert into public.retailer_prices
              (string_id, retailer_name, retailer_product_url, price, currency, package_type, availability_status, last_checked_at, created_at)
            values
              (r.string_id, r.retailer_name, r.retailer_product_url, r.reel_price_eur, 'EUR', 'reel', avail, r.last_checked_at, r.created_at);
          end if;
        end if;

        -- sale_price_eur was a price TIER (a discount), never a package type — preserved
        -- as its own 'other'-typed row with a note, rather than mislabeled as a package.
        if r.sale_price_eur is not null then
          if not primary_used then
            update public.retailer_prices
              set price = r.sale_price_eur, currency = 'EUR', package_type = 'other', availability_status = avail,
                  notes = 'Migrated from the legacy sale_price_eur column (a discounted price tier, not a distinct package type) during the Phase 7 retailer-model migration.'
              where id = r.id;
            primary_used := true;
          else
            insert into public.retailer_prices
              (string_id, retailer_name, retailer_product_url, price, currency, package_type, availability_status, notes, last_checked_at, created_at)
            values
              (r.string_id, r.retailer_name, r.retailer_product_url, r.sale_price_eur, 'EUR', 'other', avail,
               'Migrated from the legacy sale_price_eur column (a discounted price tier, not a distinct package type) during the Phase 7 retailer-model migration.',
               r.last_checked_at, r.created_at);
          end if;
        end if;

        -- A row with all three legacy prices null (e.g. only in-stock status was ever
        -- tracked) still needs its availability/currency/package_type set.
        if not primary_used then
          update public.retailer_prices
            set currency = 'EUR', package_type = 'other', availability_status = avail
            where id = r.id;
        end if;
      end;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Stage A, Step 3: fill in defaults for any column still null (fresh
-- installs have zero rows, so this is a no-op there; a re-run also no-ops
-- since nothing is null anymore), then lock in NOT NULL + CHECK constraints.
-- ---------------------------------------------------------------------------

update public.retailer_prices set currency = 'EUR' where currency is null;
update public.retailer_prices set availability_status = 'unknown' where availability_status is null;
update public.retailer_prices set package_type = 'other' where package_type is null;
update public.retailer_prices set is_preferred = false where is_preferred is null;

alter table public.retailer_prices alter column currency set default 'EUR';
alter table public.retailer_prices alter column currency set not null;
alter table public.retailer_prices alter column availability_status set default 'unknown';
alter table public.retailer_prices alter column availability_status set not null;
alter table public.retailer_prices alter column package_type set default 'other';
alter table public.retailer_prices alter column package_type set not null;
alter table public.retailer_prices alter column is_preferred set default false;
alter table public.retailer_prices alter column is_preferred set not null;

-- price and package_length_m stay nullable — a listing may be tracked
-- (e.g. "discontinued", "out of stock") before a price or a known package
-- length is confirmed.

alter table public.retailer_prices drop constraint if exists retailer_prices_price_not_negative;
alter table public.retailer_prices add constraint retailer_prices_price_not_negative
  -- Unbounded `numeric`, not numeric(10,2): a declared-scale column rounds
  -- an over-precise value on assignment BEFORE this CHECK ever runs (found
  -- and fixed the same way in Phase 6's rating columns, and re-confirmed
  -- directly for this table by local integration testing), which would
  -- make `price = round(price, 2)` a no-op. Unbounded numeric stores the
  -- value exactly as given, so this genuinely rejects e.g. 9.999.
  check (price is null or (price >= 0 and price = round(price, 2)));

alter table public.retailer_prices drop constraint if exists retailer_prices_currency_check;
alter table public.retailer_prices add constraint retailer_prices_currency_check
  -- EUR only for now ("EUR is the main currency" — no conversion is ever
  -- performed). Adding a currency later is a one-line additive migration:
  -- widen this IN list (and the matching app-level RETAILER_CURRENCIES
  -- constant) — the column itself never needs to change shape.
  check (currency in ('EUR'));

alter table public.retailer_prices drop constraint if exists retailer_prices_availability_status_check;
alter table public.retailer_prices add constraint retailer_prices_availability_status_check
  check (availability_status in ('in_stock', 'low_stock', 'out_of_stock', 'preorder', 'discontinued', 'unknown'));

alter table public.retailer_prices drop constraint if exists retailer_prices_package_type_check;
alter table public.retailer_prices add constraint retailer_prices_package_type_check
  check (package_type in ('set', 'reel', 'hybrid', 'other'));

alter table public.retailer_prices drop constraint if exists retailer_prices_package_length_positive;
alter table public.retailer_prices add constraint retailer_prices_package_length_positive
  check (package_length_m is null or package_length_m > 0);

-- ---------------------------------------------------------------------------
-- Stage A, Step 4: drop the legacy price/stock columns now that their data
-- has been carried forward above (the old unique(string_id, retailer_name)
-- constraint they were tied to was already dropped in Step 1).
-- retailer_name and retailer_product_url are deliberately kept for now —
-- Stage B below still needs retailer_name to build public.retailers, and
-- retailer_product_url is renamed (not dropped) once retailer-level
-- metadata has its own table to live in.
-- ---------------------------------------------------------------------------

alter table public.retailer_prices drop constraint if exists retailer_prices_set_price_not_negative;
alter table public.retailer_prices drop constraint if exists retailer_prices_reel_price_not_negative;
alter table public.retailer_prices drop constraint if exists retailer_prices_sale_price_not_negative;

alter table public.retailer_prices drop column if exists set_price_eur;
alter table public.retailer_prices drop column if exists reel_price_eur;
alter table public.retailer_prices drop column if exists sale_price_eur;
alter table public.retailer_prices drop column if exists retailer_in_stock;

-- ---------------------------------------------------------------------------
-- Stage B, Step 1: create public.retailers — retailer-level metadata,
-- shared across every listing that retailer has, instead of repeated text
-- on every row.
-- ---------------------------------------------------------------------------

create table if not exists public.retailers (
  id           bigint generated always as identity primary key,
  name         text not null,
  logo_url     text,
  website_url  text,
  -- ISO 3166-1 alpha-2, uppercase, when known — a "controlled format"
  -- without hardcoding an exhaustive country list at the database level
  -- (the app layer can still present a proper dropdown of real countries;
  -- this CHECK only guards the shape of whatever value reaches the DB).
  country      text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint retailers_name_not_blank check (length(btrim(name)) > 0),
  constraint retailers_country_format check (country is null or country ~ '^[A-Z]{2}$')
);
comment on table public.retailers is 'Reusable retailer entities (name, logo, website, country, active) — one row per real retailer, referenced by many public.retailer_prices listings. Presentation-only — never read by the recommendation algorithm.';
comment on column public.retailers.active is 'Inactive retailers keep their existing listings (visible/editable in the admin) but those listings are hidden from the public site, and the retailer cannot be assigned to a NEW listing until reactivated.';
comment on column public.retailers.country is 'ISO 3166-1 alpha-2 (e.g. "DE", "IE"), or null if unknown.';

-- Case-insensitive uniqueness: "Amazon" and "amazon" are the same retailer.
drop index if exists public.retailers_unique_name;
create unique index retailers_unique_name on public.retailers (lower(name));

drop trigger if exists set_retailers_updated_at on public.retailers;
create trigger set_retailers_updated_at
  before update on public.retailers
  for each row
  execute function public.set_updated_at();

grant select on public.retailers to anon, authenticated;
grant insert, update, delete on public.retailers to authenticated;

alter table public.retailers enable row level security;

drop policy if exists "public read access" on public.retailers;
create policy "public read access" on public.retailers
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin insert" on public.retailers;
create policy "admin insert" on public.retailers
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin update" on public.retailers;
create policy "admin update" on public.retailers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete" on public.retailers;
create policy "admin delete" on public.retailers
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Stage B, Step 2: backfill public.retailers from retailer_prices'
-- (still-present) retailer_name column, then link every listing via
-- retailer_id. Guarded on retailer_name still existing, so re-applying
-- this file is a no-op here on a second run.
-- ---------------------------------------------------------------------------

alter table public.retailer_prices add column if not exists retailer_id bigint references public.retailers(id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'retailer_prices' and column_name = 'retailer_name'
  ) then
    -- One retailers row per distinct name, case-insensitively — the
    -- earliest (lowest id) listing's exact casing wins as the canonical
    -- display name, deterministically.
    insert into public.retailers (name)
    select distinct on (lower(btrim(retailer_name))) btrim(retailer_name)
    from public.retailer_prices
    order by lower(btrim(retailer_name)), id
    on conflict (lower(name)) do nothing;

    update public.retailer_prices rp
    set retailer_id = r.id
    from public.retailers r
    where lower(r.name) = lower(btrim(rp.retailer_name)) and rp.retailer_id is null;
  end if;
end $$;

alter table public.retailer_prices alter column retailer_id set not null;

-- retailer_product_url is listing-level (this specific product page), not
-- retailer-level (that lives on retailers.website_url now) — renamed, not
-- dropped, so its data survives.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'retailer_prices' and column_name = 'retailer_product_url'
  ) then
    alter table public.retailer_prices rename column retailer_product_url to product_url;
  end if;
end $$;

alter table public.retailer_prices drop column if exists retailer_name;

-- ---------------------------------------------------------------------------
-- Stage B, Step 2.5: resolve any collisions the case-insensitive retailer
-- merge above just exposed.
--
-- The OLD schema's unique(string_id, retailer_name) was case-SENSITIVE, so
-- "RetailerA" and "retailera" could each have their own "set" listing for
-- the same string, coexisting as two "different" retailers. Once merged
-- into one real retailers row (Stage B, Step 2), those become two listings
-- for the exact same (string_id, retailer_id, package_type, length) —
-- exactly what the new unique index exists to prevent. This is a genuine
-- ambiguous data conflict (which price is "correct"?), not something that
-- can be silently guessed at — so rather than pick one and silently drop
-- the other, every losing row's price/availability/last-checked data is
-- appended to the kept row's notes as an auditable merge record before
-- being deleted. The most recently updated row in each colliding group is
-- kept (most likely to be current); ties broken by highest id.
-- ---------------------------------------------------------------------------

do $$
declare
  grp record;
  keep_id bigint;
  loser record;
  merged_note text;
begin
  for grp in
    select string_id, retailer_id, package_type, coalesce(package_length_m, -1) as length_key
    from public.retailer_prices
    group by string_id, retailer_id, package_type, coalesce(package_length_m, -1)
    having count(*) > 1
  loop
    select id into keep_id
    from public.retailer_prices
    where string_id = grp.string_id and retailer_id = grp.retailer_id and package_type = grp.package_type
      and coalesce(package_length_m, -1) = grp.length_key
    order by updated_at desc, id desc
    limit 1;

    merged_note := '';
    for loser in
      select * from public.retailer_prices
      where string_id = grp.string_id and retailer_id = grp.retailer_id and package_type = grp.package_type
        and coalesce(package_length_m, -1) = grp.length_key
        and id <> keep_id
    loop
      merged_note := merged_note
        || format(
             'Merged duplicate listing (id %s) during the Phase 7 retailer-normalization case-insensitive merge: price=%s, availability=%s, last_checked_at=%s. ',
             loser.id, coalesce(loser.price::text, 'null'), loser.availability_status, coalesce(loser.last_checked_at::text, 'null')
           );
    end loop;

    if merged_note <> '' then
      update public.retailer_prices set notes = btrim(coalesce(notes || ' ', '') || merged_note) where id = keep_id;
      delete from public.retailer_prices
      where string_id = grp.string_id and retailer_id = grp.retailer_id and package_type = grp.package_type
        and coalesce(package_length_m, -1) = grp.length_key
        and id <> keep_id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stage B, Step 3: uniqueness rule, now keyed on retailer_id instead of
-- retailer_name — same reasoning as before (a retailer selling a set AND a
-- reel, or two different reel lengths, are legitimate distinct listings;
-- coalesce(...,-1) still closes the "two unknown-length listings" hole
-- since plain UNIQUE treats every NULL as distinct from every other NULL).
-- ---------------------------------------------------------------------------

drop index if exists public.retailer_prices_unique_listing;
create unique index retailer_prices_unique_listing
  on public.retailer_prices (string_id, retailer_id, package_type, coalesce(package_length_m, -1));

-- ---------------------------------------------------------------------------
-- Stage B, Step 4: indexes for listing/filtering/joins (Postgres does not
-- automatically index a foreign-key column).
-- ---------------------------------------------------------------------------

create index if not exists retailer_prices_string_id_idx on public.retailer_prices (string_id);
create index if not exists retailer_prices_retailer_id_idx on public.retailer_prices (retailer_id);
create index if not exists retailer_prices_availability_idx on public.retailer_prices (availability_status);
-- Partial index: only preferred rows are ever queried together (admin's
-- preferred-conflict diagnostic, and the public site's "show preferred
-- first" lookup), so a full index would just waste space on the common
-- is_preferred = false case.
create index if not exists retailer_prices_preferred_idx on public.retailer_prices (string_id) where is_preferred;

-- ---------------------------------------------------------------------------
-- Column comments
-- ---------------------------------------------------------------------------

comment on column public.retailer_prices.retailer_id is 'References public.retailers(id) — retailer-level metadata (name, logo, website, country, active) lives there, not repeated on every listing.';
comment on column public.retailer_prices.product_url is 'This specific listing''s product page — distinct from retailers.website_url (the retailer''s general site). Used for the public "Buy" link.';
comment on column public.retailer_prices.price is 'The listing''s price in `currency`, or null if not yet confirmed (e.g. a tracked-but-unpriced or discontinued listing). Never a recommendation input.';
comment on column public.retailer_prices.currency is 'ISO 4217 code. EUR only for now (no currency conversion is ever performed) — see the CHECK constraint for how to add another currency later.';
comment on column public.retailer_prices.availability_status is 'One of: in_stock, low_stock, out_of_stock, preorder, discontinued, unknown. Never a recommendation input.';
comment on column public.retailer_prices.package_type is 'One of: set, reel, hybrid, other. Distinct from the string''s own technical gauge/hybrid metadata on public.strings — this describes what the RETAILER is selling, not the string''s construction.';
comment on column public.retailer_prices.package_length_m is 'Package length in metres, when known (e.g. a 200m reel). Null for a standard set or when the length is not confirmed.';
comment on column public.retailer_prices.is_preferred is 'Admin-curated "show this first" flag for a string''s purchase options. Display ordering only — never affects recommendation scoring.';
comment on column public.retailer_prices.notes is 'Optional free-text admin notes about this listing.';
comment on table public.retailer_prices is 'Operational retailer/pricing content — one row per retailer listing (a retailer can have multiple rows per string: set, reel, different lengths, etc.). References public.retailers instead of storing retailer metadata inline. Presentation-only — never read by the recommendation algorithm.';

-- retailer_prices' FK to retailers is deliberately left as the default NO
-- ACTION (not ON DELETE CASCADE, unlike its FK to strings): a retailer
-- with existing listings must not silently lose them (or worse, silently
-- delete them) just because someone deleted the retailer entity. Deleting
-- a retailer that still has listings fails at the database level; the
-- admin UI checks for this first and surfaces a friendly message,
-- steering towards deactivating the retailer instead.
