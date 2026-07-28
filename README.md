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

Run `npm run verify:supabase` and `npm run verify:catalog` (after filling in `.env.local`) to confirm your project matches what these phases expect — see "Verifying your setup" below.

**Important — GitHub Pages build step**: Vite inlines `VITE_`-prefixed env vars *at build time* and tree-shakes the entire Supabase client out of the bundle if they're unset, so the deployed site needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` available to the GitHub Actions build step, not just in your local `.env.local`. `.github/workflows/deploy.yml` reads them from repository **variables** (Settings → Secrets and variables → Actions → Variables tab, same place as the earlier Google Sheets discussion) — until you add those two variables, the deployed site simply keeps using `strings.ts`'s local values (safe, just not live), and the admin area shows a "not configured" state instead of a login form.

### 11. Admin area

**URL**: `/#admin` (e.g. `https://<your-username>.github.io/smash_lab/#admin`, or `http://localhost:5173/#admin` in dev) — redirects into `#admin/inventory` by default. There's also `#admin/catalog` and `#admin/specialists`. All three work with GitHub Pages' `/smash_lab/` base path and survive a direct navigation or a page refresh, since routing is hash-based like the rest of the site. None is linked from the site's navigation — the URL itself is the only way in. **This is a convenience, not a security boundary**: nothing about the admin area's protection depends on the route being hard to find. The real protection is Supabase Auth (you must sign in) plus Row Level Security (your account must additionally be listed in `public.admin_users`, checked server-side via the `is_admin()` function — the browser never queries `admin_users` directly).

**Logging in**: enter the email/password of a Supabase Auth user (the one you created in step 6 above). There's no sign-up form and no password reset in this UI — both are intentionally absent for a single-admin site; manage the Auth user itself from the Supabase dashboard. A wrong password shows a plain "Incorrect email or password" message; a network/Supabase-unavailable failure shows its own distinct error and lets you retry. Signing in with an Auth account that exists but isn't in `admin_users` succeeds (you're a valid authenticated user) but immediately shows an "Access denied" screen with no inventory or catalog controls and a sign-out button — being a Supabase Auth user is necessary but not sufficient, you also need the `admin_users` row from step 8.

**Navigation**: once signed in as an admin, a small tab bar switches between **Inventory**, **Catalog**, and **Specialists** (each its own real, refreshable `#admin/inventory` / `#admin/catalog` / `#admin/specialists` URL). A greyed-out **Dashboard** tab is a disabled placeholder for a future phase — it's not a link to anything yet.

**Inventory tab — what you can edit**: stock status (in stock / low stock / unavailable), quantity (a whole number ≥ 0, or left blank for "unknown"), package type (reel / set / mixed / unknown), an optional color, and optional notes — one row per string, sorted by brand then name. Brand, name, and the string's internal ID are shown for reference but aren't editable here — see the Catalog tab for that. Each row edits independently; saving validates the quantity client-side before writing, and only updates the on-screen row once Supabase confirms the write succeeded.

**Catalog tab — what you can do** (Phase 5, ratings/hybrid fields extended in Phase 6): search/filter (by brand, category) and sort (popularity, brand, name) every `public.strings` row; **create**, **edit**, or **delete** a string. Editable fields cover everything the catalog table exposes: brand, name, category, gauge, the five manufacturer ratings (now decimal, e.g. `9.5`), string cost, description, popularity rank, image/product URLs, colors, tension metadata (adjustment, recommended min/max, notes) in a collapsed "advanced" section, and a "Hybrid string" checkbox that reveals separate main/cross gauge, material, construction, coating, and color fields. **Not editable here**: inventory fields (stock/quantity/package/color/notes — use the Inventory tab), specialist-profile fields (use the Specialists tab), or anything in `src/logic`/`src/config` (recommendation weights, tension rules) — those remain Git-only, untouched by any admin tab. See "Catalog administration" below for full CRUD/validation/security detail.

**Specialists tab — what you can do** (Phase 6): every catalog string is listed with its brand, name, current specialist recommendation summary (confidence, source, reviewer), and an Edit button — strings with no profile yet show a "No profile" badge and an "Add profile" button instead. The editor covers every `public.specialist_profiles` field: source, confidence, feel, reviewer, personal tension range, strengths/weaknesses (one per line), tags (comma-separated), subjective notes, and all 17 scored dimensions (1–5) in a collapsed "advanced" section. "Remove" clears a string's profile entirely (reverting it to manufacturer-data-only scoring on the public site) without touching the catalog or inventory rows. Search and a has-profile/no-profile filter help navigate the full catalog. See "Decimal ratings, hybrid strings & specialist profiles" below for full CRUD/validation/fallback detail.

**Why writes are actually safe**: every write (inventory or catalog) goes through the signed-in user's own Supabase session — there is no service-role key anywhere in the frontend, and there couldn't be one without exposing it to every visitor. Row Level Security on `public.inventory` and `public.strings` is what actually decides whether a write is allowed: `anon` and merely-authenticated-but-non-admin users are rejected at the database level regardless of what the UI shows (verified directly in testing — see "Testing this locally" below), so even a modified/malicious client can't write either table without a real `admin_users` row.

### 12. What's next (Phase 7+)

Retailer-price administration, image uploads, and per-dimension confidence overrides in the specialist editor are not implemented yet and are left for later, separate phases.

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

**Delete**: requires an explicit "Yes, delete it" confirmation that names the string and states plainly that it disappears from recommendations, the catalog, comparison, and the quiz. `public.inventory`, `public.specialist_profiles`, and `public.retailer_prices` all have `references public.strings(id) on delete cascade`, so a single DELETE atomically removes the matching inventory row too (a real Postgres transaction, not a client-side simulation) — verified directly in testing. **Caveat**: `src/data/stringSpecialistProfiles.ts`'s specialist knowledge is a separate local file, not the (currently unused) `specialist_profiles` table, so deleting a string does *not* remove its local specialist profile entry — it becomes orphaned, and `#debug-supabase` flags that mismatch afterward.

**Validation**: required brand/name/category/ratings; ratings 0–11; gauge/cost/popularity-rank non-negative (popularity rank must also be a whole number); tension adjustment may be negative (it's a +/- nudge) but recommended min must not exceed max; image/product URLs must be `http(s)` — a `javascript:` or other unsafe scheme is rejected outright (verified against a test database with no such constraint of its own, confirming the app layer is the real defense here, not just the database's own CHECK constraints on ratings/enums). Every field is trimmed; blank optional fields become `null`, never an empty string.

**Image handling**: still URL-only — no upload yet (planned for a later phase, see "What's next" above). The image URL field shows a live preview, and a broken/unreachable URL shows a clear placeholder instead of a broken-image icon.

**Current limitations / Phase 6+ scope** (as of Phase 5; specialist-profile editing shipped in Phase 6 — see below): no image upload (URLs only); no bulk edit or CSV import; no retailer-price administration; the disabled "Dashboard" nav tab is a placeholder for a future phase, not a hint at what it'll contain.

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

Visit `http://localhost:5173/#debug-supabase` while running `npm run dev` to see connection status, current user, admin status, inventory row count, and (since Phase 4) the catalog source (live/fallback), last catalog fetch's accepted/rejected row counts and reasons, merged pool size, and catalog ids missing an inventory row. Since Phase 6, it also shows: decimal-rating validation status (whether any accepted row's ratings use a decimal, and whether any row was rejected for exceeding one decimal place), the hybrid string count, the specialist profile source (live/fallback) and last fetch status, how many strings have no specialist profile (expected — profiles are sparse by design), and specialist profiles referencing a string id no longer in the catalog. It only exists in dev builds (`import.meta.env.DEV`) and isn't linked from anywhere in the normal site.

