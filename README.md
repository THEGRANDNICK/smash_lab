# Smash Lab Stringing

## What Smash Lab is

A local badminton racket-stringing service site: an interactive "Find
Your Perfect String" quiz that recommends a string + tension setup from a
player's own answers, a full browsable string comparison catalog, and a
conversion path from that recommendation into a real stringing enquiry.

Stack: **Vite + React + TypeScript + Tailwind CSS v4 + Framer Motion**,
deployed as a static site to GitHub Pages, with an optional Supabase
backend (public read-only catalog/inventory/pricing data, admin-only
writes via Supabase Auth). The site works correctly with Supabase
entirely unconfigured — it falls back to local data.

## Main features

- **String Finder quiz** — a short multi-step quiz (`src/components/StringFinder.tsx`) that scores every catalog string against the player's answers and recommends a top match plus two alternatives, with a top-3 podium and a "feel map" visualization.
- **Tension recommendation** — a separate, independent calculation (`src/logic/tensionRecommendation.ts`) that never exceeds a stated racket maximum.
- **Manufacturer vs. specialist data-source toggle** — the quiz lets a player choose manufacturer-only data or manufacturer + Smash Lab specialist calibration; see `docs/recommendation-engine.md`.
- **String comparison** — filterable, sortable browsing of the full catalog with radar/feel-map/table views (`src/components/StringComparison.tsx`).
- **Result-to-enquiry conversion** — "Want this setup in your racket?" sends the recommended string/tension/match/data-source straight to WhatsApp or email, or copies a summary — no account required (`src/components/StringingEnquiry.tsx`).
- **Shareable results** — a `#result/<encoded>` link reproduces a recommendation deterministically client-side, and "Save this setup" remembers it locally for a return visit (`src/logic/resultShareState.ts`, `src/logic/savedSetup.ts`).
- **Admin area** (`#admin`, Supabase Auth-gated) — CRUD for the catalog, inventory, specialist profiles, retailers, and retailer listings.
- **Legal pages** — Impressum and Datenschutzerklärung, driven by a single config file so nothing is invented; see "Legal-content setup" below.

## Architecture overview

See `docs/architecture.md` for the full breakdown. In short:

```
src/
  data/          Local fallback data (strings, quiz questions, contact/legal/site config)
  config/        Tunable constants (recommendation weights, tension rules)
  logic/         Pure functions — recommendation engine, tension math, result sharing, etc.
  services/      Supabase read/write functions (catalog, inventory, specialist, retailer)
  hooks/         React hooks wrapping services with local-fallback behavior
  components/    UI, including components/admin/ and components/legal/
  lib/           Supabase client, auth helpers
supabase/migrations/   Database schema + RLS policies
scripts/         Test suites (scripts/testX.ts) and one-off admin/migration scripts
docs/            Topic-specific reference docs (this README links to all of them)
```

The recommendation engine (`src/logic/recommendationEngine.ts`) is pure —
it never calls Supabase directly. Every data source (catalog pool,
specialist profiles) is passed in as an optional parameter, defaulting to
the local fallback data; the live UI passes Supabase-backed values via
`src/hooks/*`.

## Local setup

```bash
npm install
cp .env.example .env.local   # optional — see "Environment variables" below
npm run dev                  # start local dev server
```

The site works with zero configuration: without `.env.local`, it reads
`src/data/strings.ts` and `src/data/stringSpecialistProfiles.ts` directly
and the admin area shows a "not configured" state instead of a login
form.

## Environment variables

| Variable | Required? | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Optional | Your Supabase project URL. Without it, the site uses local fallback data everywhere. |
| `VITE_SUPABASE_ANON_KEY` | Optional | The public anon key — safe to expose in frontend code by design; Row Level Security decides what it can do. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, local-only | **Never** `VITE_`-prefixed, **never** imported from `src/`. Used only by one-off Node scripts (`scripts/migrateInventory.ts`, `scripts/migrateSpecialists.ts`). |

See `.env.example` and `docs/deployment.md` for the full Supabase setup
walkthrough (creating a project, applying the migration, creating an
admin user).

## Development commands

