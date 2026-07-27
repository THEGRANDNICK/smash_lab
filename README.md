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
- ❌ Catalog *editing* (an admin UI for `public.strings`), specialist-profile editing, and retailer-price administration are still not implemented — Phase 5+.

Run `npm run verify:supabase` and `npm run verify:catalog` (after filling in `.env.local`) to confirm your project matches what these phases expect — see "Verifying your setup" below.

**Important — GitHub Pages build step**: Vite inlines `VITE_`-prefixed env vars *at build time* and tree-shakes the entire Supabase client out of the bundle if they're unset, so the deployed site needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` available to the GitHub Actions build step, not just in your local `.env.local`. `.github/workflows/deploy.yml` reads them from repository **variables** (Settings → Secrets and variables → Actions → Variables tab, same place as the earlier Google Sheets discussion) — until you add those two variables, the deployed site simply keeps using `strings.ts`'s local values (safe, just not live), and the admin area shows a "not configured" state instead of a login form.

### 11. Admin area (inventory editing)

**URL**: `/#admin` (e.g. `https://<your-username>.github.io/smash_lab/#admin`, or `http://localhost:5173/#admin` in dev). It works with GitHub Pages' `/smash_lab/` base path and survives a direct navigation or a page refresh, since routing is hash-based like the rest of the site. It is not linked from the site's navigation — the URL itself is the only way in. **This is a convenience, not a security boundary**: nothing about the admin area's protection depends on the route being hard to find. The real protection is Supabase Auth (you must sign in) plus Row Level Security (your account must additionally be listed in `public.admin_users`, checked server-side via the `is_admin()` function — the browser never queries `admin_users` directly).

