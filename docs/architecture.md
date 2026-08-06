# Architecture

## Directory layout

```
src/
  data/
    strings.ts                  # Local string catalog — fallback/reference, not the live source once Supabase is configured
    quizQuestions.ts            # Quiz copy: question text, options, emoji
    stringSpecialistProfiles.ts # Local specialist-profile fallback data
    faqContent.ts                # FAQ questions/answers (plain data — imported by both the component and its test)
    contact.ts                   # Owner contact details + optional WhatsApp number
    legalConfig.ts                # Impressum/Datenschutz required fields — see docs/legal-setup.md
    siteConfig.ts                 # Canonical site URL/name/description (mirrored by hand into index.html's meta tags)
    serviceConfig.ts              # Homepage turnaround-time note
  config/
    recommendationWeights.ts     # How each quiz answer nudges the string-matching score
    tensionRules.ts               # Base tension ranges, goal/feel adjustments, safety margins
  logic/
    recommendationEngine.ts       # Scores every string against a player's answers (pure)
    recommendationExplanation.ts  # Human-readable reasons built from the engine's own output
    tensionRecommendation.ts      # Tension math, independent of string scoring
    dataSourcePreference.ts       # Manufacturer-only vs. manufacturer+specialist toggle
    stringMapPosition.ts          # Derives the "feel map" x/y position from real data fields
    resultShareState.ts           # Encodes/decodes a shareable #result/<...> link
    savedSetup.ts                  # localStorage "save my setup" helpers
    contactMessage.ts              # Builds the WhatsApp/email enquiry message
    comparisonViewPreference.ts    # Remembers Radar/Table/Feel-map choice for the session
    pricing.ts, units.ts, ...      # Small pure helpers
  services/                        # Supabase read/write functions (one per table/feature)
  hooks/                           # React hooks wrapping services with local-fallback behavior
  components/
    admin/                         # Admin-only CRUD UI, isolated from the public shell
    legal/                         # Impressum/Datenschutz pages, isolated from the public shell
    (everything else)              # Public site UI
  lib/
    supabase.ts                    # Typed Supabase client (anon key only)
    auth.ts                        # Sign-in/sign-out helpers for the admin area
supabase/migrations/                # Database schema + Row Level Security policies
scripts/                            # Test suites (testX.ts) and one-off admin/migration scripts
docs/                                # This file and its siblings
```

## The local-fallback pattern

Every piece of Supabase-backed data follows the same shape, established
starting with the catalog and repeated for inventory and specialist
profiles:

1. The page renders instantly from the local `src/data/*.ts` file —
   no loading spinner, no flicker.
2. The live data is fetched from Supabase in the background.
3. If the fetch succeeds and (for the catalog specifically) is complete,
   it replaces the fallback. If it fails, is misconfigured, or (catalog
   only) is missing a known string, the local fallback keeps being used
   — silently, with a console warning, never a visible error on the
   public site.

The catalog's fallback rule is intentionally stricter than specialist
profiles': a half-broken catalog should never reach visitors (all-or-
nothing), whereas most strings legitimately have no specialist profile
at all, so a successful-but-sparse fetch is used exactly as returned.

## Recommendation engine isolation

`recommendStrings(answers, pool?, specialistProfiles?)` — both `pool` and
`specialistProfiles` are optional parameters defaulting to the local
fallback data. The engine itself never imports Supabase or calls a
service function; every caller (the live UI, via `useStringPool()` /
`useSpecialistProfiles()`) decides what to pass in. This is what makes
the manufacturer-only data-source toggle possible without touching the
engine: passing `{}` for `specialistProfiles` reproduces exactly the
manufacturer-only scoring path the engine already had. See
`docs/recommendation-engine.md` for the full scoring detail.

Retailer/pricing data is never passed into the engine at all — there is
no retailer parameter, so there's nothing to isolate beyond keeping it
that way (enforced at compile time in `scripts/testRetailers.ts` via a
`@ts-expect-error` on a call with an extra argument).

## Routing

Hash-based (`#finder`, `#compare`, `#admin`, `#impressum`, `#datenschutz`,
`#result/<encoded>`), parsed by `src/App.tsx`'s `viewFromHash()`. GitHub
Pages serves the exact same `index.html` for every path, and a hash
fragment is never sent to the server — so every route above is really the
same document, distinguished only client-side. This has real
consequences documented elsewhere: `public/robots.txt`/`sitemap.xml`
only list the root URL (see `docs/deployment.md`), and a shared
`#result/<encoded>` link falls back to the site's generic Open Graph
preview rather than one describing that specific result — there's no
server to generate a per-result preview for.

The admin area and legal pages are deliberately isolated from the main
public shell (no shared `Nav`/`Footer`) — each is a simple, always-
reachable page even if something else on the site errors.
