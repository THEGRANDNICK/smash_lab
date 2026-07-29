# Smash Lab Stringing

Badminton stringing service site with an interactive "Find Your Perfect String" quiz that recommends a string + tension setup, plus a full browsable string comparison catalog.

Stack: **Vite + React + TypeScript + Tailwind CSS v4 + Framer Motion**. No backend — everything runs client-side from a couple of local data/config files.

## Running the project

```bash
npm install
npm run dev       # start local dev server
npm run build     # type-check + production build to dist/
npm run lint      # oxlint
npm run preview   # preview the production build
```

## Where things live

```
src/
  data/
    strings.ts          # Local string catalog — see "Catalog loading (Phase 4)" below: this is now the fallback/reference, not the live source when Supabase is configured
    quizQuestions.ts     # quiz copy: question text, options, emoji
  config/
    recommendationWeights.ts  # how each quiz answer nudges the string-matching score
    tensionRules.ts           # base tension ranges, goal/feel adjustments, safety margins
  logic/
    recommendationEngine.ts   # scores every string against a player's answers (pure functions)
    tensionRecommendation.ts  # tension math, separate from string scoring
    pricing.ts                # €15 service fee + string cost → total
    units.ts                  # kg ⇄ lbs conversion
  components/
    StringFinder.tsx          # quiz orchestrator (steps, back/forward, phases)
    QuizQuestion.tsx           # generic single-select question card
    TensionInputStep.tsx       # numeric tension entry w/ unit toggle
    CalculatingAnimation.tsx
    RecommendationResult.tsx   # the final "match card" reveal
    StringCard.tsx / StatBars.tsx / StockBadge.tsx
    StringComparison.tsx       # filterable browse-all-strings page
    Hero.tsx, HowItWorks.tsx, PricingSection.tsx, WhyUs.tsx, FAQ.tsx, Contact.tsx, Nav.tsx, Footer.tsx
```

## Editing things later

- **Add/remove a string, change stock or price**: if Supabase isn't configured yet, edit the array in `src/data/strings.ts` — cards, filters, the quiz, and pricing all read from this one file, and nothing else needs touching. **Once Supabase is configured (Phase 4+), the live site reads the catalog from `public.strings` instead** — see "Catalog loading (Phase 4)" below; editing `strings.ts` alone no longer changes what visitors see except as a fallback.
- **Change the €15 service fee**: `STRINGING_SERVICE_FEE` in `src/logic/pricing.ts`.
- **Tune how quiz answers affect string recommendations**: `src/config/recommendationWeights.ts` — every answer maps to small +/- nudges across five dimensions (repulsion, durability, hitting sound, shock absorption, control). Bigger number = stronger pull toward strings that score well there.
- **Tune tension logic**: `src/config/tensionRules.ts` — base ranges per level, nudges for stated goal/current-tension feel, safety margins.
- **Add a new quiz question**: add it to `src/data/quizQuestions.ts`, add its id to the step list in `src/components/StringFinder.tsx` (`buildSteps`), and add scoring contributions in `recommendationWeights.ts` if it should affect the match.
- **Contact details**: `src/components/Contact.tsx` — currently placeholder info.

## Assumptions made

- Contact info (WhatsApp/email/location/Instagram) is placeholder — swap in `Contact.tsx`.
- Availability nudges ranking (in-stock > low-stock > unavailable) but never overrides a clearly better performance match by more than a few points, per the spec.
- No price weighting is baked into the match score itself, so expensive strings never get an automatic edge — the "worth considering" third pick can surface a cheaper alternative when it's a meaningfully different fit.
- Tension is stored internally in kg everywhere and converted to lbs only for display.

## Supabase Backend Setup