```bash
npm run dev        # local dev server
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run lint        # oxlint
npm test            # the complete test suite (see "Testing" below)
npm run verify      # test + lint + build — the full pre-push check
```

## Testing

```bash
npm test           # everything — Vitest + all legacy scripts/testX.ts suites
npm run test:all    # exact alias for npm test
npm run test:unit   # only the Vitest suites
```

See `docs/testing.md` for the full suite inventory, what each covers, and
the ongoing incremental migration off the older plain-assert
`scripts/testX.ts` pattern onto Vitest.

## Deployment

Deployed to GitHub Pages via `.github/workflows/deploy.yml` on every push
to `main`. `.github/workflows/ci.yml` runs type-check/lint/test/build on
every pull request and push to `main`. See `docs/deployment.md` for the
full walkthrough, including how to set `VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` as repository variables so the deployed build
uses live data.

## Supabase overview

Optional backend: public tables (`strings`, `inventory`,
`specialist_profiles`, `retailer_prices`) are readable by anyone via
Row Level Security, writable only by accounts listed in `admin_users`.
No service-role key exists anywhere reachable from the browser. See
`docs/architecture.md` for the data-flow detail and `docs/security.md`
for the full security audit (RLS policies, `is_admin()`, key handling).

## Security model

See `docs/security.md` for the full audit: dangerous-pattern scan
(none found), external-link/image hardening, Content-Security-Policy
design and its documented `<meta>`-delivery limitations, Supabase key
handling, and database RLS verification.

## Legal-content setup

Impressum and Datenschutzerklärung pages exist at `#impressum` /
`#datenschutz`, driven by `src/data/legalConfig.ts`. **No personal, legal,
tax, or business information is invented anywhere in this codebase** —
fields the site owner hasn't supplied render a visible placeholder and
the Impressum page shows a standing "not yet complete" notice. See
`docs/legal-setup.md` for the exact fields still needed before these
pages can be relied on, and what the Datenschutzerklärung actually
covers.

## Contact configuration

All contact details (name, email, location, optional WhatsApp number for
the one-tap enquiry link) live in one file: `src/data/contact.ts`. The
turnaround-time note shown on the homepage lives in
`src/data/serviceConfig.ts` — keep it consistent with the matching FAQ
answer if it changes.

## Known limitations

- No image upload for catalog/retailer logos — URL only.
- No bulk edit or CSV import anywhere in the admin area.
- No per-string dedicated pages yet (`/strings/<slug>`) — see `docs/string-pages-architecture.md` for the planned approach.
- Editing a single quiz answer without restarting isn't built yet, though the state model already supports adding it later — see the comment in `src/components/StringFinder.tsx`.
- Retail Sync (automatic retailer catalog crawling) is a separate, paused initiative — see `docs/retail-sync-architecture.md`. Out of scope for day-to-day site development.
- `docs/CHANGELOG.md`'s phase-by-phase history may describe admin-area behavior in more granular detail than is repeated here; where it and a dedicated `docs/*.md` file disagree, trust the dedicated doc.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Directory layout, data flow, local-fallback pattern |
| [`docs/recommendation-engine.md`](docs/recommendation-engine.md) | How scoring, tension, and the data-source toggle work |
| [`docs/testing.md`](docs/testing.md) | Full test-suite inventory and Vitest migration status |
| [`docs/security.md`](docs/security.md) | Security audit, CSP design, RLS/key verification |
| [`docs/deployment.md`](docs/deployment.md) | GitHub Pages deployment, CI, Supabase project setup |
| [`docs/legal-setup.md`](docs/legal-setup.md) | Impressum/Datenschutz — required fields, what's covered |
| [`docs/string-pages-architecture.md`](docs/string-pages-architecture.md) | Planned per-string page architecture (not yet built) |
| [`docs/retail-sync-architecture.md`](docs/retail-sync-architecture.md) | The paused Retail Sync initiative |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Full phase-by-phase development history |

## Copyright

© 2026 Nicolas Vogt. All rights reserved.

This project is proprietary and is not distributed under an open-source
license. See [COPYRIGHT.md](./COPYRIGHT.md) for details.
