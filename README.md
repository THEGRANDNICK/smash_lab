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
    strings.ts          # THE string database — edit prices, stock, ratings, colors, notes here
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

- **Add/remove a string, change stock or price**: edit the array in `src/data/strings.ts`. Nothing else needs touching — cards, filters, the quiz, and pricing all read from this one file.
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

### 10. What Phase 1 actually does today

- ✅ Database schema exists (`strings`, `inventory`, `specialist_profiles`, `retailer_prices`, `admin_users`), with Row Level Security enforcing public-read / admin-only-write on the four data tables.
- ✅ A typed Supabase client (`src/lib/supabase.ts`) and auth helpers (`src/lib/auth.ts`) exist in the codebase.
- ❌ The website still reads `src/data/strings.ts` / `src/data/stringSpecialistProfiles.ts` — nothing fetches from Supabase yet.
- ❌ There is no live inventory sync and no visible `/admin` page yet.

Run `npm run verify:supabase` (after filling in `.env.local`) to confirm your project matches what this phase expects — see the "Verifying your setup" section below.

### 11. What's next (Phase 2)

Phase 2 will move **inventory reads only** to Supabase — stock/quantity/package type will come from the `inventory` table instead of being hard-coded, while the catalog (`strings.ts`) and the entire recommendation engine keep working exactly as they do today. Catalog migration, the admin UI, specialist-profile editing, and retailer pricing are later, separate phases.

### Verifying your setup

```bash
npm run verify:supabase
```

Checks (using only the public anon key — never the service-role key):
- the four public tables are reachable with their expected columns
- anon reads succeed
- anon writes are correctly rejected

Optionally, set `SUPABASE_TEST_ADMIN_EMAIL` / `SUPABASE_TEST_ADMIN_PASSWORD` in your shell for a single run to additionally verify your admin account can write — never commit these.

## Copyright

© 2026 Nicolas Vogt. All rights reserved.

This project is proprietary and is not distributed under an open-source
license. See [COPYRIGHT.md](./COPYRIGHT.md) for details.
