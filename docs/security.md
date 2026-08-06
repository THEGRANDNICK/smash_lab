# Security model

This document records the security audit performed during the
stability/legal/conversion phase and the security model that already
existed before it. It reports what was checked, not just what was fixed —
most of this codebase was already correct.

## Audit: dangerous DOM/JS patterns

Repo-wide search across `src/` for `dangerouslySetInnerHTML`, `.innerHTML`,
`eval(`, `new Function`, and `javascript:` URL construction. **Result: zero
occurrences of any of them.** Nothing renders arbitrary/unsanitized HTML
anywhere in this app; all content is plain JSX text/attribute interpolation,
which React escapes by default.

## Audit: external links (`target="_blank"`)

7 occurrences repo-wide, all of them already carrying `rel="noopener
noreferrer"` (three also add `nofollow` for retailer purchase links):
`Footer.tsx`, `StringCard.tsx`, `PurchaseOptions.tsx`,
`StringingEnquiry.tsx` (WhatsApp link), `Impressum.tsx`, `Datenschutz.tsx`,
`RetailerAdminCard.tsx`. No unsafe occurrence found; nothing needed fixing.

## Audit + fix: external images

Three `<img>` elements load a URL that isn't a bundled local asset: the
retailer logo in `PurchaseOptions.tsx` (public-facing), and two admin-only
logo/image previews (`RetailerAdminCard.tsx`, `CatalogStringForm.tsx`).
All three already validated the URL as `http(s)`-only before rendering
(`SAFE_URL_PATTERN` in `services/catalogService.ts`, or `parseNullableUrl`
at write time for admin input) and already handled load failure
gracefully (`onError` clears the image, never shows a broken-image icon).

**Fixed**: none of the three previously set `referrerPolicy`, `loading`,
or explicit `width`/`height` — added `referrerPolicy="no-referrer"` (the
retailer's server never learns which Smash Lab page linked to it),
`loading="lazy"`, and explicit dimensions (prevents layout shift while
loading) to all three.

## Audit: `localStorage` / `sessionStorage` usage

| Key | Storage | Contents | Written by |
|---|---|---|---|
| `smashlab:comparisonView` | session | `'radar' \| 'table' \| 'map'` | `logic/comparisonViewPreference.ts` |
| `smashlab:pendingComparisonSelection` | session | array of string ids, consumed once | `logic/pendingComparisonSelection.ts` |
| `smashlab:savedSetup` | local | recommended string/tension/match%/racket model | `logic/savedSetup.ts` |
| Supabase Auth session | local (managed by `@supabase/supabase-js`) | admin login session, `/admin` only | `lib/supabase.ts` |

Nothing here is personally identifying beyond what the visitor themselves
typed into the optional "Racket model" field, and none of it is ever sent
to a server — see `Datenschutz.tsx` section 6, kept in sync with this
table. Every read/write helper follows the same never-throws contract
(privacy modes that block storage access degrade to "nothing saved," not
a crash).

## Audit: Supabase key exposure

`src/lib/supabase.ts` reads only `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` — the anon key is meant to be public (baked into
the browser bundle by design; Row Level Security decides what it can
actually do). Repo-wide search for `service_role`/`SERVICE_ROLE` found it
only in two Node-only migration scripts (`scripts/migrateInventory.ts`,
`scripts/migrateSpecialists.ts`), reading `process.env.SUPABASE_SERVICE_ROLE_KEY`
— **not** `VITE_`-prefixed, so Vite never bundles it into client code —
and in `.env.example`, commented out. No service-role key exists anywhere
reachable from the browser.

## Audit: database security (Supabase/Postgres)

Verified directly against `supabase/migrations/20260727123901_initial_schema.sql`:

- `public.is_admin()` is `security definer` with `set search_path = ''`
  (the empty/pinned search path recommended by Postgres/Supabase security
  guidance — prevents a search-path hijack from redirecting the function's
  unqualified table references).
- `public.admin_users` has `enable row level security` with **zero**
  policies defined — Postgres denies all access to `anon`/`authenticated`
  by default in that state, so the table is not publicly readable even
  though RLS is "enabled" rather than "restrictive-by-policy." Documented
  in the migration's own comment as intentional.
- Every other public table (`strings`, `inventory`, `specialist_profiles`,
  `retailer_prices`) has RLS enabled with an explicit public-read /
  admin-only-write policy pair.

All of the above was already correct on production `main` before this
phase — nothing here needed changing, per the brief's "do not rewrite
correct security code unnecessarily."

## Content-Security-Policy

Delivered via `<meta http-equiv="Content-Security-Policy">` in
`index.html`, because GitHub Pages (static hosting) cannot set custom
response headers.

**Known limitation, not silently omitted**: `frame-ancestors`,
`report-uri`/`report-to`, and `sandbox` are all ignored by browsers when
set via `<meta>` — the CSP spec requires these as an HTTP response header.
This deployment cannot prevent the site being framed by another origin;
there is no server-side workaround available on static GitHub Pages
hosting. This is documented directly in `index.html`'s own comment above
the CSP tag, not assumed or hidden.

Directives set: `default-src 'self'`, `script-src 'self' 'sha256-...'`
(one hash for the single inline JSON-LD structured-data block — **not**
`'unsafe-inline'**; see the full reasoning, and the hash-maintenance
requirement if that script's content ever changes, in `index.html`'s own
comment), `style-src 'self' 'unsafe-inline'` (justified — Framer Motion
and the bar/radar/String Map charts set inline `style` with values
computed at render time, which can never be pre-hashed; CSS-injection-only
risk without script execution is materially lower than `script-src`'s),
`img-src 'self' https:` (retailer logos come from admin-configured URLs
whose exact domains aren't known ahead of time), `font-src 'self'` (every
font is self-hosted), `connect-src 'self' https://*.supabase.co`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-src 'none'` (no `<iframe>`/`<object>`/`<embed>` exists anywhere in
this app).

Verified in-browser (Chromium, built `dist/`) that the full app — home,
quiz (including Framer Motion transitions), comparison (bar/radar charts,
String Map), and the admin shell — loads and functions with zero CSP
violations.
