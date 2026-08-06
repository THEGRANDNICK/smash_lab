# Deployment

## GitHub Pages

`.github/workflows/deploy.yml` builds and deploys on every push to
`main` (and via manual `workflow_dispatch`). It runs `npm ci` then
`npm run build`, uploads `dist/` as a Pages artifact, and deploys it —
`contents: read`, `pages: write`, `id-token: write` permissions only,
concurrency-grouped so overlapping deploys don't race.

The site is served at `https://<owner>.github.io/<repo>/` — `vite.config.ts`'s
`base: '/smash_lab/'` must match the actual repository name, and
`src/data/siteConfig.ts` / `index.html`'s canonical/OG URLs are hand-kept
in sync with it (see `docs/architecture.md`).

### Making the deployed build use live Supabase data

Vite inlines `VITE_`-prefixed env vars **at build time** and tree-shakes
the Supabase client out entirely if they're unset — so the deployed site
needs `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` available to the
GitHub Actions build step, not just in a local `.env.local`.
`deploy.yml` reads them from repository **variables** (Settings → Secrets
and variables → Actions → Variables tab — not Secrets, since the anon key
is meant to be public). Until both are set, the deployed site simply
keeps using `src/data/strings.ts`'s local values (safe, just not live),
and the admin area shows a "not configured" state instead of a login
form.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to
`main`: `npm ci`, type-check (`tsc -b`), lint, the full test suite
(`npm test`), and a production build — as separate steps so a failure's
category is obvious. `contents: read` only, third-party actions pinned to
full commit SHAs, dependency caching via `setup-node`'s built-in `cache:
npm`, and a concurrency group that cancels a superseded run on the same
PR/ref. It does not need any repository secrets or variables — the build
step it runs falls back to local data exactly like a fresh contributor's
machine would.

## Dependabot

`.github/dependabot.yml` covers both the `npm` and `github-actions`
ecosystems, weekly (Mondays), capped at 5 open PRs each, with
minor/patch updates grouped into one PR per ecosystem per week. Major
version bumps are deliberately left out of the group so a breaking
change always gets its own reviewable PR.

## Setting up a Supabase project (optional)

The site works fully without Supabase — this is only needed for live
inventory/catalog/pricing data and the admin area.

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Project Settings → API**: copy the **Project URL** and **anon/public** key (never the `service_role` key) into `.env.local` — see `.env.example`.
3. Apply `supabase/migrations/20260727123901_initial_schema.sql` — either `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`, or paste it directly into the SQL Editor. Safe to re-run.
4. **Authentication → Users → Add user**: create the one admin account.
5. **Authentication → Providers → Email**: turn off "Allow new users to sign up" (this is a single-admin site).
6. In the SQL Editor: `INSERT INTO public.admin_users (user_id) VALUES ('<that user's UUID>');` — until this row exists, `is_admin()` returns false for everyone, including that account, and every write is rejected.
7. Set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` as GitHub Actions repository **variables** (see above) so the deployed build picks them up too.

See `docs/CHANGELOG.md`'s "Supabase Backend Setup" section for the
original, more detailed walkthrough (admin-area tour, troubleshooting,
what each phase added) — still accurate, just written phase-by-phase
rather than as a topic reference.

## Verifying a live Supabase setup

```bash
npm run verify:supabase   # anon read/write checks against the real project
npm run verify:catalog    # compares the live catalog against src/data/strings.ts
```

Both are read-only against the real project (anon key only, never
service-role) and are not part of `npm test` — they need real credentials
and can't run in a fresh checkout or in CI.