**Logging in**: enter the email/password of a Supabase Auth user (the one you created in step 6 above). There's no sign-up form and no password reset in this UI — both are intentionally absent for a single-admin site; manage the Auth user itself from the Supabase dashboard. A wrong password shows a plain "Incorrect email or password" message; a network/Supabase-unavailable failure shows its own distinct error and lets you retry. Signing in with an Auth account that exists but isn't in `admin_users` succeeds (you're a valid authenticated user) but immediately shows an "Access denied" screen with no inventory controls and a sign-out button — being a Supabase Auth user is necessary but not sufficient, you also need the `admin_users` row from step 8.

**What you can edit**: stock status (in stock / low stock / unavailable), quantity (a whole number ≥ 0, or left blank for "unknown"), package type (reel / set / mixed / unknown), an optional color, and optional notes — one row per string, sorted by brand then name. Brand, name, and the string's internal ID are shown for reference but aren't editable here (they're read from `public.strings` — see "Catalog loading (Phase 4)" below; there's no catalog-editing UI yet). Each row edits independently; saving validates the quantity client-side (whole numbers only, no negatives, blank → "unknown") before writing, and only updates the on-screen row once Supabase confirms the write succeeded.

**Why writes are actually safe**: every inventory write goes through the signed-in user's own Supabase session — there is no service-role key anywhere in the frontend, and there couldn't be one without exposing it to every visitor. Row Level Security on `public.inventory` is what actually decides whether a write is allowed: `anon` and merely-authenticated-but-non-admin users are rejected at the database level regardless of what the UI shows (verified directly in testing — see "Testing this locally" below), so even a modified/malicious client can't write inventory without a real `admin_users` row.

### 12. What's next (Phase 5+)

Catalog *editing* (an admin UI for `public.strings`), specialist-profile editing, and retailer-price administration are not implemented yet and are left for later, separate phases. Phase 4 only made the catalog load live — it did not add a way to edit it outside the database directly.

## Catalog loading (Phase 4)

**Source of truth after Phase 4:**

| Data | Source |
| --- | --- |
| Catalog (brand, name, category, ratings, gauge, cost, description, tension metadata, popularity rank, product/image URLs, colors) | Supabase `public.strings`, with `src/data/strings.ts` as fallback |
| Inventory (stock status, quantity, package, color, notes) | Supabase `public.inventory`, with `strings.ts`'s own values as fallback (unchanged since Phase 2) |
| Specialist profiles | `src/data/stringSpecialistProfiles.ts` — **local only, not migrated** |
| Recommendation/tension/scoring logic | Git/TypeScript (`src/logic/`, `src/config/`) — **never touched by any data source** |

**What actually happens on page load** (`src/hooks/useStringPool.ts` orchestrating `src/services/catalogService.ts` + `src/services/inventoryService.ts`):
1. The page renders instantly from `strings.ts` (identical to pre-Phase-4 behavior — no loading spinner, no flicker).
2. Catalog and inventory are fetched from Supabase concurrently in the background.
3. If the live catalog is valid and complete, it replaces the fallback; live inventory is merged on top by `string_id`. If either fetch fails or the catalog is incomplete, that piece silently keeps using its local fallback — the two fall back independently.

**Validation and completeness** — every `public.strings` row is checked (non-empty id/brand/name, valid category, ratings within 0–11, non-negative gauge/cost, valid tension metadata shape, safe `http(s)` URLs only, no duplicate ids) before being accepted. The live catalog is only ever trusted **whole**: if it's missing even one string `strings.ts` knows about, contains an invalid row, or returns zero rows, the site uses the complete local catalog instead rather than showing a partial/mixed result. This is intentionally conservative — a half-broken live catalog never reaches visitors. All of this is logged to the console as a warning; the public site itself never shows a database error, only the admin/debug pages do.

**Catalog divergence warning**: after Phase 4, `strings.ts` is the fallback and rollback reference, not the normal editing surface — there's no catalog admin UI yet, so the only way to update live catalog data is directly in Supabase. Editing `strings.ts` alone will change what visitors see **only when the live fetch fails**; it will silently diverge from the live database the rest of the time. Keep them in sync manually until Phase 5 adds real catalog editing, and use `npm run verify:catalog` (below) to check for drift.

**Diagnosing live vs. fallback**: visit `#debug-supabase` in dev — it shows whether the catalog source is 🟢 live or 🟡 fallback, the last fetch's accepted/rejected row counts and reasons, the merged pool size, any catalog ids missing an inventory row, and any specialist profile referencing a string id no longer in the catalog.

### Verifying the catalog

```bash
npm run verify:catalog
```

Read-only (anon key only, same as the public site — never the service-role key). Fetches the live `public.strings`, runs it through the exact same validation the site itself uses, and reports accepted/rejected rows, missing/extra ids versus `strings.ts`, and whether the live site would actually use the live catalog right now. Never writes anything; never fabricates a pass if Supabase is unreachable.

### Automated tests

```bash
npm run test:catalog
```

Plain assertions (no test framework dependency) covering: database-row-to-`StringItem` mapping (round-tripped over every real catalog entry), invalid-row rejection (bad category, out-of-range ratings, negative gauge/cost, malformed tension metadata, unsafe URL schemes), duplicate-id detection, the live/fallback completeness decision, deterministic catalog ordering, inventory-merge behavior, and — most importantly — that `recommendStrings`/`recommendTension` produce byte-identical Best Match / Best Available Alternative / Specialist Choice / tension results whether the pool comes from `strings.ts` directly or from mapping synthetic database rows built from the same data. This is local/automated only — it never touches a real Supabase project.

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

Visit `http://localhost:5173/#debug-supabase` while running `npm run dev` to see connection status, current user, admin status, inventory row count, and (since Phase 4) the catalog source (live/fallback), last catalog fetch's accepted/rejected row counts and reasons, merged pool size, catalog ids missing an inventory row, and specialist profiles referencing a missing string. It only exists in dev builds (`import.meta.env.DEV`) and isn't linked from anywhere in the normal site.

### Testing the admin area locally

1. Complete steps 1–8 above (project created, migration applied, your Auth user created and disable public sign-up, and that same user added to `public.admin_users`).
2. `npm run dev`, then visit `http://localhost:5173/#admin` and sign in with that account.
3. To see the "authenticated but not admin" state, create a second Auth user in the dashboard and sign in with it *without* adding it to `admin_users` — you should land on "Access denied" with no inventory controls.
4. To confirm Row Level Security (not just the UI) is what's actually blocking that second user, you can run the same update it would attempt directly from the browser console while signed in as it — it should affect zero rows rather than erroring, which is RLS silently filtering the row out rather than the UI merely hiding a button.

Never put a real password, UID, or project ref into a commit, issue, or this file — use throwaway test accounts for step 3.

## Copyright

© 2026 Nicolas Vogt. All rights reserved.

This project is proprietary and is not distributed under an open-source
license. See [COPYRIGHT.md](./COPYRIGHT.md) for details.