### Testing the admin area locally

1. Complete steps 1–8 above (project created, migration applied, your Auth user created and disable public sign-up, and that same user added to `public.admin_users`).
2. `npm run dev`, then visit `http://localhost:5173/#admin` and sign in with that account. Switch to the Catalog tab to try creating, editing, and deleting a string.
3. To see the "authenticated but not admin" state, create a second Auth user in the dashboard and sign in with it *without* adding it to `admin_users` — you should land on "Access denied" with no inventory or catalog controls.
4. To confirm Row Level Security (not just the UI) is what's actually blocking that second user, you can run the same update/insert/delete it would attempt directly from the browser console while signed in as it — it should affect zero rows rather than erroring, which is RLS silently filtering the row out rather than the UI merely hiding a button.
5. To see the catalog's create-then-rollback path, temporarily revoke `authenticated`'s `INSERT` on `public.inventory` in the SQL editor, create a string, and confirm both that a clear error appears and that the string itself doesn't linger in the catalog — then re-grant the permission.
6. Switch to the Specialists tab (Phase 6) to add, edit, and remove a specialist profile for a string; refresh the public site's catalog/comparison/quiz pages afterward to confirm the change is reflected (specialist data is fetched on page load, not live-pushed).

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

Not implemented in Phase 6, left for later: retailer-price administration, image uploads, per-dimension confidence overrides in the specialist editor (the profile-level `confidence` is editable; the more granular `dimension_confidence` column exists in the schema but has no UI yet), bulk edit/CSV import, and the "Dashboard" admin tab.

## Copyright

© 2026 Nicolas Vogt. All rights reserved.

This project is proprietary and is not distributed under an open-source
license. See [COPYRIGHT.md](./COPYRIGHT.md) for details.