**Phase 1 status**: this section documents the Supabase *backend foundation* — a database schema, Row Level Security, and a typed client. **The live website does not use any of it yet.** The quiz, catalog, and recommendation engine all still read `src/data/strings.ts` and `src/data/stringSpecialistProfiles.ts` exactly as before. This phase exists purely so later phases (starting with Phase 2, which moves inventory reads to Supabase) have a secure, tested backend to build on — nothing here changes what visitors see today.

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project (the free tier is sufficient — see the architecture discussion earlier in this project's history for free-tier limits). No credit card is required.

### 2. Find your Project URL and anon key

In the Supabase dashboard: **Project Settings → API**. You need:
- **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
- **anon / public** key (a long JWT-looking string — this is safe to put in frontend code by design; see the security note below)

Do **not** copy the `service_role` key into this section — that one is server-side only, see step 9.

### 3–4. Configure your local environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

`.env.local` is gitignored — it will never be committed.

### 5. Apply the database migration

The schema lives in `supabase/migrations/20260727123901_initial_schema.sql`. Two ways to apply it — pick whichever is easier:

**Option A — Supabase CLI** (recommended if you're comfortable with it):
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # found in your project's URL/settings
npx supabase db push
```

**Option B — SQL Editor** (no CLI install needed):
1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Paste the entire contents of `supabase/migrations/20260727123901_initial_schema.sql`.
3. Run it.

The migration is safe to re-run if you ever need to (tables use `IF NOT EXISTS`, policies/triggers are dropped and recreated).

### 6. Create your admin Auth user

**Authentication → Users → Add user** in the dashboard. Use your own email and a password you'll remember — this is the one account that will eventually be able to write data through the future `/admin` page.

### 7. Disable public sign-ups

**Authentication → Providers → Email**, turn off "Allow new users to sign up". This is a personal single-admin site — nobody else should be able to register an account at all.

### 8. Grant your account admin access

Copy your new user's UUID from **Authentication → Users**, then run this in the SQL Editor:

```sql
INSERT INTO public.admin_users (user_id)
VALUES ('YOUR-AUTH-USER-UUID');
```

Until a row exists here for your account, `is_admin()` returns false for everyone — including you — and every write is rejected. This table has no admin-facing UI on purpose; it's managed directly in SQL.

### 9. Never expose the service-role key

The `service_role` key **bypasses Row Level Security entirely**. It must never be:
- prefixed with `VITE_` (Vite inlines every `VITE_`-prefixed variable into the browser bundle)
- imported from anything under `src/`
- committed anywhere

It's only ever used by local, one-off, server-side scripts (e.g. a future migration script) run directly with Node — see the commented-out `SUPABASE_SERVICE_ROLE_KEY` line in `.env.example`.

### 10. What's implemented so far

**Phase 1** — backend foundation:
- ✅ Database schema (`strings`, `inventory`, `specialist_profiles`, `retailer_prices`, `admin_users`), with Row Level Security enforcing public-read / admin-only-write on the four data tables.
- ✅ A typed Supabase client (`src/lib/supabase.ts`) and auth helpers (`src/lib/auth.ts`).

**Phase 2** — inventory goes live:
- ✅ `src/services/inventoryService.ts` + `src/hooks/useStringPool.ts` (renamed in Phase 4, see below): the site fetches inventory from Supabase on load and merges it onto the catalog, falling back silently (with a console warning) to `strings.ts`'s own local stock values if Supabase is unreachable or not configured. The recommendation engine, catalog data, and specialist profiles are completely unaffected — only the `stock` value shown/used for badges and "Best Available Alternative" can now come from Supabase.
- ✅ `scripts/migrateInventory.ts` (`npm run migrate:inventory`): one-time, idempotent backfill of `public.inventory` from `strings.ts`'s current values.
- ✅ `/debug/supabase` (dev-only, see below).

**Phase 3** — authenticated inventory admin:
- ✅ `/admin` — a login-gated admin area (see "Admin area" below) for editing inventory (`stock_status`, `quantity`, `package_type`, `color`, `notes`) directly against Supabase, protected by real Supabase Auth + Row Level Security.

**Phase 4** — catalog goes live (see "Catalog loading" below for full detail):
- ✅ The public site's catalog (brand, name, category, ratings, gauge, cost, description, tension metadata, popularity rank, product/image URLs, colors) now loads from `public.strings`, with `strings.ts` retained as the validated fallback/rollback reference — not the normal live source anymore.
- ✅ `src/services/catalogService.ts`: fetches, validates, and orders the live catalog; falls back to the complete local catalog (never a partial mix) if Supabase is unreachable, misconfigured, returns zero rows, contains invalid rows, or is missing any string `strings.ts` knows about.

**Phase 5** — catalog administration (see "Catalog administration" below for full detail):
- ✅ `#admin/catalog` — create, edit, and delete `public.strings` rows directly from the admin UI, alongside the existing inventory editor at `#admin/inventory`.
- ✅ Creating a string automatically creates a matching default inventory row (with a best-effort rollback of the string if that second write fails), so a new string is immediately editable from the inventory tab too. Deleting a string cascades to its inventory row at the database level.
- ❌ Specialist-profile editing and retailer-price administration are still not implemented — Phase 6+.

**Phase 6** — decimal ratings, hybrid strings & specialist profile administration (see "Decimal ratings, hybrid strings & specialist profiles" below for full detail):
- ✅ Manufacturer ratings (repulsion, durability, control, hitting sound, shock absorption) now accept decimals (e.g. `9.5`) at one decimal place, both in `public.strings` (unbounded `numeric` with a `CHECK` constraint enforcing the precision) and in the admin form.
- ✅ Hybrid strings (e.g. Yonex AeroBite) are now modeled explicitly (`is_hybrid`, `main_string_meta`, `cross_string_meta`) and display as "0.67 / 0.61 mm" on the public catalog, comparison page, and admin catalog card.
- ✅ Specialist profiles now load from `public.specialist_profiles`, with `src/data/stringSpecialistProfiles.ts` retained as the fallback — same live-with-local-fallback pattern as inventory/catalog.
- ✅ `#admin/specialists` — create, edit, and clear a string's specialist profile directly from the admin UI, alongside `#admin/inventory` and `#admin/catalog`.
- ✅ The recommendation engine itself was **not modified** beyond accepting its existing inputs (ratings, specialist profile) as parameters instead of hardcoded imports — see "Recommendation engine isolation" below.
- ❌ Retailer-price administration, image uploads, and per-dimension confidence overrides in the editor are still not implemented — Phase 7+.

**Phase 7** — retailer price administration & purchase options, with retailers as first-class, reusable entities (see "Retailer prices & purchase options" below for full detail):
- ✅ Two normalized tables: `public.retailers` (name, logo, website, country, active — one row per real retailer) and `public.retailer_prices` (one row per listing, referencing `retailer_id` instead of storing a retailer name). `public.retailer_prices`'s original Phase 1 shape (three baked-in price columns: set/reel/sale, plus a free-text retailer name) is converted via an additive, data-preserving migration — including deduplicating retailer names case-insensitively into single `retailers` rows.
- ✅ Retailer + listing data loads from Supabase (`src/services/retailerService.ts` for retailer entities, `src/services/retailerPriceService.ts` for listings, joined together); there is no local fallback dataset (none existed to fall back to) — a failed fetch simply shows no purchase options anywhere, the rest of the site is unaffected.
- ✅ `#admin/retailers` (retailer entities: create, edit, deactivate/reactivate, delete-when-safe) and `#admin/retailer-listings` (listings: create, edit, delete, selecting an existing retailer rather than typing a name) — alongside `#admin/inventory`, `#admin/catalog`, and `#admin/specialists`.
- ✅ Deactivating a retailer hides all of its listings from the public site (verified directly) while keeping them fully visible and editable in the admin — the retailer and its listings are never deleted by deactivation.
- ✅ Purchase options now appear (collapsed by default) on catalog cards and the quiz's Best Match card: retailer logo (with a safe fallback if missing/broken), retailer name, price, package, availability, and a safe external buy link.
- ✅ The recommendation engine itself has **no retailer parameter at all** — retailer data was never wired into it, so there was nothing to isolate beyond keeping it that way. See "Recommendation isolation proof" below.
- ❌ Retailer-price administration is done; image uploads and per-dimension specialist confidence overrides are still not implemented — Phase 8+.

Run `npm run verify:supabase` and `npm run verify:catalog` (after filling in `.env.local`) to confirm your project matches what these phases expect — see "Verifying your setup" below.

**Important — GitHub Pages build step**: Vite inlines `VITE_`-prefixed env vars *at build time* and tree-shakes the entire Supabase client out of the bundle if they're unset, so the deployed site needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` available to the GitHub Actions build step, not just in your local `.env.local`. `.github/workflows/deploy.yml` reads them from repository **variables** (Settings → Secrets and variables → Actions → Variables tab, same place as the earlier Google Sheets discussion) — until you add those two variables, the deployed site simply keeps using `strings.ts`'s local values (safe, just not live), and the admin area shows a "not configured" state instead of a login form.

### 11. Admin area

**URL**: `/#admin` (e.g. `https://<your-username>.github.io/smash_lab/#admin`, or `http://localhost:5173/#admin` in dev) — redirects into `#admin/inventory` by default. There's also `#admin/catalog`, `#admin/specialists`, `#admin/retailers`, and `#admin/retailer-listings`. All five work with GitHub Pages' `/smash_lab/` base path and survive a direct navigation or a page refresh, since routing is hash-based like the rest of the site. None is linked from the site's navigation — the URL itself is the only way in. **This is a convenience, not a security boundary**: nothing about the admin area's protection depends on the route being hard to find. The real protection is Supabase Auth (you must sign in) plus Row Level Security (your account must additionally be listed in `public.admin_users`, checked server-side via the `is_admin()` function — the browser never queries `admin_users` directly).

**Logging in**: enter the email/password of a Supabase Auth user (the one you created in step 6 above). There's no sign-up form and no password reset in this UI — both are intentionally absent for a single-admin site; manage the Auth user itself from the Supabase dashboard. A wrong password shows a plain "Incorrect email or password" message; a network/Supabase-unavailable failure shows its own distinct error and lets you retry. Signing in with an Auth account that exists but isn't in `admin_users` succeeds (you're a valid authenticated user) but immediately shows an "Access denied" screen with no inventory or catalog controls and a sign-out button — being a Supabase Auth user is necessary but not sufficient, you also need the `admin_users` row from step 8.

**Navigation**: once signed in as an admin, a small tab bar switches between **Inventory**, **Catalog**, **Specialists**, **Retailers**, and **Retailer Listings** (each its own real, refreshable `#admin/inventory` / `#admin/catalog` / `#admin/specialists` / `#admin/retailers` / `#admin/retailer-listings` URL). A greyed-out **Dashboard** tab is a disabled placeholder for a future phase — it's not a link to anything yet.

**Inventory tab — what you can edit**: stock status (in stock / low stock / unavailable), quantity (a whole number ≥ 0, or left blank for "unknown"), package type (reel / set / mixed / unknown), an optional color, and optional notes — one row per string, sorted by brand then name. Brand, name, and the string's internal ID are shown for reference but aren't editable here — see the Catalog tab for that. Each row edits independently; saving validates the quantity client-side before writing, and only updates the on-screen row once Supabase confirms the write succeeded.

**Catalog tab — what you can do** (Phase 5, ratings/hybrid fields extended in Phase 6): search/filter (by brand, category) and sort (popularity, brand, name) every `public.strings` row; **create**, **edit**, or **delete** a string. Editable fields cover everything the catalog table exposes: brand, name, category, gauge, the five manufacturer ratings (now decimal, e.g. `9.5`), string cost, description, popularity rank, image/product URLs, colors, tension metadata (adjustment, recommended min/max, notes) in a collapsed "advanced" section, and a "Hybrid string" checkbox that reveals separate main/cross gauge, material, construction, coating, and color fields. **Not editable here**: inventory fields (stock/quantity/package/color/notes — use the Inventory tab), specialist-profile fields (use the Specialists tab), or anything in `src/logic`/`src/config` (recommendation weights, tension rules) — those remain Git-only, untouched by any admin tab. See "Catalog administration" below for full CRUD/validation/security detail.

**Specialists tab — what you can do** (Phase 6): every catalog string is listed with its brand, name, current specialist recommendation summary (confidence, source, reviewer), and an Edit button — strings with no profile yet show a "No profile" badge and an "Add profile" button instead. The editor covers every `public.specialist_profiles` field: source, confidence, feel, reviewer, personal tension range, strengths/weaknesses (one per line), tags (comma-separated), subjective notes, and all 17 scored dimensions (1–5) in a collapsed "advanced" section. "Remove" clears a string's profile entirely (reverting it to manufacturer-data-only scoring on the public site) without touching the catalog or inventory rows. Search and a has-profile/no-profile filter help navigate the full catalog. See "Decimal ratings, hybrid strings & specialist profiles" below for full CRUD/validation/fallback detail.

**Retailers tab — what you can do** (Phase 7): every `public.retailers` row (a real retailer entity, not a listing) is shown with its logo, name, listing count, and country; search by name, filter by active/inactive. **Create** or **edit** a retailer (name, logo URL, website URL, country, active). **Deactivate**/**Reactivate** toggles whether it's selectable for new listings and whether its existing listings show on the public site — its data and listings are untouched either way. **Delete** only succeeds for a retailer with zero listings (checked before attempting the delete, with a friendly message pointing at deactivation otherwise) — a retailer with listings is never silently deleted along with them.

**Retailer Listings tab — what you can do** (Phase 7): every `public.retailer_prices` row (one retailer selling one string in one package) is shown with the retailer's logo/name, string, package, price, availability, preferred status, and last-checked date; search by string/retailer, filter by brand/retailer/retailer-active-status/availability/preferred status, and sort by string/retailer/price/last-checked. **Create**, **edit**, or **delete** a listing — a string can have any number of listings (a set, a reel, several package lengths, several retailers), and the retailer is always chosen from the Retailers tab's list, never typed as free text. An inactive retailer stays selectable only for a listing that was already assigned to it (so an existing listing's form never shows a blank/invalid retailer field) — it can't be newly assigned to another listing until reactivated. See "Retailer prices & purchase options" below for full CRUD/validation/security detail.

**Why writes are actually safe**: every write (inventory, catalog, specialist, retailer, or retailer listing) goes through the signed-in user's own Supabase session — there is no service-role key anywhere in the frontend, and there couldn't be one without exposing it to every visitor. Row Level Security on every data table is what actually decides whether a write is allowed: `anon` and merely-authenticated-but-non-admin users are rejected at the database level regardless of what the UI shows (verified directly in testing — see "Testing this locally" below), so even a modified/malicious client can't write any table without a real `admin_users` row.

### 12. What's next (Phase 8+)

Image uploads and per-dimension confidence overrides in the specialist editor are not implemented yet and are left for later, separate phases.

## Catalog loading (Phase 4)

**Source of truth after Phase 4:**

| Data | Source |
| --- | --- |
| Catalog (brand, name, category, ratings — now decimal, gauge, hybrid main/cross metadata, cost, description, tension metadata, popularity rank, product/image URLs, colors) | Supabase `public.strings`, with `src/data/strings.ts` as fallback |
| Inventory (stock status, quantity, package, color, notes) | Supabase `public.inventory`, with `strings.ts`'s own values as fallback (unchanged since Phase 2) |
| Specialist profiles | Supabase `public.specialist_profiles`, with `src/data/stringSpecialistProfiles.ts` as fallback (since Phase 6 — see "Decimal ratings, hybrid strings & specialist profiles" below) |
| Recommendation/tension/scoring logic | Git/TypeScript (`src/logic/`, `src/config/`) — **never touched by any data source** |

**What actually happens on page load** (`src/hooks/useStringPool.ts` orchestrating `src/services/catalogService.ts` + `src/services/inventoryService.ts`):
1. The page renders instantly from `strings.ts` (identical to pre-Phase-4 behavior — no loading spinner, no flicker).
2. Catalog and inventory are fetched from Supabase concurrently in the background.
3. If the live catalog is valid and complete, it replaces the fallback; live inventory is merged on top by `string_id`. If either fetch fails or the catalog is incomplete, that piece silently keeps using its local fallback — the two fall back independently.

**Validation and completeness** — every `public.strings` row is checked (non-empty id/brand/name, valid category, ratings within 0–11, non-negative gauge/cost, valid tension metadata shape, safe `http(s)` URLs only, no duplicate ids) before being accepted. The live catalog is only ever trusted **whole**: if it's missing even one string `strings.ts` knows about, contains an invalid row, or returns zero rows, the site uses the complete local catalog instead rather than showing a partial/mixed result. This is intentionally conservative — a half-broken live catalog never reaches visitors. All of this is logged to the console as a warning; the public site itself never shows a database error, only the admin/debug pages do.

**Catalog divergence warning**: `strings.ts` is the fallback and rollback reference, not the normal editing surface — the normal way to change live catalog data is the `#admin/catalog` admin UI (see "Catalog administration" below), or directly in Supabase. Editing `strings.ts` alone will change what visitors see **only when the live fetch fails**; it will silently diverge from the live database the rest of the time. Keep them in sync manually (or accept the drift as an intentional fallback snapshot), and use `npm run verify:catalog` (below) to check for it.

**Diagnosing live vs. fallback**: visit `#debug-supabase` in dev — it shows whether the catalog source is 🟢 live or 🟡 fallback, the last fetch's accepted/rejected row counts and reasons, the merged pool size, any catalog ids missing an inventory row, and (since Phase 6) the specialist profile source, decimal-rating validation status, hybrid string count, strings with no specialist profile, and specialist profiles referencing a string id no longer in the catalog.

## Catalog administration (Phase 5)

Builds on "Catalog loading" above — read that first for how the public site actually consumes `public.strings`. This section covers *editing* it, via the `#admin/catalog` tab (see "Admin area" above for how to get there).

**Service**: `src/services/catalogAdminService.ts` is the only place the catalog admin UI touches Supabase — components never call it directly. It reuses the exact same validation constants (`VALID_CATEGORIES`, rating range, safe-URL pattern) that `catalogService.ts` uses for the public read path, so an admin can never save a value the public site would then reject as invalid.

**Create**: the "+ New string" button opens a form with an auto-suggested ID (a slug of brand + name, e.g. "Yonex" + "BG 80 Power" → `yonex-bg-80-power`) that you can still edit before saving — IDs must be lowercase letters/numbers/hyphens and unique. Duplicate **(brand, name)** pairs are only a non-blocking warning, not an error: the database deliberately allows this (a string can legitimately ship in more than one gauge or regional variant under the same display name), so the UI doesn't second-guess that design decision. On success, a default inventory row (`unavailable`, unknown quantity/package) is created in the same operation so the new string is immediately visible and editable from the Inventory tab — if that second write fails, the just-created string is deleted again as a best-effort rollback (Supabase/PostgREST doesn't expose a real cross-table client transaction, so this compensating delete is the closest practical equivalent — verified in local testing, including forcing the failure, that it leaves no orphaned string behind).

**Edit**: same form, prefilled, with the ID field locked (IDs are immutable after creation — string_id is what inventory/specialist-profile foreign keys point at). Saves only touch `public.strings`; inventory is untouched.

**Delete**: requires an explicit "Yes, delete it" confirmation that names the string and states plainly that it disappears from recommendations, the catalog, comparison, and the quiz. `public.inventory`, `public.specialist_profiles`, and `public.retailer_prices` all have `references public.strings(id) on delete cascade`, so a single DELETE atomically removes the matching inventory row, specialist profile, and every retailer listing for that string too (a real Postgres transaction, not a client-side simulation) — verified directly in testing (including with more than one retailer listing on the same string). **Caveat**: `src/data/stringSpecialistProfiles.ts`'s specialist knowledge is a separate local *fallback* file (used only if the live fetch fails), so deleting a string does not remove any corresponding entry there — it becomes a harmless stale fallback entry for an id the live catalog no longer has, and `#debug-supabase` flags that mismatch afterward.

**Validation**: required brand/name/category/ratings; ratings 0–11; gauge/cost/popularity-rank non-negative (popularity rank must also be a whole number); tension adjustment may be negative (it's a +/- nudge) but recommended min must not exceed max; image/product URLs must be `http(s)` — a `javascript:` or other unsafe scheme is rejected outright (verified against a test database with no such constraint of its own, confirming the app layer is the real defense here, not just the database's own CHECK constraints on ratings/enums). Every field is trimmed; blank optional fields become `null`, never an empty string.

**Image handling**: still URL-only — no upload yet (planned for a later phase, see "What's next" above). The image URL field shows a live preview, and a broken/unreachable URL shows a clear placeholder instead of a broken-image icon.

**Current limitations / Phase 6+ scope** (as of Phase 5; specialist-profile editing shipped in Phase 6, retailer-price administration shipped in Phase 7 — see below): no image upload (URLs only); no bulk edit or CSV import; the disabled "Dashboard" nav tab is a placeholder for a future phase, not a hint at what it'll contain.

### Verifying the catalog

```bash
npm run verify:catalog
```

Read-only (anon key only, same as the public site — never the service-role key). Fetches the live `public.strings`, runs it through the exact same validation the site itself uses, and reports accepted/rejected rows, missing/extra ids versus `strings.ts`, and whether the live site would actually use the live catalog right now. Never writes anything; never fabricates a pass if Supabase is unreachable.

### Automated tests

```bash
npm run test:catalog
```

Plain assertions (no test framework dependency) covering: database-row-to-`StringItem` mapping (round-tripped over every real catalog entry), invalid-row rejection (bad category, out-of-range ratings, negative gauge/cost, malformed tension metadata, unsafe URL schemes), duplicate-id detection, the live/fallback completeness decision, deterministic catalog ordering, inventory-merge behavior, and — most importantly — that `recommendStrings`/`recommendTension` produce byte-identical Best Match / Best Available Alternative / Specialist Choice / tension results whether the pool comes from `strings.ts` directly or from mapping synthetic database rows built from the same data (Phase 4), and separately whether the specialist-profile map comes from `STRING_SPECIALIST_PROFILES` directly or from mapping synthetic `specialist_profiles` rows built from the same data, including the case where the parameter is omitted entirely (Phase 6). This is local/automated only — it never touches a real Supabase project.

```bash
npm run test:catalog-admin
```

Same style, covering the Phase 5 catalog admin form: required-field validation, duplicate-id rejection, the non-blocking duplicate-(brand,name) warning, every numeric field's range/sign/integer rules, `javascript:`-scheme URL rejection, text trimming/null-handling, and that a catalog row round-trips through the edit form back to an identical payload. Since Phase 6, also covers decimal-rating acceptance/rejection (one decimal place, 0–11 range) and hybrid main/cross metadata validation. Also local/automated only — the actual Supabase create/update/delete calls were verified separately via local integration testing (see the Phase 5/6 reports), not by this script.

```bash
npm run test:specialist-admin
```

Same style, covering the Phase 6 specialist profile admin form and the public read path's row validation: required-field validation (source/confidence), personal tension range rules, all 17 dimensions' 1–5 range, text trimming/null-handling for reviewer/notes/strengths/weaknesses/tags, that a specialist row round-trips through the edit form back to an identical payload, and that `mapSpecialistProfileRow` (the same function the public site's fetch path uses) accepts everything the admin editor can produce and rejects malformed data. Also local/automated only — the actual Supabase upsert/delete calls were verified separately via local integration testing (see the Phase 6 report), not by this script.

```bash
npm run test:retailers
```

Covers Phase 7's normalized retailer feature end to end: retailer ENTITY row mapping/validation (name required, logo/website URL-scheme rejection, country-format rejection) and retailer LISTING row mapping/validation joined with a retailer (decimal price at 2 places, negative-price/URL-scheme/availability/package-type/package-length rejection, and rejection of a listing whose retailer_id has no matching retailer); admin form validation for both retailer entities (case-insensitive duplicate-name rejection) and listings (required fields, string/retailer-still-exists checks, the retailer-picker "inactive retailers aren't newly selectable, but an already-assigned inactive retailer is preserved when editing" rule, the duplicate-listing rule keyed on retailer_id, the non-blocking preferred-conflict warning); both row round-trips; preferred/availability/price ordering and its determinism; compatible-vs-incompatible price comparison (a set is never compared to a reel, two different reel lengths are never compared to each other); price-per-metre rounding; the diagnostics helpers the debug page uses (including case-insensitive duplicate-retailer-name detection); the "Supabase not configured" fallback path for both retailers and listings; and a recommendation-isolation regression section — including a compile-time check (`@ts-expect-error` on a call with a 4th argument, enforced by `npx tsc -b`) proving `recommendStrings` cannot even be called with retailer data, not just that nobody currently does. Also local/automated only — the actual Supabase create/update/delete calls, RLS, the FK-restrict-on-delete-with-listings behavior, and the live "deactivating a retailer hides its listings" behavior were verified separately via local Postgres+PostgREST integration testing (see the Phase 7 report), not by this script.

```bash
npm run test:ui
```

Covers Phase 8's presentation layer: a recommendation-isolation regression that pins `recommendStrings()`'s Best Match id/percent/Cross-Brand/Specialist Choice against fixture values captured before any Phase 8 code existed (so an accidental change to the engine, its weights, or its data would fail this suite immediately); determinism checks (same input twice → deep-equal output) for every new function; `ratingTier`'s bucketing; `buildStrengthBadges`/`buildTradeoffs`/`buildPlayerLevelFit`'s dedupe/cap/fallback rules; `buildStructuredExplanation` carrying the engine's own explanation text through verbatim; `buildAlternativeReasons`'s comparisons (durability/repulsion/control/comfort/feel/price/stock, capped at 3, never duplicated); and `buildComparisonRows` producing exactly the 12 requested metrics in order, with correct dot-scaling, graceful "Not rated"/"—"/"0" fallbacks, and successful rendering for every string in the catalog. Also local/automated only — no Supabase calls, no browser.

```bash
npm run test:ui-polish
```

Covers the Phase 8 polish revision: a second, independent recommendation/ranking/tension regression (`recommendStrings` **and** `recommendTension` pinned against fixture values, plus a `buildComparisonRows` fixture check) proving this purely visual pass changed nothing about what gets recommended; `resolveStringColor`/`primaryStringColor`/`allStringColors` (case-insensitive matching, determinism, the white/black "strong ring" border rule, never-fabricate-a-color behavior for unrecognized names, real-catalog-data smoke test); `readStoredComparisonView`/`writeStoredComparisonView` (radar-first default with no/empty/corrupted storage, round-tripping both directions, and never throwing even when the underlying storage does); and `needsClamp`'s threshold behavior against both synthetic and the real catalog's `notes` text. Also local/automated only — the actual visual rendering (swatches, hero texture, card accents) and the Radar/Table switch's `aria-pressed` state were verified in a real browser instead (see the Phase 8 report's "Browser verification" section), since this repo has no DOM/component-testing library.

```bash
npm run test:catalog-polish
```

Covers Phase 9: a third recommendation/ranking/tension regression pin (including a direct check that `mergeInventoryIntoCatalog()` only ever changes `stock`/`setsAvailable`/`inventoryColor`, never a recommendation-relevant field); all 23 required color names, case-insensitivity, determinism, and never-fabricate-a-color behavior for unrecognized names; `buildColorPreview()`'s one/two/three-color, beyond-three-overflow, and alphabetical-ordering behavior; the merged inventory-then-catalog priority (available inventory color shown first without duplicating a catalog entry, stock-gated exclusion when unavailable, an unrecognized inventory color falling through to catalog rather than blocking it); hybrid handling (a true split swatch only when both main and cross colors are known, a plain single swatch when only one side is, "none" when neither is); `summarizeColorDiagnostics()`'s counts and flags; the version-helper functions backing the admin footer; a real-catalog-data smoke test; and confirmation that the deprecated Phase 8 `primaryStringColor`/`allStringColors` wrappers still work unchanged. Also local/automated only — the rendered swatches (including the hybrid split-circle and `+N` expand/collapse), the comparison chips, the larger radar/full-width table, and the admin version footer were verified in a real browser instead (see the Phase 9 report).

```bash
npm run test:color-inventory-fix
```

Covers the Phase 9 fix round: a fourth recommendation/ranking/tension regression pin; `logic/colorParsing.ts`'s comma/semicolon splitting, never-split-on-slash, multi-word preservation, and `parseLegacyHybridPair()`'s unambiguous-pair rules; the `Cosmic Gold` color and the `Turquois` → `Turquoise` alias (including `describeColorAlias()`); multiple inventory colors from one free-text field (comma/semicolon-parsed, inventory-first, stock-gated, merged with catalog colors without duplication, `+N` overflow across the merged list); `hybridColorSource()`'s full priority chain (structured-both, structured-partial, legacy-pair, none) including AeroBite/AeroBite-Boost-style legacy split reconstruction and confirmation the legacy fallback never applies while out of stock; the six new `ColorDiagnosticsSummary` fields; the catalog admin's semicolon-aware, still-deduplicating `parseColors()`; and the full mobile-decimal-input matrix (`normalizeDecimalInput()` in isolation, plus wired end-to-end through `validateCatalogInput()`'s ratings/tension-adjustment/cost fields and `validateSpecialistInput()`'s tension range) proving `"10,5"` and `"10.5"` parse identically while `"12"`/`"-1"`/`"5,,"`/`"5.5.5"` still fail. Also local/automated only — the swatches beside the string name, the admin color-entry warnings, and the mobile numeric keypad's on-device behavior were verified in a real browser/viewport instead (see this round's report).

```bash
npm run test:color-resolver-v2
```

Covers the second Phase 9 fix round's layered color resolver: `logic/cssColor.ts`'s safe validation (named colors, hex, `rgb()`, `hsl()` in both comma and CSS4 space syntax, and rejection of `url()`/`var()`/`calc()`/injection attempts); `logic/baseColorInference.ts`'s tokenized inference for every documented example (Fire Orange → orange, Ivory White → white, Cosmic Gold → gold, Royal Blue → blue, Neon Yellow → yellow, Dark Green → green, Light Pink → pink, Metallic Silver → silver, Graphite Black → black), multi-word base-color preservation, and that every base color is end-to-end resolvable; the small alias table (Turquois → Turquoise, Grey → Gray, and confirmation Cosmic Gold is deliberately *not* a full alias entry); unresolved/ambiguous names (Ocean, Flash, Pearl, Ice, Smoke, Graphite, Amber) staying unresolved; explicit override priority (including overriding an otherwise-inferable name) and invalid-override fallback behavior; the "White, Red" vs. "White/Red" vs. hybrid-only-slash-pair distinction; the full hybrid priority chain including a structured override on one side and the AeroBite-style legacy fallback; the extended diagnostics (resolution-source counts, inferred-name list, explicit/invalid override tracking, partial-vs-missing hybrid pairs); the catalog admin's hybrid override validation end-to-end (valid save, rejected invalid value, optional-and-blank is fine); and a fresh mobile-decimal-input regression check. Also local/automated only — the swatches beside the string name, the removed physical-color dots in comparison chips, the native color picker, and the admin form's live resolution-source text were verified in a real browser instead (see this round's report).

### Verifying your setup

```bash
npm run verify:supabase
```

Checks (using only the public anon key — never the service-role key):
- the four public tables are reachable with their expected columns
- anon reads succeed
- anon writes are correctly rejected

Optionally, set `SUPABASE_TEST_ADMIN_EMAIL` / `SUPABASE_TEST_ADMIN_PASSWORD` in your shell for a single run to additionally verify your admin account can write — never commit these.

### Migrating inventory into Supabase

`public.inventory.string_id` has a foreign key to `public.strings.id`, so on a fresh project `public.strings` needs a row for every catalog string *before* any inventory row can be inserted. This script handles both steps — it does **not** mean the website reads catalog data from Supabase (it still reads `strings.ts` directly); seeding `public.strings` here is purely to satisfy that foreign key.

Preview what would happen first, with no writes at all:

```bash
VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory -- --dry-run
```

Then run it for real:

```bash
VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory
```

Prefer setting `SUPABASE_SERVICE_ROLE_KEY` inline in your shell for this one command rather than leaving it sitting in `.env.local` any longer than it needs to — it bypasses Row Level Security entirely.

What it does, in order:
1. **Seeds `public.strings`** from every field `strings.ts` has a column for (ratings, gauge, description, price, links, etc.) — read programmatically, nothing hand-typed. Fully re-upserted on every run; there's no admin UI for catalog data yet; if seeding fails, it stops here and **`public.inventory` is never touched**.
2. **Confirms** every string the inventory step is about to reference was actually written (not just attempted) — aborts before touching inventory otherwise.
3. **Upserts `public.inventory`** from `strings.ts`'s current `stock`/`setsAvailable` values.

Safe to re-run — never deletes rows from either table. Inventory only touches `stock_status`/`quantity`/`package_type`; any `color`/`notes` set later through the admin UI are left alone on a re-run. Reports row counts for both tables when done.

### `/debug/supabase` (development only)

Visit `http://localhost:5173/#debug-supabase` while running `npm run dev` to see connection status, current user, admin status, inventory row count, and (since Phase 4) the catalog source (live/fallback), last catalog fetch's accepted/rejected row counts and reasons, merged pool size, and catalog ids missing an inventory row. Since Phase 6, it also shows: decimal-rating validation status (whether any accepted row's ratings use a decimal, and whether any row was rejected for exceeding one decimal place), the hybrid string count, the specialist profile source (live/fallback) and last fetch status, how many strings have no specialist profile (expected — profiles are sparse by design), and specialist profiles referencing a string id no longer in the catalog. Since Phase 7, it also shows: the retailer source (live/unavailable) and last fetch status, invalid retailer rows, total listing count, strings with/without any listing, out-of-stock and discontinued counts, listings missing a last-checked date, preferred-listing conflicts, duplicate-retailer candidates, and currency/package-type counts. It only exists in dev builds (`import.meta.env.DEV`) and isn't linked from anywhere in the normal site.

### Testing the admin area locally

1. Complete steps 1–8 above (project created, migration applied, your Auth user created and disable public sign-up, and that same user added to `public.admin_users`).
2. `npm run dev`, then visit `http://localhost:5173/#admin` and sign in with that account. Switch to the Catalog tab to try creating, editing, and deleting a string.
3. To see the "authenticated but not admin" state, create a second Auth user in the dashboard and sign in with it *without* adding it to `admin_users` — you should land on "Access denied" with no inventory or catalog controls.
4. To confirm Row Level Security (not just the UI) is what's actually blocking that second user, you can run the same update/insert/delete it would attempt directly from the browser console while signed in as it — it should affect zero rows rather than erroring, which is RLS silently filtering the row out rather than the UI merely hiding a button.
5. To see the catalog's create-then-rollback path, temporarily revoke `authenticated`'s `INSERT` on `public.inventory` in the SQL editor, create a string, and confirm both that a clear error appears and that the string itself doesn't linger in the catalog — then re-grant the permission.
6. Switch to the Specialists tab (Phase 6) to add, edit, and remove a specialist profile for a string; refresh the public site's catalog/comparison/quiz pages afterward to confirm the change is reflected (specialist data is fetched on page load, not live-pushed).
7. Switch to the Retailers tab (Phase 7) to add a retailer (name, optionally a logo/website URL and country). Switch to Retailer Listings, add a listing for a string using that retailer (pick a package type and, for a reel, a length); mark it preferred; refresh the public site and confirm the purchase option appears (collapsed under "🛒 Purchase options") on that string's catalog card and, if it's the quiz's Best Match, on the result page too. Edit its price/availability, then delete it and confirm it disappears from the public site on refresh without touching the string itself.
8. Back on the Retailers tab, deactivate that same retailer (recreate a listing for it first if you deleted the one from step 7) and refresh the public site — the purchase option should disappear even though the listing row itself still exists (confirm this on the Retailer Listings tab, where it stays fully visible and editable, tagged "Retailer inactive"). Reactivate the retailer and refresh again to confirm the purchase option comes back. Then try deleting a retailer that still has a listing — it should be blocked with a message pointing you at deactivation instead.

Never put a real password, UID, or project ref into a commit, issue, or this file — use throwaway test accounts for step 3.

## Decimal ratings, hybrid strings & specialist profiles (Phase 6)

Builds on "Catalog loading", "Catalog administration", and "Admin area" above. This phase modernized the catalog data model (decimal ratings, hybrid string support) and moved specialist profile *data* — not the recommendation logic itself — into Supabase, with a full admin editor for it.

### Decimal ratings

Manufacturer ratings (repulsion, durability, control, hitting sound, shock absorption) previously assumed whole numbers; manufacturers publish decimals (e.g. `9.5`). `public.strings`'s five rating columns are now **unbounded `numeric`** — deliberately not `numeric(3,1)` — with a `CHECK` constraint requiring `x between 0 and 11 and x = round(x, 1)`. This distinction matters: a declared-scale `numeric(3,1)` column rounds an over-precise value (`9.55` → `9.6`) at assignment time, *before* any `CHECK` on that column ever runs, which makes an `x = round(x, 1)` check on it a no-op — it always trivially passes because the value was already rounded by the column's own type. This was caught by local integration testing (inserting `9.55` through a `numeric(3,1)` column silently stored `9.6` and passed); switching to unbounded `numeric` stores the value exactly as given, so the same `CHECK` genuinely rejects it. The same rule (0–11 range, at most one decimal place) is enforced in the app layer too, via `hasDecimalPrecision()` in `src/services/catalogService.ts`, shared by both the public read path (`mapCatalogRow`) and the admin write path (`catalogAdminService.ts`) so neither can accept a value the other would reject. The recommendation engine itself required **no changes** for this — it already treated ratings as plain numbers; a `9` and a `9.5` are handled identically by the same arithmetic.

### Hybrid string support

Strings like Yonex AeroBite use a different main and cross string (gauge, material, construction, coating, color can all differ). This is modeled as three new, optional `public.strings` columns: `is_hybrid boolean`, `main_string_meta jsonb`, `cross_string_meta jsonb` — the same sparse-jsonb pattern already used for `tension_meta`. On the application side (`StringItem` in `src/data/strings.ts`), this is `isHybrid?: boolean`, `mainString?: HybridStringMeta`, `crossString?: HybridStringMeta`.

**This metadata is display/administration-only — it is never a recommendation input.** The recommendation engine receives the exact same `StringItem` shape it always has; `isHybrid`/`mainString`/`crossString` simply sit alongside the fields it actually reads (the five manufacturer ratings) and it never looks at them. A hybrid string's overall manufacturer ratings — the actual recommendation inputs — are entered once, the same as any other string; nothing about hybrid status is special-cased inside `src/logic/recommendationEngine.ts`.

**Display**: `src/logic/formatGauge.ts` (public site) and the equivalent `formatAdminGauge()` helper in `CatalogAdminCard.tsx` (admin) both implement the same rule: a hybrid string with both main and cross gauges set displays as `"0.67 / 0.61mm"`; a normal string continues to display `"0.65mm"`. Catalog cards, the hero recommendation card, and the comparison page all use this helper, so hybrids display correctly everywhere without any component needing to know about hybrids beyond calling one formatting function.

**Admin**: the Catalog tab's form gets a "Hybrid string" checkbox; checking it reveals a two-column "Main string" / "Cross string" section (gauge, material, construction, coating, color — all optional, independently). The admin catalog card shows a "Hybrid" badge next to the category badge for at-a-glance identification.

### Specialist profile architecture

**Only the data source changed — the recommendation logic did not move.** Specialist profile *data* (confidence, source, reviewer, feel, personal tension range, strengths/weaknesses, tags, subjective notes, and 17 scored dimensions) now lives in `public.specialist_profiles`, fetched by `src/services/specialistProfileService.ts` (the only place that queries this table) and exposed to components via `src/hooks/useSpecialistProfiles.ts`. `src/data/stringSpecialistProfiles.ts` — the original, entirely local dataset — is retained as the fallback and is what ships if Supabase is unreachable, misconfigured, or the fetch otherwise fails outright.

**Specialist fallback differs from the catalog's**: the catalog (Phase 4) requires the live data to be *complete* — missing even one known string triggers a full fallback to the local file, because a half-broken catalog should never reach visitors. Specialist profiles are the opposite: most strings legitimately have **no** profile at all, so there is no completeness gate. A live fetch that succeeds is used exactly as returned, sparse coverage and all; only a fetch that fails outright (network error, misconfiguration, or a query error) triggers a full fallback to the local file. Individual malformed rows are skipped and logged rather than failing the whole fetch. This is a deliberate choice, documented directly in `specialistProfileService.ts`.

**Recommendation engine isolation** (the phase's core architectural constraint): `src/logic/recommendationEngine.ts`'s `recommendStrings()` gained one new optional parameter, `specialistProfiles`, defaulting to the exact same `STRING_SPECIALIST_PROFILES` import it always used — mirroring the `pool` parameter Phase 4 already added for catalog data. Every existing caller that doesn't pass it sees **zero behavior change**; callers that do pass it (the live UI, via `useSpecialistProfiles()`) can inject a Supabase-sourced map instead. The engine's internal scoring logic never changed — it doesn't know, and cannot tell, whether the map it received came from Supabase or the local file. This was verified by round-tripping every entry in `STRING_SPECIALIST_PROFILES` through the same row-shape validation the live fetch path uses (`mapSpecialistProfileRow`) and confirming `recommendStrings` produces byte-identical Best Match / Best Available Alternative / Cross-Brand Alternative / Specialist Choice / explanation text either way — see "Automated tests" above (`npm run test:catalog`, section 8).

### Specialist profile administration

`src/services/specialistAdminService.ts` is the only place the Specialists admin tab touches Supabase (mirroring `catalogAdminService.ts`'s pattern) — it reuses the same enums (`ExperienceSource`, `Confidence`, `SpecialistFeel`) and dimension range (1–5) that the public read path (`specialistProfileService.ts`) validates against, so an admin can never save something the public site would then reject. The list (`fetchAdminSpecialistList()`) is built from two plain queries (every catalog string, every specialist profile row) merged client-side by `string_id` — simpler than a PostgREST embedded join and just as type-safe for a low-traffic admin list. Writes are a genuine upsert (`.upsert(..., { onConflict: 'string_id' })`, since `string_id` is the table's primary key) or a delete; both run through the signed-in admin's own Supabase session exactly like inventory/catalog writes — no service-role key, RLS is the actual enforcement.

### Testing

```bash
npm run test:catalog          # includes decimal/hybrid mapping + specialist-source recommendation regression (section 8)
npm run test:catalog-admin    # includes decimal-rating and hybrid-metadata form validation
npm run test:specialist-admin # specialist form validation + public read-path row validation
```

All three are local/automated only (no network calls); the actual Supabase reads/writes for decimal ratings, hybrid CRUD, and specialist CRUD were verified separately through local integration testing, per this project's established pattern for prior phases.

### Phase 7+ scope

Not implemented in Phase 6, left for later: retailer-price administration (shipped in Phase 7 — see below), image uploads, per-dimension confidence overrides in the specialist editor (the profile-level `confidence` is editable; the more granular `dimension_confidence` column exists in the schema but has no UI yet), bulk edit/CSV import, and the "Dashboard" admin tab.

## Retailer prices & purchase options (Phase 7)

Builds on "Catalog loading", "Catalog administration", "Admin area", and "Decimal ratings, hybrid strings & specialist profiles" above. This phase turned `public.retailer_prices` — created in Phase 1 for schema stability but never actually used — into a real, **normalized** retailer model with a full admin editor, and surfaced it on the public site as secondary "purchase options" information. Retailers are reusable entities (name, logo, website, country, active) referenced by listings via `retailer_id`, not free text repeated on every row. The recommendation engine was never touched: it has no retailer parameter at all, so there was nothing to isolate beyond keeping it that way.

### Architecture

| Data | Source |
| --- | --- |
| Retailer entities (name, logo, website, country, active) | Supabase `public.retailers` — **no local fallback dataset** |
| Retailer listings (retailer_id, price, currency, availability, package type/length, preferred flag, notes) | Supabase `public.retailer_prices` — **no local fallback dataset** (see "Fallback behavior" below) |
| Recommendation/tension/scoring logic | Git/TypeScript (`src/logic/`, `src/config/`) — **never touched by retailer data** |

Four services, each with one job:
- `src/services/retailerService.ts` — the only place the public site queries `public.retailers` (retailer entities).
- `src/services/retailerPriceService.ts` — the only place the public site queries `public.retailer_prices`; joins in each listing's retailer metadata (name, logo, active status) via `retailerService.ts`, and hides any listing whose retailer is inactive (see "Fallback behavior" and "Inactive retailer behavior" below).
- `src/services/retailerAdminService.ts` — the only place `#admin/retailers` writes retailer entities (create, edit, deactivate/reactivate, delete-when-safe).
- `src/services/retailerListingAdminService.ts` — the only place `#admin/retailer-listings` writes listings (create, edit, delete) — always selecting an existing retailer by id, never creating one implicitly.

`src/hooks/useRetailerPrices.ts` exposes the joined result as `Record<string, RetailerListing[]>`, threaded through `App.tsx` into `StringComparison`/`StringFinder` → `StringCard`/`RecommendationResult` → `PurchaseOptions`, the same prop-threading pattern Phase 6 used for specialist profiles. None of these four services is ever imported by `src/logic/recommendationEngine.ts`, and `recommendStrings()`'s signature has no retailer parameter to inject one through even if a future change tried.

### Retailers table

`public.retailers` (one row = one real retailer entity, reusable across every string it sells):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint identity` | Primary key. |
| `name` | `text not null` | Trimmed; required; unique case-insensitively (`unique index` on `lower(name)`). |
| `logo_url` | `text` | Nullable; `http(s)` only. |
| `website_url` | `text` | Nullable; `http(s)` only — the retailer's general site, distinct from a listing's specific `product_url`. |
| `country` | `text` | Nullable; ISO 3166-1 alpha-2, uppercase (e.g. `"DE"`) — a `CHECK (country ~ '^[A-Z]{2}$')` enforces the shape without hardcoding a country list. |
| `active` | `boolean not null default true` | See "Inactive retailer behavior" below. |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` auto-stamped by a new trigger, reusing the existing `set_updated_at()` function from Phase 1. |

### Retailer listings table

`public.retailer_prices` (one row = one retailer selling one string in one package):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint identity` | Primary key. |
| `string_id` | `text` | FK → `strings(id) on delete cascade`. |
| `retailer_id` | `bigint` | FK → `retailers(id)` — default (`NO ACTION`/restrict) behavior, **not** cascade: deleting a retailer with listings fails at the database level (see "Retailer CRUD behavior" below). |
| `product_url` | `text` | Nullable; `http(s)` only — this specific product page, not the retailer's general site. |
| `price` | `numeric` | Nullable (a listing may be tracked before a price is confirmed); 0 or greater; at most 2 decimal places. |
| `currency` | `text not null default 'EUR'` | `EUR` only for now — see "Price rules" below. |
| `availability_status` | `text not null default 'unknown'` | One of the six states below. |
| `package_type` | `text not null default 'other'` | One of: `set`, `reel`, `hybrid`, `other`. |
| `package_length_m` | `numeric` | Nullable; must be `> 0` when set. |
| `is_preferred` | `boolean not null default false` | Display ordering only — see "Preferred retailer ordering" below. |
| `notes` | `text` | Nullable free text. |
| `last_checked_at` | `timestamptz` | Nullable — when this listing's price/availability was last confirmed. |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` auto-stamped by the existing Phase 1 trigger. |

**Existing schema found before this phase** (Part 1's required review, done before writing the migration): `retailer_prices` already existed from Phase 1, but as a flat table with `retailer_name` (free text) plus `set_price_eur`, `reel_price_eur`, `sale_price_eur` (three separate price columns per row) and a boolean `retailer_in_stock`, with `unique(string_id, retailer_name)` — no `retailers` table existed at all. That shape couldn't represent an arbitrary listing (one row held up to three DIFFERENT prices), conflated a price *tier* (`sale_price_eur`, a discount) with a package *type*, and repeated retailer-level metadata (which this phase didn't even have fields for yet — logo, website, country) on every single listing row with no way to manage a retailer as its own entity. See the migration file's own header comment for the full before/after column list.

### Legacy migration behavior

One migration file, revised in place before ever being applied anywhere (Phase 7 had not been installed or pushed when the normalized model was requested, so there was no reason to layer a second migration under it). Two stages, both idempotent:
- **Stage A** (unchanged from the first draft): the three legacy price columns collapse into the single-price-per-row shape described above — `set_price_eur` claims the original row as a `'set'` listing; if `reel_price_eur` is *also* present, a second row is inserted for it; `sale_price_eur` (a price tier, not a package type) is preserved as its own `'other'`-typed row with an explanatory note rather than mislabeled. `retailer_in_stock` converts to `availability_status`.
- **Stage B** (new): every distinct `retailer_name` (case-insensitively) becomes exactly one `retailers` row, reused across every listing that named it; every listing is then linked via `retailer_id`, and the now-redundant `retailer_name` column is dropped (`retailer_product_url` is renamed to `product_url`, not dropped — its data survives).
- **Collision resolution**: normalizing case-insensitively can expose listings the OLD case-*sensitive* uniqueness allowed to coexist as "different retailers" (e.g. `"RetailerA"` and `"retailera"`, each with their own `'set'` listing for the same string) — once merged into one real retailer, those become genuine duplicates under the new key. Rather than silently drop one, the most recently updated listing in each colliding group is kept and every other listing's price/availability/last-checked data is appended to its `notes` as an auditable merge record before being deleted. Caught and fixed via local integration testing (seeded exactly this scenario — two case-variant retailer names, one with all three legacy prices set — before the migration shipped).
- Verified directly: applying the migration against seeded legacy data (including the collision case above) preserves every price with a clear audit trail; re-applying the same file a second time is a complete no-op (row counts unchanged).

### Availability states

`in_stock`, `low_stock`, `out_of_stock`, `preorder`, `discontinued`, `unknown` — one shared source of truth (`RETAILER_AVAILABILITY_STATUSES` and `AVAILABILITY_LABELS` in `retailerPriceService.ts`) used by the database `CHECK` constraint, `mapRetailerPriceRow` (public read), `validateRetailerListingInput` (admin write), the admin form's `<select>`, and `PurchaseOptions`' public display — no duplicated enum list anywhere.

### Package types

`set`, `reel`, `hybrid`, `other` — describes what the *retailer* is selling, not the string's own technical construction (kept deliberately separate from `strings.is_hybrid`/`main_string_meta`/`cross_string_meta`, which describe the string itself regardless of who sells it or how). `package_length_m` (metres) is optional and independent of package type — a reel almost always has one, a set usually doesn't, but nothing enforces that pairing, since real retailer listings are messier than that in practice.

### Price rules

Manufacturer-published prices are decimals with cents, so `price` is unbounded `numeric` (**not** `numeric(10,2)`) with a `CHECK (price is null or (price >= 0 and price = round(price, 2)))`. This mirrors a lesson learned the hard way in Phase 6: a declared-scale column like `numeric(10,2)` **rounds** an over-precise value (e.g. `9.999` → `10.00`) at assignment time, *before* any `CHECK` on that column ever runs — making a `price = round(price, 2)` check on it a no-op, since by the time the check runs the value has already been silently rounded to fit. Local integration testing for this phase re-verified that risk directly against the retailer table before shipping the migration. `EUR` is the only supported currency for now (`currency` is `text` with `CHECK (currency in ('EUR'))`, no conversion is ever performed) — adding another currency later is a one-line additive migration (widen the `CHECK` list) plus widening the matching `RetailerCurrency` type and `RETAILER_CURRENCIES` constant; the column itself never needs to change shape.

### Preferred retailer ordering

At most one listing per string is expected to be marked preferred (the admin form warns, non-blockingly, if you mark a second one — see "Duplicate rules" below for why it's a warning and not a hard block). `orderRetailerListings()` — the single ordering function used by both `PurchaseOptions` (public) and the fetch path that populates it — sorts: preferred listing(s) first, then by availability (`in_stock` → `low_stock` → `preorder` → `unknown` → `out_of_stock` → `discontinued`), then by price ascending (unpriced listings last), then by retailer name for a deterministic tie-break. Preferred status is a display label only ("preferred" text, no other visual claim) — it never implies "cheapest" unless it genuinely is, and it can never affect recommendation scoring, because nothing about it is ever passed to `recommendationEngine.ts`. More than one preferred listing for the same string is flagged as a **preferred-listing conflict** on the debug page (`findPreferredConflicts()`) — a data-quality signal, never silently resolved by picking one.

### Price & package comparison

Two listings are only ever compared directly if `areListingsComparable()` says they represent the same real-world product unit: same `package_type`, same `package_length_m` (both `null` counts as "equal" — two "unknown length" listings of the same type), and the same `currency`. A 10m set and a 200m reel — or a set and a reel of any length — are never compared, even though both might be EUR. `groupComparableListings()` buckets a string's listings into these comparable groups; `lowestPriceInGroup()` finds the minimum *within* one bucket, never across buckets. Where a package length is known, `pricePerMetre()` computes price ÷ length for **display only**, rounded to 2 decimal places — it's never used to compare across strings, and never blends a hybrid string's combined-package price-per-metre with a normal string's as if they were equivalent "value" metrics (a hybrid package still contains two different constructions per metre).

### Duplicate rules

**Retailers**: unique case-insensitively on `name` (a database `unique index` on `lower(name)`, plus the same check client-side in `validateRetailerInput` before ever hitting the database) — `"Amazon"` and `"amazon"` are the same retailer.

**Listings**: the natural-key rule `(string_id, retailer_id, package_type, package_length_m)`, enforced by a `unique index` (using `coalesce(package_length_m, -1)` so two "unknown length" listings from the same retailer/type still collide, since plain `unique` treats every `NULL` as distinct from every other `NULL`) — deliberately **not** URL-based: retailers sometimes reuse one category-page URL across several package variants, and a URL can legitimately change over time without the listing's real identity changing. `validateRetailerListingInput` checks this same rule client-side before ever hitting the database, so a mistake surfaces as a friendly inline error instead of a raw constraint-violation message. This key intentionally does **not** block the same retailer selling a set *and* a reel, or two different reel lengths, from the same retailer for the same string — those are legitimate, distinct listings.

### Retailer CRUD behavior

Create/edit a retailer (name, logo URL, website URL, country, active) via `#admin/retailers`. **Deactivate**/**Reactivate** are just the `active` field toggled through the same update path. **Delete** only succeeds for a retailer with zero listings — `retailerAdminService.ts`'s `deleteRetailer()` checks the listing count first and returns a friendly, specific error otherwise ("delete or reassign its listings first, or deactivate it instead"); the database's own FK (`retailer_prices.retailer_id references retailers(id)`, default restrict behavior) is the real backstop even if that check were ever bypassed — verified directly (a raw authenticated `DELETE` on a retailer with an existing listing fails with a foreign-key-violation error, not a silent cascade).

### Listing CRUD behavior

Create/edit/delete a listing via `#admin/retailer-listings`, always selecting an existing retailer from a `<select>` populated by `retailerListingAdminService.ts` — never free-text entry, so a listing can't reference a retailer that doesn't exist or introduce a new near-duplicate spelling. Deleting a listing requires an explicit confirmation naming the retailer and string, removes only that one row, and never touches the string, its inventory row, its specialist profile, or the retailer entity itself (verified directly — deleting a *string*, by contrast, correctly cascades and removes all of its retailer listings too, an intended, pre-existing `on delete cascade` behavior unchanged by this phase).

### Inactive retailer behavior

An inactive retailer's listings are hidden from the public site entirely (`fetchRetailerPricesFromSupabase()` joins each listing with its retailer and skips any whose retailer is inactive, tracked separately as `hiddenInactiveCount` — never conflated with genuinely invalid/rejected rows) while remaining fully visible and editable on `#admin/retailer-listings`, tagged "Retailer inactive." An inactive retailer cannot be newly assigned to a listing (`validateRetailerListingInput` rejects it) — except a listing that's already assigned to it, which can still be saved unchanged (via `originalRetailerId`), so an existing listing's form never breaks or silently reassigns itself just because its retailer was deactivated elsewhere. Verified directly, live: deactivating a retailer through the real admin write path immediately hides its listing from a subsequent real `fetchRetailerPricesFromSupabase()` call (`hiddenInactiveCount` goes from 0 to 1); reactivating brings it back. Nothing is ever deleted by deactivation — retailer and listing rows are both fully preserved.

### Public display behavior

`PurchaseOptions` shows, per listing: the retailer's logo (only if a safe `http(s)` URL is set *and* the image actually loads — an `onError` handler and a URL-scheme re-check both fall back to showing just the retailer name, never a broken-image icon, never a layout shift), retailer name, price, package type/length, availability, and a `product_url` "Buy ↗" link (`target="_blank" rel="noopener noreferrer nofollow"`, scheme-checked). The retailer's `website_url` is retailer *metadata* only — shown on the admin Retailers tab, never as a public buy link, since the actual purchase link is always the listing's own `product_url`.

### Fallback behavior

There is **no local fallback dataset** for retailer data (entities or listings) — unlike the catalog or specialist profiles, no real local retailer pricing ever existed in this project to fall back to, and the phase spec is explicit that a fallback must never be invented. If a live fetch fails outright (network error, misconfiguration, or a query error), the affected service returns an empty map and records the failure (`source: 'unavailable'`, visible on the debug page); `fetchRetailerPricesFromSupabase()` also short-circuits to this same fallback if the *retailers* fetch it depends on fails, since without retailer data there's no safe way to join names/logos or check active status. The practical effect is simply that no "🛒 Purchase options" section appears anywhere on the site. The catalog, inventory, specialist profiles, quiz, and recommendations are completely unaffected; retailer data was fetched as one more independent `Promise` alongside the others in `App.tsx`; a failure in one never blocks or delays the others. Individual malformed rows are skipped and logged rather than failing the whole fetch, the same pattern used for specialist profiles.

### Security model

No service-role key anywhere in the frontend — all four retailer services use the same shared, anon-key-only client every other service uses. RLS on `public.retailers` (new — public read, admin-only insert/update/delete via the existing `is_admin()` function) mirrors every other table's policy exactly; RLS on `public.retailer_prices` was already correctly configured since Phase 1 and required no changes, this phase only restructured its *columns*. Verified directly in local integration testing for both tables: anonymous reads succeed, anonymous writes are rejected (401), authenticated-but-non-admin writes are rejected by RLS (403/0-rows-affected, data left untouched), and admin writes succeed. Retailer/listing URLs (logo, website, product) are treated as untrusted input at every layer: the admin forms reject a `javascript:` URL before it's ever sent; the public read paths (`mapRetailerRow`, `mapRetailerPriceRow`) independently re-validate the scheme and would reject such a row even if one reached the database by some other means (confirmed directly — inserting a `javascript:` product URL via a raw authenticated request succeeds at the database level, since the database itself has no URL-scheme constraint, but `mapRetailerPriceRow` correctly rejects that exact row when read back, proving the app layer — not the database — is the real defense here, the same pattern already established for the catalog's URL fields in Phase 5); and `PurchaseOptions` re-checks the scheme a third time before rendering either link, belt-and-braces.

### Recommendation isolation proof

`recommendStrings()`'s parameter list is exactly `(answers, pool, specialistProfiles)` — unchanged by this phase, with no retailer parameter added. `scripts/testRetailers.ts` proves this two ways: a runtime check that calling it with retailer data loaded elsewhere in the same process produces byte-identical output to calling it without, and a **compile-time** check — a call with a 4th (retailer) argument wrapped in `@ts-expect-error`, which only passes `npx tsc -b` (run as part of `npm run build` and every phase's verification) if that call is genuinely a type error. If a future change ever added a retailer parameter, that line would stop being an error, `@ts-expect-error` would report "unused directive," and the build would fail — turning an accidental regression into a hard build break instead of a silent behavior change.

### Manual verification checklist

After applying the Phase 7 migration against a real Supabase project:
1. Open `#admin/retailers` and confirm the tab loads (empty is expected on a fresh project); add a retailer.
2. Open `#admin/retailer-listings` and add a listing for an existing string, selecting that retailer (pick a package type; add a length for a reel).
3. Edit its price and availability; confirm the change saves.
4. Mark it preferred; confirm the debug page shows no preferred-conflict for that string.
5. Refresh the public site and confirm the purchase option appears under "🛒 Purchase options" on that string's card (and on the quiz's Best Match card, if applicable), including the retailer's logo if one is set.
6. Click the external retailer link and confirm it opens safely in a new tab.
7. Deactivate the retailer on `#admin/retailers`; refresh the public site and confirm the purchase option is gone, while the listing itself is still visible and editable on `#admin/retailer-listings` (tagged "Retailer inactive"). Reactivate and confirm it reappears.
8. Try deleting a retailer that still has a listing — confirm it's blocked with a message pointing at deactivation. Delete the listing, then delete the retailer — confirm that succeeds.
9. Take the quiz before and after adding a high-price/preferred listing for the winning string, and confirm the recommendation, match percentage, and explanation text are identical either way.
10. Temporarily break `VITE_SUPABASE_URL` (or revoke `anon`'s `SELECT` on `retailer_prices`) and confirm the site still works fully — catalog, quiz, recommendations, specialist panels — just with no purchase options shown, and that `#debug-supabase` reports the retailer source as unavailable.

### Testing

```bash
npm run test:retailers
```

See "Automated tests" above for what this covers. Real Supabase reads/writes, RLS for both tables, the FK-restrict-on-delete-with-listings behavior, the case-insensitive-name-merge migration collision handling, and the live "deactivating a retailer hides its listings" behavior (via a real Vite-processed build of the actual service code, not a mock) were all verified separately through local Postgres+PostgREST integration testing (see the Phase 7 report) — actual browser-level click-through of the admin UI was **not** performed in that session (it would require a full GoTrue-compatible auth stub beyond what local PostgREST alone provides), hence the manual checklist above.

### Phase 8+ scope

Not implemented in this phase, left for later: image uploads, bulk edit/CSV import, per-dimension specialist confidence overrides, multi-currency support (the schema and types are designed to make this a small additive change when needed), and the "Dashboard" admin tab.

## Recommendation UX & presentation polish (Phase 8)

Phase 8 is a UI/UX-only phase — no new tables, no migrations, no schema changes, and no changes to `logic/recommendationEngine.ts`, `logic/tensionRecommendation.ts`, or anything under `src/config/`/`src/data/`. The goal was to make the existing recommendation output feel explained, comparable, and professional, without changing what gets recommended or why, and without adding a database dimension to this phase.

### Recommendation explanation architecture

`logic/recommendationExplanation.ts` is a new, pure presentation module that sits **downstream** of `recommendStrings()` — it never scores, ranks, or recommends anything itself. It takes a `ScoredString` (already computed by the engine), the engine's own natural-language `explanations.*` string for that candidate, and the string's existing `StringSpecialistProfile` (if any), and reshapes them into a `StructuredExplanation`:

- **headline / headlineSecondary** — the top 1–2 manufacturer dimensions the engine already picked (`topDimensions`), bucketed into a display tier (`ratingTier`: Excellent / Very Good / Good / Fair) purely from the string's own existing 0–11 rating. Bucketing a known number into a tier never changes the number, the ranking, or the match percentage.
- **paragraph** — the engine's own `explanations.best`/`explanations.bestAvailable`/etc. text, carried through **verbatim**. This module never writes new prose about *why* a string was recommended; it only reformats the reasoning the engine already produced.
- **playerLevelFit** — a rough "Great for Beginners" / "Suitable for Intermediate Players" / "Best for Advanced, Attacking Players" line, bucketed from the specialist profile's own existing `beginnerFriendliness`/`hardHitterFit`/`allRoundSuitability` dimensions (undefined when there's no specialist profile at all).
- **strengths** — the specialist profile's own hand-written `strengths` text when available, otherwise a plain restatement of the top manufacturer dimensions.
- **tradeoffs** — the specialist profile's own hand-written `weaknesses` text when available (capped at 2); only falls back to a fixed, factual sentence (e.g. "Higher repulsion usually reduces durability.") for the weakest dimension the string wasn't already praised for, when no specialist profile exists.
- **badges** — up to 4 short chips built from the same `topDimensions`/`topSpecialistDims` the engine already selected, deduplicated.

The same module's `buildAlternativeReasons(alternative, baseline, ...)` builds the Alternatives section's "why choose this instead" bullets (e.g. "Higher durability than the Best Match.", "Slightly softer feel.", "Lower price than the Best Match.") by comparing fields both candidates already carry — manufacturer ratings, specialist `feel`/top dimension, `stringCost`, `stock`. It never changes which string is the alternative or reorders anything; it only explains a choice `recommendStrings()` already made.

### Comparison metrics architecture

`logic/comparisonMetrics.ts` builds the compact comparison-table rows (Repulsion, Control, Durability, Feel, Tension Retention, Hitting Sound, Power, Comfort, Overall Specialist Rating, Retail Availability, Package Options, Retailer Count) from the same existing data sources: manufacturer ratings (`data/strings.ts`), specialist dimensions (`data/stringSpecialistProfiles.ts`), and retailer listings (`services/retailerPriceService.ts`, reusing its own `orderRetailerListings`/`AVAILABILITY_LABELS`/`PACKAGE_TYPE_LABELS`). Numeric metrics render as a 5-dot indicator (`Math.round(value / max * 5)`); categorical ones (Feel, Retail Availability, Package Options) render as plain text. "Power" is deliberately distinct from "Repulsion": Repulsion is the raw manufacturer number, Power is the specialist layer's own average of `easyPower`/`hardHitterFit`/`attackSmash` (a different, existing question — suitability for power players — not a new one). Nothing here filters, sorts, or scores strings.

### UI philosophy

- **`RecommendationResult.tsx`** — the Best Match card is now a fuller "product page": headline + badges + the engine's explanation + a specialist player-level-fit line + a Strengths/Trade-offs two-column list + manufacturer stat bars + the Smash Lab specialist panel + a "Where to Buy" retailer section (or a plain "no listings yet" note instead of just disappearing). The Cross-Brand Alternative and Specialist Choice cards now include the same per-alternative reasoning bullets.
- **`ComparisonTable.tsx`** — a real `<table>` (not another chart) is one of two peer views in the 2–3-string comparison panel in `StringComparison.tsx`, switched via a Radar/Table control (see the "Polish revision" section below for the current default and behavior).
- Compact dot/text indicators, badges, and section headings all reuse the app's existing visual language (`rounded-2xl`/`rounded-full`, `court-`/`shuttle-`/`ink-` color tokens, the `focus-ring` utility) rather than introducing a new one.
- **Mobile nav** — `Nav.tsx`'s Strings/FAQ/Contact links previously vanished below the `sm` breakpoint with no replacement; there's now an accessible hamburger menu (`aria-expanded`, `aria-controls`) for small screens.
- **Offline state** — `OfflineBanner.tsx` is a small, purely additive banner (`navigator.onLine` + the `online`/`offline` window events) explaining that prices/stock/retailer data may be stale — it never blocks or changes any feature, since every data hook already degrades gracefully on its own.

### Accessibility

- The finder-results page now has exactly one `<h1>` (the recommended string's name) with a clean `h1 → h2 → h3` hierarchy through the Best Match panel (previously an `h2` with no page-level heading in that view).
- `ComparisonTable.tsx` uses a semantic `<table>` with `scope="col"`/`scope="row"` headers and a screen-reader-only `<caption>`; dot indicators are `aria-hidden` with the real value exposed via visible or `sr-only` text.
- The new mobile nav toggle is a real `<button>` with `aria-expanded`/`aria-controls`/`aria-label`, keyboard-operable like every other control in the app (all new interactive elements use the existing `focus-ring` utility).
- No existing accessibility behavior was reduced or removed.

### Performance

- `RecommendationResult.tsx` wraps the `recommendStrings()`/`recommendTension()` calls and the new `buildStructuredExplanation()`/`buildAlternativeReasons()` calls in `useMemo`, so they only recompute when their actual inputs (answers/pool/specialistProfiles, or the specific scored candidate) change — not on every unrelated re-render (e.g. retailer listings resolving after first paint).
- No new loading states, lazy-loading, or code-splitting were introduced beyond that — the existing instant-local-fallback-then-live-update architecture (Phase 2/4/6/7) already avoids spinners, and Vite's own chunking is unchanged. Recommendation calculations themselves are untouched.

### Manual testing checklist

1. Take the quiz through to a result — confirm the Best Match id, match percentage, and headline are unchanged from before Phase 8 for the same answers (cross-check against `npm run test:ui`'s fixture values).
2. Confirm the Best Match card shows a headline, strengths, trade-offs, manufacturer stat bars, the specialist panel (when one exists), and either purchase options or a "no listings yet" note.
3. Confirm the Cross-Brand Alternative and Specialist Choice cards show at least one "why choose this" bullet when the underlying data supports one, and none when it genuinely doesn't (no fabricated reasons).
4. Open Compare, select 2–3 strings, confirm the Radar/Table switch works both ways and the table shows all 12 metrics with dot/text indicators (see the "Polish revision" section below for the current Radar-first default).
5. Resize to 320px, 375px, 390px, 768px, and 1024px — confirm the mobile nav hamburger works, the Best Match card and comparison table never overflow horizontally, and touch targets stay comfortably tappable.
6. Tab through the finder results and the comparison table using only the keyboard — confirm every interactive element reachable and visibly focused.
7. Turn off networking (or toggle airplane mode) — confirm the offline banner appears and the app continues to function on its existing local/fallback data.

### Polish revision

A focused, real-browser-driven visual polish pass on top of the Phase 8 base above — still UI-only: no changes to recommendation scoring, ranking, weights, tension logic, specialist selection, the database schema, migrations, retailer logic, or inventory logic.

**Wider result-page layout.** `RecommendationResult.tsx`'s outer container grows progressively with the viewport (`max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl`) instead of staying fixed at `max-w-3xl`, so the page uses the available space at 1440px/1920px without the wide empty margins it had before. Paragraph text (the explanation, the tension note) stays capped at `max-w-2xl` inside the wider card so lines never get too long to read comfortably, while badges, the Strengths/Trade-offs grid, and — at `lg`+ — a Manufacturer Ratings / Specialist panel two-column layout use the full card width.

**Hero polish.** The string name scales up to `lg:text-6xl` on large screens (capped so it never wraps awkwardly), the match percentage/brand/name/badge spacing was opened up slightly, and a second, very subtle decorative layer (`.string-grid`, an existing-but-previously-unused CSS weave pattern from `index.css`, at 7% opacity) was added underneath the pre-existing `.court-lines` texture — both are static line patterns (nothing to reduce for `prefers-reduced-motion`, no image asset, no measurable effect on legibility or contrast).

**String color swatches.** Investigated `data/strings.ts` and `services/inventoryService.ts` before implementing: `StringItem` already has a `colors?: string[]` field (populated via the existing admin "Colors" text input in `CatalogStringForm.tsx`, comma-separated), and `inventory` rows separately carry their own single `color?: string` field — but `mergeInventoryIntoCatalog()` never passes that inventory color onto the merged `StringItem` it produces. Plumbing the inventory color through would mean changing inventory-merge logic, explicitly out of scope for this UI-only phase, so the new `logic/stringColor.ts` reads **only** `StringItem.colors`. This means the swatch renders for any string with populated `colors` data (verified with temporary test data during browser verification, then reverted — no catalog data changes are part of this commit) and quietly renders nothing for the many real catalog strings that don't have `colors` set yet, which is correct per the brief ("if no color data exists, show no swatch"). A future phase could plumb the inventory `color` field through if per-variant color is wanted; that would require a small, explicit change to `mergeInventoryIntoCatalog()`.

`resolveStringColor()`/`primaryStringColor()`/`allStringColors()` map a fixed, deterministic table of common color names (yellow, white, black, red, blue, green, orange, pink, purple, silver, grey/gray, natural, neon yellow, turquoise, lime) — case-insensitively, title-cased for display — to a hex value and a Tailwind ring class; an unrecognized name (or no `colors` at all) always resolves to no swatch, never a guessed placeholder. White/black/silver/natural/neon-yellow get a stronger ring for visibility against both light and dark backgrounds (including the dark hero); other colors get a subtler one. `StringColorSwatch.tsx` renders it as a circular `<span>` with an explicit `aria-label`/`title` ("String color: Yellow") — the value is never conveyed by color alone. Used in the Best Match hero, both alternative cards, catalog cards (`StringCard.tsx`, up to 3 deduplicated swatches), and comparison headings/chips (`ComparisonTable.tsx`, `StringComparison.tsx`'s "Comparing N strings" chips) — always the single primary swatch in compact contexts, never competing with the chart-series legend dot that sits next to it (a small solid circle with no ring, communicating a different thing: "which polygon/column is this string," not its physical color).

**Manufacturer rating spacing.** `StatBars.tsx` now uses `space-y-3` instead of `space-y-2` for its normal (non-`compact`) usage — used on the Best Match card — while the `compact` variant used in catalog cards is unchanged, keeping the browse grid exactly as tall as before.

**Alternative card differentiation.** `AlternativeCard` in `RecommendationResult.tsx` takes a `variant: 'cross-brand' | 'specialist'` prop driving a subtle left border stripe and matching title color — sky blue/cyan for the Cross-Brand Alternative, gold (the existing `shuttle` accent color) for the Specialist Choice — rather than a fully-colored card, so both stay visually subordinate to the Best Match panel and part of the same palette.

**Catalog description disclosure.** A new pure helper, `logic/textClamp.ts`'s `needsClamp()`, decides (by character-count threshold, not a DOM measurement) whether a string's `notes` text is long enough to warrant clamping. `StringCard.tsx` renders long descriptions with Tailwind's `line-clamp-3` plus an accessible "Read more"/"Show less" `<button aria-expanded>` toggle; short descriptions render in full with no control at all. This makes same-row card heights far more consistent without ever permanently hiding text.

**Catalog radar size.** `RadarChart.tsx` gained a `maxWidthClassName` prop (default unchanged at `max-w-[260px]`) controlling the CSS cap on its rendered size — previously hardcoded, so the `size` number prop never actually changed anything on screen. The catalog card radar (`StringCard.tsx`) now uses `max-w-[320px]` (a 23% increase). While fixing this, a real bug surfaced and was fixed: `RadarChart`'s outer wrapper `<div>` had no width class, which is harmless in a normal block-flow parent but collapses to the SVG's UA-default 300×150 intrinsic size when the parent is a flex/grid container (as the new comparison radar's centering wrapper is) — `w-full` was added to that wrapper so the chart's own `max-w`/`w-full` classes are always what controls its rendered size, confirmed via direct DOM measurement (see "Browser verification" in the Phase 8 report).

**Radar-first comparison, with a Table peer.** `StringComparison.tsx`'s 2–3-string comparison panel now defaults to the radar chart (`max-w-[380px] sm:max-w-[460px]`, up from the old always-shown 280px overlay) as the primary, prominent view, with a "Radar | Table" segmented control (same visual pattern as the existing "Performance view: Bars/Radar" toggle) letting a visitor switch to the full `ComparisonTable` and back. The choice is remembered for the current browser tab only via `sessionStorage` (`logic/comparisonViewPreference.ts`; wrapped in try/catch so a throwing/unavailable storage — private browsing, embedded contexts — never breaks the page, it just won't be remembered next time) — no account or database persistence, per the brief. Both views read the exact same `getPerformanceValues()`/`buildComparisonRows()` data; switching between them never changes what's shown, only how.

**Comparison panel polish.** The panel header is now a proper `<h3>` with the compared strings' chips (chart-series dot + physical-color swatch when known + name) on their own line, and "Clear comparison" is a bordered pill button rather than a plain text link — all reusing existing visual patterns.

**Accessibility.** The Radar/Table switch is a real button group with `aria-pressed` reflecting the selected view (verified via `getAttribute('aria-pressed')` in a real browser, not just visual inspection) and is fully keyboard-operable. Color swatches always carry `aria-label`/`title`. The "Read more"/"Show less" toggle uses `aria-expanded`. Heading hierarchy, focus states, and every other Phase 8 accessibility property are unchanged.

**Performance.** No new chart library, no image assets — the existing `RadarChart.tsx` SVG component is reused as-is (with the width-class fix above). `needsClamp()` and the color-swatch resolvers are cheap, pure, and not memoized (not worth the complexity at this data size); `RecommendationResult.tsx`'s existing `useMemo` wrapping is unchanged.

**Manual verification checklist (polish revision).**

1. At 1440px and 1920px, confirm the result page uses noticeably more width than before with no huge empty margins and no stretched-looking cards; paragraph text should still read as normal-length lines, not edge-to-edge.
2. Confirm the Best Match panel shows a color swatch preview below its stock badge when the string has recognized color data, and shows nothing when it doesn't (never a placeholder circle) — see the "Catalog & color experience (Phase 9)" section below for the current multi-swatch/hybrid-split design, which superseded the single-swatch-next-to-the-name version described here.
3. Confirm the Cross-Brand Alternative card has a blue/cyan left accent and the Specialist Choice card has a gold left accent, both still reading as part of the same design system as the Best Match card.
4. On the catalog page, switch Performance View to Radar and confirm the charts are visibly larger than before with no clipped labels; expand/collapse a long description with "Read more"/"Show less" and confirm no layout jump breaks the grid.
5. Select 2–3 strings to compare and confirm Radar is selected by default, the chart is large and centered, switching to Table and back to Radar both work, and reloading the page within the same tab remembers your last choice.
6. Resize to 320px/375px/390px/768px/1024px and confirm no page ever scrolls horizontally (checked via `document.body.scrollWidth` against the viewport width in every case during browser verification), the comparison table still scrolls within its own container on mobile, and the hamburger nav still works.

## Catalog & color experience (Phase 9)

Phase 9 is a catalog-and-comparison-presentation pass — no changes to recommendation scoring, ranking, weights, tension logic, specialist logic, retailer architecture, retailer pricing, Supabase authentication, RLS, or existing migrations. No new database migration was needed: the public `StringItem` shape already had room for a display-only `inventoryColor` field, so color data is fully supportable with the existing schema.

### String color investigation

Re-investigated the existing color data end to end before implementing anything:

- **Catalog colors** — `StringItem.colors?: string[]` (`data/strings.ts`), editable via the admin "Colors" comma-separated text field (`CatalogStringForm.tsx`). Flows straight onto the public `StringItem` — no plumbing gap. The real gap: no string in the actual catalog has this populated yet (an admin-data gap, not a code gap).
- **Inventory colors** — `inventory.color` (`services/inventoryService.ts`), editable via the Inventory admin page (`InventoryAdminRow.tsx`). Fetched into `InventoryMap[id].color`, but `mergeInventoryIntoCatalog()` silently dropped it instead of passing it onto the merged `StringItem` — this was the more significant reason swatches were invisible: even a real, admin-entered inventory color could never reach the UI.
- **Hybrid colors** — `mainString.color`/`crossString.color` already existed on hybrid catalog rows and already flowed onto `StringItem`, but nothing rendered them as a combined swatch.
- Inventory variants are linked to strings via `stringId`, the same key used everywhere else in the admin/public split — reliable, no separate lookup needed.

Both real gaps are now closed: `mergeInventoryIntoCatalog()` additionally sets `StringItem.inventoryColor` from the live row (alongside the pre-existing `stock`/`setsAvailable` merge — still purely presentational, never touching a recommendation-relevant field), and `logic/stringColor.ts`'s new `buildColorPreview()` merges it with catalog colors under the priority rules below. No catalog data was added as part of this commit — real swatches only start appearing once colors are entered through the admin pages.

### Inventory/catalog color priority

`buildColorPreview(item, maxVisible = 3)` in `logic/stringColor.ts` is the single entry point every swatch-rendering component uses, in this order:

1. **Available inventory color** — the string's `inventoryColor`, but only counted as "available" when the string's `stock` is not `unavailable` (low stock still counts). An out-of-stock inventory color is excluded and the UI falls back to catalog colors instead of showing a color that's no longer on hand.
2. **Catalog colors** — the remaining `colors` list, alphabetically tie-broken, with the inventory color's own hex excluded so it never appears twice.
3. **No swatch** — if neither source resolves to a recognized color.

An unrecognized inventory color name never blocks catalog colors from showing (it's simply skipped, falling through to catalog). Case-insensitive duplicates (`"Yellow"`/`"yellow"`) are merged into one. Ordering is fully deterministic — colors are never shuffled between renders. Catalog and inventory logic stay in separate functions/modules; this priority merge is the only place they meet.

### Color mapping & unknown-color behavior

As of the second fix round below, color names resolve through a **layered, mostly-automatic resolver** (`logic/stringColor.ts`'s `resolveColor()`) rather than a large fixed name table — see that section for the full six-tier order (explicit CSS syntax → explicit override → exact CSS keyword → automatic base-color inference → a small alias table → unresolved). An unrecognized color name is still **never** guessed or invented: it's omitted from the swatch preview, while the raw string is retained for admin diagnostics (see below).

### Color swatch preview & expansion

`ColorSwatchPreview.tsx` renders circles only — no visible color names on cards. Up to 3 colors show directly; a 4th-and-beyond collapses into a `+N` button that **expands and collapses** inline (no modal, no permanent truncation) with `aria-expanded` correctly reflecting live state and an `aria-label` describing the action ("Show 2 more colors" / "Show fewer colors"). Every swatch — visible or expanded — carries a `title`/`aria-label` naming the color, so the information is always available to assistive technology even though it's never printed as text. Fully keyboard- and touch-accessible.

### Hybrid color swatch

A single split circle (CSS `conic-gradient`, diagonal, no image or extra SVG) renders when the hybrid's colors resolve, in priority order (see `logic/stringColor.ts`'s `hybridColorSource()`): (1) structured `mainString.color`/`crossString.color` metadata from the catalog admin's dedicated hybrid fields — e.g. `aria-label="Hybrid string colors: White main, Red cross"`; (2) if neither structured side is set, a legacy combined inventory value that parses unambiguously as `"Main/Cross"` (added in the fix round below — this is what makes AeroBite/AeroBite Boost show a split swatch from real-world data entered before the catalog admin's hybrid color fields existed). If only one side is known, it renders as an ordinary single solid swatch rather than a misleading half-invented split; if neither side is known, nothing renders. A hybrid never falls back to its own top-level `colors` list, since that could misrepresent which side is which. Missing hybrid color data is recorded in the admin color diagnostics, not hidden silently.

### Placement

Swatches sit directly beside the string name (moved there in the fix round below, after real-world testing found a swatch beneath the stock badge felt visually disconnected) — in catalog cards (`StringCard.tsx`), the Best Match hero and detail heading and alternative cards (`RecommendationResult.tsx`), comparison chips and the comparison table's column headings (`StringComparison.tsx`, `ComparisonTable.tsx`), and the relevant admin previews (`CatalogAdminCard.tsx` for catalog colors, `InventoryAdminRow.tsx` for the in-stock color). The stock badge stays in its own upper-right corner. They're never repeated inside every comparison metric row.

### Comparison experience improvements

- **Comparison chips** — replaced the plain legend row with removable chips: chart-series dot + string name + a per-string `✕` remove button (in addition to the existing "Clear comparison," which still clears all at once). As of the second fix round below, the chips no longer also show a physical color-swatch preview or the chart-vs-physical-color hint text — that made the compact chip row feel visually overloaded; physical colors remain visible in catalog cards, recommendation cards, and the comparison table's own column headings, just not repeated inside the chip.
- **Bigger radar** — the default comparison view's chart cap grew again this phase, to `max-w-[440px] sm:max-w-[620px] lg:max-w-[760px] xl:max-w-[840px]`, so it reads as the comparison panel's primary visualization rather than a small chart in a lot of empty space, without clipping any axis labels. Radar values themselves are unchanged.
- **Full-width table** — `ComparisonTable.tsx`'s `<table>` uses `w-full` so its columns stretch to use the panel's full width on desktop for both 2- and 3-string comparisons, while still scrolling horizontally within its own container on mobile.
- **Radar/Table switch** — unchanged in spirit: a segmented control, Radar the default, the choice remembered for the current tab only via `sessionStorage` (no database persistence, no reload).

### Version source of truth & admin footer

`package.json`'s `"version"` field (`"0.8.0-beta.0"`) is the single source of truth. `vite.config.ts` reads it at build time via Node's `readFileSync` and bakes it into the bundle through Vite's `define` (`import.meta.env.APP_VERSION`) — no manual duplication anywhere else, and no secret env values are ever touched. `logic/version.ts`'s `getRuntimeVersionInfo()` turns that raw string into a display form (`formatDisplayVersion` drops a trailing `.0` prerelease build number, so `"0.8.0-beta.0"` displays as `"v0.8.0-beta"`) and an environment label from `import.meta.env.PROD` (`"Production"`/`"Development"` — never a secret value). `AdminApp.tsx` renders a subtle footer: `Smash Lab Admin · v0.8.0-beta · Production`. The public site intentionally shows no version badge — this stays admin-only.

### Admin color diagnostics

`logic/colorDiagnostics.ts`'s `summarizeColorDiagnostics()` extends the existing `/debug/supabase` diagnostics page (no new dashboard) with: strings with an inventory color, strings with catalog colors, strings with neither, unrecognized color values (with the raw text preserved), same-string case-insensitive duplicate colors, hybrid strings missing a main or cross color, inventory colors currently hidden because the string is out of stock, and the total count of unique mapped colors across the whole catalog.

### Admin form review

`catalogAdminService.ts`'s `parseColors()` was fixed to deduplicate case-insensitively (previously it only trimmed and dropped blanks, so `"Yellow, yellow"` could save as two colors). Confirmed comma-separated parsing, trimming, and blank-removal were already otherwise safe. Added clarifying helper text to the catalog "Colors" field and the hybrid Main/Cross color fields (`CatalogStringForm.tsx`) and to the Inventory "Color" field (`InventoryAdminRow.tsx`), explaining the inventory-over-catalog priority in plain language. The form itself was not redesigned.

### Accessibility

Color is never the only source of information — every swatch carries a `title`/`aria-label`, the `+N` control has `aria-expanded` and a descriptive `aria-label`, chip remove buttons have accessible labels and a comfortable touch target, the Radar/Table switch retains its `aria-pressed` state, and `ComparisonTable.tsx` keeps semantic `<table>` markup throughout. Visible color names are intentionally omitted from compact cards but remain available via tooltip/title and to assistive technology.

### Performance

No new chart, animation, or color-mapping libraries; no runtime network requests for color resolution; no new image assets. The hybrid split-swatch reuses a plain CSS `conic-gradient`. Color resolution and diagnostics are cheap, pure, and deterministic.

### Manual verification checklist (Phase 9)

1. Catalog at 1440px/1920px/375px: confirm 1, 3, and 4+ colors render correctly (dots, then `+N`), and that `+N` expands and collapses on click and via keyboard.
2. Confirm a hybrid string with both main and cross colors known renders one true split circle, and that a string with no color data renders no swatch at all.
3. Comparison with 2 and 3 strings: confirm Radar is selected by default and visibly larger, switching to Table shows a full-width table with no empty right-hand gutter, chips show both the chart dot and physical swatches, and removing one chip via its `✕` deselects only that string.
4. Resize to 375px/1024px and confirm no horizontal page scroll, with the comparison table still scrolling only within its own container.
5. In the admin panel, confirm the footer reads `Smash Lab Admin · v0.8.0-beta · <Production|Development>` depending on how the app was built, and that `/debug/supabase` shows the new color-diagnostics figures.
6. In the catalog/inventory admin forms, confirm saving `"Yellow, yellow"` in Colors stores only one color, and that the new helper text reads clearly.

### Likely Phase 10 scope

Populating real catalog/inventory color data now that the pipeline exists; possibly surfacing a compact color filter on the catalog page; considering an optional inline radar-zoom control if user feedback asks for it; continued attention to comparison-table responsiveness at tablet widths.

### Phase 9 fix round — real Supabase findings

Real-world testing against the deployed Supabase project surfaced gaps a synthetic/local-only pass hadn't: the inventory admin only ever had one free-text `color` field per row (so a stringer with multiple currently-available colors had nowhere else to put them), combined values like `"White/Red"` weren't parsed, `AeroBite`/`AeroBite Boost` never showed a public split swatch, `Cosmic Gold` and the misspelling `Turquois` weren't recognized, and a single swatch beneath the stock badge read as visually disconnected from the name. This round fixes all of that — still without touching recommendation scoring, ranking, tension logic, specialist selection, retailer architecture, Supabase auth/RLS, or existing migrations.

**Inventory schema investigation (no migration).** `public.inventory` has `string_id text primary key references public.strings(id)` — one row per string, by construction. `inventory.color` is a plain nullable `text` column, not an array or JSON. This means true "one inventory row per color variant" (the cleanest model) would require a schema migration: dropping the single-column primary key in favor of either a composite key or a new surrogate id with a non-unique `string_id` foreign key, plus updated RLS policies, `adminInventoryService.ts` queries, the `InventoryMap` type (`Record<string, InventorySnapshot>` → `Record<string, InventorySnapshot[]>`), and the seed script. That's a real, non-trivial change, so per the brief this round **stops short of it** and instead safely extends the *existing* single-text-field model: `logic/colorParsing.ts`'s `splitColorList()` parses the one `color` value on comma/semicolon boundaries (never on a slash, and never on internal spaces, so `"Sky Blue"` stays intact), so `"White, Red"` or `"White; Red"` now render as two swatches instead of one unresolved blob. If genuine multiple-inventory-row support becomes worth the migration, that's a Phase 10-scoped, pre-approved decision — not made unilaterally here.

**Legacy combined values.** A bare slash (`"Black/Yellow"`) is never guessed apart into two ordinary colors — too ambiguous, and flagged in diagnostics as an ambiguous slash value instead. The one exception: for a **hybrid** string with no structured `mainString.color`/`crossString.color` set, `logic/colorParsing.ts`'s `parseLegacyHybridPair()` reads an unambiguous `"Main/Cross"` value (exactly one slash, a non-empty, non-list token on each side) as that hybrid's main/cross pair — this is what makes AeroBite (`"White/Red"`) and AeroBite Boost (`"Black/Yellow"`) show a real split swatch from data that was only ever entered as a single inventory-color string, before the catalog admin's dedicated hybrid color fields existed.

**Special color names.** Added `Cosmic Gold` to `logic/stringColor.ts`'s color table, and a small, centralized alias map (`COLOR_ALIASES`) mapping the legacy misspelling `Turquois` to canonical `Turquoise` — display and accessible labels always show the canonical spelling, the stored raw value is never rewritten. `Sky Blue` and the rest of the originally-required list were already supported.

**Swatch placement.** Moved from beneath the stock badge to directly beside the string name — `StringCard.tsx`'s heading, `RecommendationResult.tsx`'s hero `<h1>`, "Best Match" detail `<h2>`, and alternative-card `<h4>`s. The stock badge stays in its own upper-right corner; nothing needed to change in the comparison chips/table, which already placed swatches next to the name and automatically pick up the corrected color-resolution logic.

**Admin color entry.** The inventory Color field's helper text now explains it holds one color per row, with commas/semicolons as a supported (but secondary) way to list more than one until real per-variant rows exist; a live warning appears if a bare `/` is typed into a non-hybrid row (a hybrid row instead gets guidance to use `"Main/Cross"` as a fallback, or — preferably — the catalog admin's own Main/Cross fields). The catalog Colors field now accepts semicolons alongside commas and shows a live swatch preview with an inline "unmapped" warning for anything unrecognized (never blocking save). Both the Inventory admin row and Catalog admin card previews now show the resolved swatch(es) beside the raw text, with a "⚠ Needs mapping" marker for anything that doesn't resolve.

**Diagnostics.** `logic/colorDiagnostics.ts` gained: inventory values containing a comma/semicolon, ambiguous slash values not resolved as a hybrid pair, canonicalized aliases actually in use (raw → canonical, e.g. `"Turquois → Turquoise"`), a count of strings with multiple available inventory colors, and separate counts of hybrids resolved via structured colors vs. the legacy combined-value fallback — all surfaced on the existing `/debug/supabase` page, no new dashboard.

**Mobile decimal input.** Every admin numeric field (catalog ratings/gauge/cost/tension, specialist personal-tension range and dimension scores, retailer price/package length) validated user text with `Number(trimmed)`, which never accepts a comma as a decimal separator — the actual root cause of "10,5 rejected" on mobile keyboards that offer comma as the primary decimal key, not `type="number"`, zod, or a form library (this app uses neither). Every one of those parsers now runs the text through `logic/decimalInput.ts`'s `normalizeDecimalInput()` first, which replaces `,` with `.` before parsing — `"10,5"` and `"10.5"` now produce the identical result, malformed input (`"5,,"`, `"5.5.5"`) still fails exactly as before, and range/precision/integer checks are untouched. `CatalogStringForm.tsx`'s `NumberField` also always requests `inputMode="decimal"` now (previously a negative-allowing field like tension adjustment fell back to a plain `"text"` keyboard, losing the numeric keypad on mobile entirely).

### Manual verification checklist (fix round)

1. Catalog: confirm BG66 Force/White, BG66 Ultimax/Green, BG80/Sky Blue, Exbolt 65/Purple, and Exbolt 63/White each show one correctly-colored swatch beside the name; confirm Exbolt 68 shows a teal swatch labeled "Turquoise" (from stored `"Turquois"`) and Nanogy 95 shows a gold swatch labeled "Cosmic Gold".
2. Confirm AeroBite shows a White/Red split swatch and AeroBite Boost shows a Black/Yellow split swatch, both from a single combined inventory value, with no structured hybrid colors set.
3. Confirm a string with 5 available colors shows 3 dots + a working `+2` that expands and collapses.
4. In Compare, confirm chips/table still show the corrected swatches with no layout regression.
5. In the admin panel (requires real Supabase), confirm: an inventory row with `"White, Red"` shows two swatches with a "will be shown as 2 separate colors" note; a bare `/` in a non-hybrid row shows the ambiguity warning; the catalog Colors field flags an unmapped entry without blocking save; `/debug/supabase` shows the new delimiter/alias/legacy-fallback diagnostics.
6. On a mobile device or narrow viewport, confirm a decimal admin field (e.g. a catalog rating) accepts both "10.5" and "10,5" identically.

### Real Supabase cleanup checklist (for the site owner)

Not code changes — data hygiene the diagnostics page above is built to help with by hand:

- Review "Ambiguous slash-separated values" and either split them into a comma-separated list (if they're really two colors) or leave them if they're an intentional hybrid main/cross pair.
- Review "Legacy/misspelled color aliases in use" and consider correcting the stored spelling to the canonical form (not required — the alias will keep resolving correctly either way).
- Review "Strings with multiple available inventory colors" — if a string consistently needs more than one color, that's the strongest signal it's worth approving the multiple-inventory-rows migration described above.
- Review "Hybrids using a legacy combined-value fallback" and, when convenient, move that data into the catalog admin's structured Main/Cross color fields instead — it'll keep working as-is either way, but the structured fields are the more precise, future-proof home for it.

### Phase 9 fix round 2 — automatic color resolver & a clearer hybrid workflow

Real testing showed the fixed name-to-hex table from the rounds above couldn't keep up: every new manufacturer color name ("Fire Orange", "Ivory White") needed a code change, hybrid strings still felt confusing, and the comparison chips felt visually busy. This round replaces the fixed table with a **layered, mostly-automatic resolver**, clarifies the hybrid color workflow, and simplifies the chips — still with no changes to recommendation scoring, ranking, tension logic, specialist selection, retailer architecture, Supabase auth/RLS, or existing migrations.

#### Layered color resolution order

`logic/stringColor.ts`'s `resolveColor(name, override?)` is the new single entry point, trying each tier in order and stopping at the first match:

1. **`explicit_css`** — the raw name is itself valid CSS syntax (a hex code, `rgb()`, or `hsl()`) — e.g. a string entered as `"#ff6600"` directly.
2. **`explicit_override`** — a separately stored, validated CSS value takes priority over automatic resolution of the name (currently available for hybrid main/cross sides only — see "Manual color override" below).
3. **`css_named_color`** — the raw name is exactly one standard CSS color keyword (e.g. `"orange"`).
4. **`inferred_keyword`** — **the core of "minimal hard-coded names."** The name is tokenized and checked for a recognizable base-color word, checked from the *end* of the name backward (manufacturer names consistently put the base color last): `"Fire Orange"` → `orange`, `"Ivory White"` → `white`, `"Cosmic Gold"` → `gold`, `"Royal Blue"` → `blue`, `"Neon Yellow"` → `yellow`. Multi-word base colors (`"sky blue"`) are matched as a whole phrase, not split.
5. **`alias`** — a small, explicit table (see below) for the few cases inference genuinely can't handle.
6. **`unresolved`** — no automatic match. Never guessed: the public site renders no swatch, and the raw name is kept for admin diagnostics.

Every resolution returns `{ rawName, displayName, cssColor, ringClassName, source, confidence, warning?, canonicalKey }` — `source` and `confidence` are what the admin previews and diagnostics use to explain *why* something rendered the way it did.

#### Safe CSS value rules

`logic/cssColor.ts`'s `isSafeCssColor()` is a strict allowlist: a valid hex (3/4/6/8-digit), `rgb()`/`rgba()`/`hsl()`/`hsla()` (both comma- and CSS4 space-separated syntax, e.g. `hsl(24 100% 50%)`), or one of the ~150 standard CSS Level 4 named-color keywords. `url(...)`, `var(...)`, `calc(...)`, semicolons, braces, and anything else are rejected outright before any shape-matching even runs. This same function backs both tier 1 (is the raw name itself CSS?) and the override validator.

#### Automatic base-color inference

`logic/baseColorInference.ts` holds a compact, fixed set of ~24 base colors (red, orange, yellow, lime, green, mint, turquoise, cyan, sky blue, blue, navy, purple, violet, pink, coral, white, ivory, black, gray, silver, gold, natural, beige, brown) — real CSS keywords wherever one reads well, a small hand-picked hex only where no keyword gives adequate visibility (yellow, mint, natural). This is deliberately **not** a manufacturer-name table: it's the fixed vocabulary of common color *words* the inference step looks for inside a longer name. The original display label is always preserved (a tooltip still says "Fire Orange"), even though the rendered swatch uses the inferred base color.

#### Remaining aliases (and why each exists)

Only two entries remain in `logic/baseColorInference.ts`'s `ALIASES` table:

- `"Turquois"` → `"turquoise"` — a real misspelling found in production data; inference can't fix a misspelled single word.
- `"Grey"` → `"gray"` — canonicalizes the alternate spelling to one consistent display label. (Checked *before* the exact-CSS-keyword tier, as a deliberate, documented exception — "grey" is itself also a valid CSS keyword, so left in the general listed order it would never reach the alias table at all.)

Cosmic Gold, Fire Orange, Royal Blue, and Neon Yellow are explicitly **not** alias entries — they resolve automatically through inference instead, exactly as intended.

#### Unresolved names

Names with no recognizable base color (`"Ocean"`, `"Flash"`, `"Pearl"`, `"Ice"`, `"Smoke"`, `"Graphite"`, `"Amber"`) stay unresolved rather than guessed. Publicly, no swatch renders. In the admin previews (`InventoryAdminRow.tsx`'s `ColorNameField`, `CatalogAdminCard.tsx`'s hybrid preview), the raw text stays visible with a "Needs color value"/"Needs mapping" marker — never blocking save.

#### Manual color override

An admin can pair a manufacturer color name with an explicit CSS override that takes priority over automatic resolution — implemented for **hybrid main/cross sides only** (`CatalogStringForm.tsx`'s `HybridColorField`, a text field plus a native `<input type="color">` for convenience, both writing the same validated value). Persisted as `HybridStringMeta.colorOverride` inside the existing `main_string_meta`/`cross_string_meta` **jsonb** columns — adding a new optional key to an already-flexible jsonb blob is not a schema migration, so no database change was needed for this part. An invalid override value is rejected with a form error rather than silently dropped or saved unsafely.

**Plain (non-hybrid) catalog colors and the single inventory `color` text field have no separate override slot** — `strings.colors` is a `text[]` (can't attach a parallel override to one array element without a type change) and `inventory.color` is a single `text` column. Adding a genuine override there would need a real migration (e.g. a new `color_override text` column, or converting `colors` to a `jsonb` array of `{name, cssOverride}`). **That migration was not made this round** — per the brief, only the automatic resolver was implemented, and this proposal is reported here for approval rather than applied. In the meantime, typing a hex/rgb()/hsl() value directly into the existing Colors/Color field already works immediately (tier 1 of the resolver) — a real, if less structured, way to force an exact color today.

#### Hybrid package/schema findings (Part 10) — no migration made

Investigated `public.inventory.package_type`'s constraint: `check (package_type in ('reel', 'set', 'mixed', 'unknown'))`. The requested `Set / Reel / Hybrid Set / Hybrid Reel / Other` options aren't representable under this constraint — introducing them would need an `ALTER TABLE ... DROP CONSTRAINT` + a new `CHECK`, plus a safe data-conversion rule for existing `'mixed'`/`'unknown'` rows (e.g. `'mixed' → 'other'`, `'unknown' → 'other'`). **Not implemented** — reported here for approval. Instead, the *functional* goal (show Main/Cross fields only for a hybrid string) was achieved using the catalog's existing `is_hybrid` flag, which the inventory admin already had plumbed in from the prior round — no schema change needed for that part.

#### Hybrid color priority (updated)

`hybridColorSource()`'s priority, in the terms this app can actually represent without a migration:

1. **Structured catalog `mainString.color`/`crossString.color`**, each honoring its own override first (folded into tiers 2-3 of `resolveColor()` per side) — `'structured-both'` when both resolve, `'structured-partial'` when only one does.
2. **The inventory row's single legacy text value** — a genuine `"Main/Cross"` pair (exactly one slash, two clean tokens) becomes a real split (`'legacy-pair'`); a single plain value with no delimiter becomes `'legacy-solid'` (we don't know which side it names, so it renders as one ordinary swatch). A comma/semicolon-separated value (`"White, Red"`) is **never** treated as a hybrid pair — that's an ordinary two-color list, and a hybrid never reads its own top-level `colors`/inventory list that way regardless.
3. **`'none'`** otherwise.

#### Hybrid form behavior — no more slashes to type

`InventoryAdminRow.tsx` now shows two separate "Main string color" / "Cross string color" fields for a hybrid string (instead of one ambiguous "Color" field with slash guidance) — on save, they're joined into the same single legacy `"Main/Cross"` text value the resolver already knows how to split back apart, so the admin never types the slash themselves. Editing pre-fills both fields only when the stored value already parses as a clean pair. `CatalogStringForm.tsx`'s hybrid Main/Cross fields gained the paired name + override + native color-picker UI described above.

#### Comparison chip simplification

Chips now show only the chart-series dot, the string name, and the remove button — the physical color-swatch preview and the "chart color · physical string color" hint were removed from the compact chip row, which real testing found visually overloaded. Physical colors remain visible in catalog cards, the Best Match hero/detail, alternative cards, and the comparison table's own column headings. Radar (default), Table, the segmented switch, and all comparison logic are unchanged.

#### Likely future: a reusable color-definition table

If the inventory package-type migration above is ever approved, a natural companion would be a small `color_definitions` table (canonical key, display label, css value, ring treatment) that both this resolver's base-color set and any future admin override UI could read from — turning today's two static TypeScript modules (`baseColorInference.ts`, the alias table) into editable data without a code deploy. Not needed yet: the current in-code table is small, stable, and exactly matches "minimal hard-coded names."

### Manual verification checklist (fix round 2)

1. Catalog: confirm "Fire Orange", "Ivory White", "Royal Blue", "Neon Yellow" each render one correctly-colored swatch beside the name (orange/white/blue/yellow respectively), and that "Cosmic Gold"/"Turquois" (from the earlier round) still resolve correctly.
2. Confirm an unresolved name ("Ocean") renders no swatch at all, publicly.
3. Confirm a hybrid side with an unresolvable name ("Ocean") plus a valid explicit override (e.g. `#1ca3ec`) renders that override color as one half of the split swatch.
4. Confirm AeroBite/AeroBite Boost-style legacy `"Main/Cross"` inventory values still produce a real split swatch with no structured catalog colors set.
5. Confirm comparison chips show only the chart dot, name, and remove button (no physical swatch, no hint text), while the comparison table's column headings still show physical swatches.
6. Confirm a mobile-style comma decimal (`"10,5"`) still works in an admin numeric field — no regression from the prior round's fix.
7. Resize to 1440px and 375px and confirm no page-level horizontal overflow anywhere touched this round.

### Phase 9 final round — public color display deferred; comparison presentation polish

Three rounds of real-Supabase testing on the color resolver (fixed table → inventory/hybrid fixes → the automatic layered resolver above) kept finding the same shape of problem: hybrid strings sometimes rendered one solid color instead of a split swatch, some perfectly normal colors stayed unresolved or silently disappeared, and explaining to a stringer *which* of inventory/catalog/hybrid source produced a given swatch was getting harder, not easier, each round. The value being delivered no longer matched the time being spent chasing edge cases. This final round makes a decision rather than another fix: **stop trying to render physical string colors publicly in Phase 9.**

**What was removed, publicly.** Every public-facing color affordance from the rounds above: `ColorSwatchPreview.tsx` and `StringColorSwatch.tsx` (deleted), the swatch beside the string name in catalog cards (`StringCard.tsx`), the Best Match hero/detail heading and alternative cards (`RecommendationResult.tsx`), the comparison table's column headings (`ComparisonTable.tsx`), the hybrid split-circle, and the `+N` expand/collapse control. Nothing was left as an empty gap or a broken placeholder — each heading simply reverted to its plain text layout (the stock badge, which lived in its own column, is unaffected either way).

**What stayed in admin, unchanged.** Every raw color field an admin can see and edit — the catalog `Colors` text field, the inventory `Color` field, and a hybrid string's Main/Cross color names — still shows and saves exactly the text a stringer types: `White`, `Red`, `White/Red`, `Fire Orange`, `Cosmic Gold`, and so on. No Supabase data was deleted, rewritten, or migrated. Trimming, comma/semicolon list parsing, and the mobile comma-decimal fix from earlier rounds are all still in place; only the *preview of what a color would render as* was removed from the admin forms, since that preview existed purely to forecast public rendering that no longer happens. The previously-added `HybridStringMeta.colorOverride` field (added one round ago solely to feed the now-removed hybrid split-swatch) was removed from the type, the form, and the save path — it never represented real stringer-authored color data on its own, only an experimental rendering aid, so removing it does not touch any real Supabase color value.

**What stayed for diagnostics.** `logic/stringColor.ts`'s layered resolver, `logic/colorDiagnostics.ts`'s `/debug/supabase` summary, and `logic/colorParsing.ts`'s list/legacy-pair parsing are all still here — not because anything public reads them anymore, but because they remain the most useful tool for progressively cleaning up real color data by hand ahead of a possible future normalized model. `resolveColor()` no longer accepts an override argument (that concept only existed for the removed hybrid swatch), and `buildColorPreview()`'s result no longer distinguishes "visible" from "overflow" (there's no cap to enforce once nothing publicly renders a limited set of dots).

**A future normalized color model remains possible.** Nothing about this round forecloses a proper Phase 10 implementation — e.g. a small `color_definitions` table plus a real per-color-name-to-swatch mapping stored in the database rather than inferred in TypeScript. That would be a new, explicitly-approved phase with its own migration; this round only stops short of guessing at it under time pressure.

#### Comparison presentation: the actual Phase 9 value

With color rendering off the table, this round's real effort went into making the **comparison experience** easier to read at a glance, using data that was already being computed:

- **Compact five-metric overlay comparison** (`logic/comparisonOverlay.ts`, `components/ComparisonOverlayBars.tsx`) — one row per core manufacturer metric (Repulsion, Control, Durability, Hitting sound, Shock absorption — the same 5 axes `RadarChart`/`StatBars` already use), each row showing every compared string's value on one shared zero-to-11 track, with the exact numbers at the right edge in the same colors as the radar's series. **Two strings** overlap on one track: a translucent full-height bar for the first string and a shorter, solid, outlined bar layered on top for the second, so neither disappears even when their values are exactly equal. **Three strings** instead use three thin stacked mini-bars in the same row — deliberately not a forced triple-overlap, which real preview testing found unreadable. Every row also carries a screen-reader-only sentence, e.g. *"Hitting sound: BG66 Force 9, BG66 Ultimax 10."*
- **Radar exact values, for 2–3 strings** — `RadarChart.tsx` now renders every compared string's value near each axis label (e.g. `Repulsion` then `10  10`) in matching series colors, not just for a single string as before. The chart gets a touch more padding specifically when this is active, so the extra line never clips or collides with the axis label; the existing single-series card view (`StringCard.tsx`) is pixel-identical to before. The chart's own `aria-label`/`<title>` already narrates every axis value per series, so this is a decorative enhancement over an existing accessible description, not a new accessibility gap.
- **Information hierarchy** — the default Radar view now reads, top to bottom: comparison chips → radar with exact values → the five-metric overlay bars → an optional "Show more details" link that reveals the same full comparison table (with its own further disclosure) on demand. The default view stays exactly this short; nothing extra loads or renders until asked for.
- **Table progressive disclosure** (`components/ComparisonTable.tsx`) — the 5 primary rows (Repulsion, Control, Durability, Hitting Sound, **Shock Absorption / Comfort** — renamed from plain "Comfort" to match what it actually measures) stay visible by default; "Show more details" (`aria-expanded`, keyboard-operable, no page reload, nothing persisted) reveals two clearly separated, slightly softer-contrast groups: **Performance details** (Feel, Tension Retention, Power, Overall Specialist Rating) and **Availability** (Retail Availability, Package Options, Retailer Count). The control becomes "Show fewer details" once expanded. `logic/comparisonMetrics.ts`'s `ComparisonRow` gained a `group: 'primary' | 'performance' | 'availability'` tag purely for this display grouping — every computed value, dot count, and row order is unchanged.
- **Comparison legend** — unchanged from the prior round's simplification: chart-series dot + string name + remove button, no physical color, no duplicate legend.

None of this touched `recommendationEngine.ts`, `tensionRecommendation.ts`, catalog/specialist ratings, `logic/comparisonMetrics.ts`'s computed values, `RadarChart`'s underlying polygon math, the Supabase schema, RLS, or retailer/inventory logic. `logic/version.ts` and the admin footer (`Smash Lab Admin · v0.8.0-beta · <Production|Development>`) are untouched.

#### Manual verification checklist (final round)

1. Catalog cards, the Best Match hero/detail heading, alternative cards, and the comparison table's column headings: confirm no physical-color dot or swatch renders anywhere, and that removing it left no empty gap (headings sit flush, same as before color rendering existed).
2. Admin: confirm the catalog Colors field, inventory Color field, and a hybrid string's Main/Cross color fields still show and save raw text (`White`, `Red`, `Fire Orange`, `Cosmic Gold`, `White/Red`) exactly as entered, with no swatch preview and no "Needs mapping" warning.
3. Compare 2 strings with equal values, a one-point difference, and a large difference on the five-metric overlay: confirm the shorter/equal bar is always still visible, and the exact numbers at the right match the manufacturer ratings.
4. Compare 3 strings: confirm the overlay bars switch to three stacked mini-bars in the same row, in the same left-to-right order as the comparison chips, and that each bar's relative length matches its value.
5. Radar view: confirm exact values appear near every axis label for 2–3 strings, in the same colors as the chips, with no clipping or overlap with the axis label text, at 1440px, 1024px, and 375px.
6. Table view: confirm only the 5 primary rows show by default, "Show more details" reveals Performance details and Availability with `aria-expanded` toggling and full keyboard operability, and the control becomes "Show fewer details" once expanded.
7. Resize to 320px/375px/390px/768px/1024px/1440px: confirm the comparison panel itself (chips, radar, overlay bars, table) never causes horizontal overflow and stays legible at every width. (A pre-existing horizontal-overflow issue was found at 320px originating from the unrelated "Have a question?" contact block — present with or without any string being compared, and outside this round's scope of color removal + comparison presentation.)

#### Likely Phase 10 scope

A properly normalized color model — most plausibly a small `color_definitions` table (canonical key, display label, CSS value) that catalog/inventory/hybrid color names resolve against, replacing today's in-code inference — would need its own migration and its own explicitly-approved phase before any public color rendering returns. Until then, admin color fields stay exactly as useful for manual data entry and cleanup as they've always been; nothing about this round makes that harder.

## Copyright

© 2026 Nicolas Vogt. All rights reserved.

This project is proprietary and is not distributed under an open-source
license. See [COPYRIGHT.md](./COPYRIGHT.md) for details.
