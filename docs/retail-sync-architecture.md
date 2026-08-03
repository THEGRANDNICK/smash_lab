# Retail Sync architecture (Phase 13A — pure foundation)

Phase 13A builds the **pure, in-memory foundation** a future retailer price
scanner can be built on top of. It does not scan anything, scrape anything,
schedule anything, or persist anything. It does not add a workflow more
complicated than the existing manual "+ New listing" admin form — that
form remains the only production way to create a retailer listing today.

## Why this exists

Every retailer listing on Smash Lab is currently created by hand: an admin
finds a product on a retailer's site, then manually types the price,
package length, and availability into the Retailer Listings admin form.
That's fine at a handful of listings; it doesn't scale forever. Phase 13A
does not build scraping, scheduled automation, or a review UI — those are
explicitly future phases (see the roadmap below). This phase builds only
the pure logic those phases will need, so that later work is additive
rather than a rewrite.

## What exists today that a future importer must reuse

(See the Phase 13A audit for the full detail; summarized here.)

- **`public.retailers`** (`src/services/retailerService.ts` read path,
  `retailerAdminService.ts` admin CRUD) — retailer entities: name, logo,
  website, country, active flag.
- **`public.retailer_prices`** (`src/services/retailerPriceService.ts` read
  path, `retailerListingAdminService.ts` admin CRUD) — one row per
  retailer selling one catalog string in one package. Validated by
  `validateRetailerListingInput()`, whose natural-key duplicate rule is
  "same string + retailer + package type + package length" — enforced
  both by that function and by the database's own unique index.
- **Price-per-metre**: `retailerPriceService.ts`'s `pricePerMetre()`,
  `bestPricePerMetre()`, and `describeBestPricePerMetre()` — the one
  shared "which price-per-metre represents this string" rule used
  everywhere in the public UI.
- **Package type / availability**: fixed unions (`RetailerPackageType` =
  `set | reel | hybrid | other`, `RetailerAvailabilityStatus` = six
  values) defined in `src/types/database.ts`, enforced by CHECK
  constraints in `supabase/migrations/20260728150000_phase7_retailer_price_admin.sql`.
- **Catalog identity**: `public.strings` rows are identified by a free-text
  `id` (e.g. `yonex-bg80`), with separate `brand`/`name` columns. No
  brand/product-name normalization existed anywhere in the codebase before
  this phase — Phase 13A's `normalization.ts` is the first.

Phase 13A reuses all of the above directly (see "Price-per-metre reuse"
and "Listing-conversion boundary" below) rather than duplicating any of
it.

## The pure pipeline

```
RetailerAdapter.search(query)
  -> RawRetailSearchResult[]        (opaque; only the adapter understands `raw`)
RetailerAdapter.parse(raw)
  -> DetectedRetailProduct | null   (null = skipped, not an error)
RetailerAdapter.normalize?(detected)
  -> DetectedRetailProduct         (optional adapter-specific quirk correction)
matchAgainstCatalog(detected, catalog)
  -> CatalogMatchCandidate[]        (ranked, with explainable evidence)
computeConfidence(matches)
  -> ConfidenceResult               (0-100, label, reasons, warnings)
buildImportCandidateDraft(...)
  -> ImportCandidateDraft           (in-memory only — the last stage this phase builds)
```

Everything from `search()` through `buildImportCandidateDraft()` is pure,
synchronous-or-Promise-only TypeScript with **zero Supabase calls**. The
whole chain (except the network call a real adapter's `search()` would
eventually make) can be exercised with no live Supabase connection at
all — see `scripts/testRetailSyncFoundation.ts` and
`scripts/reportRetailSyncFoundation.ts`.

## Where each stage lives

| Stage | File |
|---|---|
| Domain types | `src/logic/retailImport/types.ts` |
| Normalization | `src/logic/retailImport/normalization.ts` |
| Package detection | `src/logic/retailImport/packageDetection.ts` |
| Matching | `src/logic/retailImport/matcher.ts` |
| Confidence | `src/logic/retailImport/confidence.ts` |
| Candidate draft builder | `src/logic/retailImport/candidateDraft.ts` |
| Orchestration | `src/logic/retailImport/pipeline.ts` |
| Listing-conversion boundary | `src/logic/retailImport/listingConversion.ts` |
| Price-per-metre reuse | `src/logic/retailImport/pricePerMetrePreview.ts` |
| Fixture adapter (dev/test only) | `src/logic/retailImport/fixtures/fixtureAdapter.ts` |
| Fixture catalog (dev/test only) | `src/logic/retailImport/fixtures/fixtureCatalog.ts` |
| Diagnostic script | `scripts/reportRetailSyncFoundation.ts` |
| Test suite | `scripts/testRetailSyncFoundation.ts` |

Nothing in this list is imported by `src/App.tsx`, any component under
`src/components`, or any admin surface. It is invisible to both normal
users and admins in this phase.

## The adapter contract

```ts
export interface RetailerAdapter {
  id: string
  label: string
  search(query: RetailSearchQuery): Promise<RawRetailSearchResult[]>
  parse(raw: RawRetailSearchResult): DetectedRetailProduct | null
  normalize?(detected: DetectedRetailProduct): DetectedRetailProduct
}
```

- **`search()`** decides how to find candidate products for a given
  retailer + query. A real adapter's implementation is the only place a
  future phase's network access would live — nothing in this phase makes
  any such call.
- **`parse()`** turns ONE raw result into a `DetectedRetailProduct`, or
  `null` if it can't be parsed. A `null` is skipped, not an error.
- **`normalize()`** is optional, and should be used ONLY for a genuine
  retailer-specific extraction quirk (e.g. a site whose titles always
  include its own store name as a prefix). It must never encode matching
  logic — matching stays entirely in `matcher.ts`, which never knows or
  cares which adapter produced a `DetectedRetailProduct`.

This phase ships exactly one adapter — `fixtureAdapter` — which performs
no network access at all (its `search()` always resolves the same fixed,
hand-authored list regardless of the query). It exists only for
`scripts/reportRetailSyncFoundation.ts` and
`scripts/testRetailSyncFoundation.ts`, and is not imported anywhere else.

## Normalization rules

`normalization.ts` provides the pure building blocks every other stage
uses:

- **Unicode/case folding**: NFKD-decompose + strip combining diacritics +
  lowercase, so "Ø"/"É"-style characters compare like their plain-ASCII
  equivalents.
- **HTML entity cleanup**: decodes the small set of entities that
  realistically turn up in scraped titles (`&amp;`, `&nbsp;`, etc.).
- **Model-code preservation**: a letter-run immediately adjacent to a
  digit-run (no separator, a hyphen, or a space) is joined into one token
  — "BG 80", "BG-80", and "BG80" all normalize identically. Meaningful
  model numbers are never discarded, only their separators are
  normalized away.
- **Generic-word removal**: packaging/marketing vocabulary ("badminton",
  "string", "set", "reel", "new", "genuine", "m", "metre", ...) is
  stripped before two titles are compared for product identity —
  `significantTokens()` is what the matcher actually compares, never the
  raw title. Bare numeric tokens (package quantities, not identifiers)
  are stripped too.
- **Currency/URL normalization**: `normalizeCurrencyCode()` and
  `normalizeUrl()` reuse the codebase's EXISTING supported-currency list
  (`retailerPriceService.ts`'s `RETAILER_CURRENCIES`) and safe-URL rule
  (`catalogService.ts`'s `SAFE_URL_PATTERN`) rather than inventing a
  second copy of either.

## Package detection

`packageDetection.ts`'s `detectPackage(text)` looks for packaging
vocabulary ("set", "reel"/"roll"/"spool", "hybrid", "pack"/"box"/"bundle")
and a length in metres (plain `"10 m"` / `"10.5m"` / `"200 metre"`, or a
`"2 x 10 m"` quantity-times-length pattern). It returns a
`DetectedPackageType`, a `packageLengthM` (or `null` — **never invented**
when the text doesn't actually contain one), a confidence, and the
specific evidence/warnings behind each part. Package words are read from
the ORIGINAL text — the exact vocabulary `significantTokens()` strips out
for product-identity comparison.

## Matcher architecture

`matcher.ts`'s `matchAgainstCatalog(detected, catalog)` scores a
`DetectedRetailProduct` against every `CatalogItemRef` and returns them
ranked, with an explainable `evidence: MatchEvidence[]` array per
candidate. **Structured evidence is checked first and weighted highest;
fuzzy token-overlap similarity is only a fallback** for when no structured
signal fired at all:

1. **Exact model code** (strongest) — a model-code-shaped token (e.g.
   `"bg80"`) shared between the detected title and the catalog item's
   name/alias/modelCode.
2. **Exact normalized name** — the detected title's significant tokens
   equal (as an unordered set) the catalog item's own "brand + name" (or
   "brand + alias") tokens.
3. **Brand agreement / conflict** — an explicit detected brand that
   matches the catalog brand is positive evidence; one that actively
   *disagrees* is a negative signal (`brand_conflict`, a negative
   weight) — a real product mismatch, not just "no signal". A brand
   found only as a substring of the title (no separate brand field) is
   weaker positive evidence.
4. **Name substring**, then (only if that also fails) **fuzzy token-set
   (Jaccard) overlap** as the fallback.
5. **Package consistency** — a narrow, generic signal: "hybrid" packaging
   detected in the title is modest extra evidence when the catalog
   item's own name also says "hybrid". Pure packaging words (set/reel)
   never affect matching — they describe packaging, not identity, and
   are already stripped by `significantTokens()`.

There is no retailer-specific rule anywhere in this file — it is verified
by test (`scripts/testRetailSyncFoundation.ts`'s "ranking is deterministic
and retailer-independent") that the same title scores identically
regardless of which adapter/retailer produced it. The core matcher reads
only `brand`/`name`/`modelCode`/`aliases` off `CatalogItemRef`, so a
future racket/shoe/bag catalog item satisfies the exact same interface
with zero matcher changes.

## Confidence model

`confidence.ts`'s `computeConfidence(matches)` turns the ranked match list
into:

```ts
{ score: number /* 0-100 */, label: 'exact' | 'likely' | 'uncertain' | 'no_match', reasons: string[], warnings: string[], ambiguous: boolean }
```

- `score >= 90` → **Exact product**
- `score >= 60` → **Likely match**
- `score >= 30` → **Uncertain match**
- otherwise → **No match**

If the top two candidates are nearly tied (within a small score gap), the
result is flagged `ambiguous`, the score is reduced by a fixed penalty,
and a reason/warning explains why — a near-tie is treated as real
uncertainty, never resolved by silently picking one. Confidence never
claims scientific accuracy: it is an explainable heuristic built entirely
from the evidence the matcher already produced, and it never depends on
which retailer/adapter produced the detected product.

**Confidence is deliberately separate from `warnings`.** Confidence is
about whether the detected product *is* the catalog item it's matched
against. Warnings (built independently in `candidateDraft.ts`) are about
data completeness — missing price, missing package length, missing image,
an unsupported currency, an unsafe URL. A candidate can be an *exact*
match with warnings (right product, but no price was on the page) just as
easily as an *uncertain* match with none.

## The Import Candidate Draft — and why it is NOT a database table

`candidateDraft.ts`'s `buildImportCandidateDraft(...)` combines a detected
product, its package-detection result, its ranked catalog matches, and
its confidence result into one plain, in-memory `ImportCandidateDraft`
object. It:

- does **not** save anything to Supabase,
- does **not** create a retailer listing,
- does **not** require (or use) a database table,
- does **not** survive a page reload,
- is **not** surfaced in any admin or public UI in this phase.

**Persistence is deferred, deliberately.** A real review workflow needs a
candidate to survive across admin sessions — that genuinely requires a
database table — but building that table now, before a real scanner
exists to populate it, would mean shipping schema and RLS policy for a
workflow nobody can use yet. Phase 13C (below) is where persistence
belongs, once Phase 13B has a real adapter actually producing candidates
worth reviewing.

## The listing-conversion boundary (Part 10)

`listingConversion.ts`'s `convertCandidateDraftToListingFormInput(...)` is
a **future integration boundary**, explicitly marked as such in its own
doc comment. It builds the EXISTING `RetailerListingFormInput` shape
(reused directly from `retailerListingAdminService.ts` — not a second,
drifting copy of the same fields) from a candidate draft plus a
human-confirmed `stringId`/`retailerId`. It does **not** call
`validateRetailerListingInput()` or `createRetailerListing()` itself, and
there is no approval flow anywhere in this phase — a later phase (13C)
is where an admin-approved candidate would be handed to those EXISTING
functions, exactly as the manual "+ New listing" form already is today,
so duplicate detection and every validation rule are reused unchanged.
The conversion fails clearly (returns `{ ok: false, error }`, never
throws or invents a value) when a required field — string id, retailer
id, or a detected price — is missing.

## Price-per-metre reuse (Part 11)

`pricePerMetrePreview.ts` does **not** implement a price-per-metre
formula. It builds one throwaway, in-memory `RetailerListing` from a
candidate draft's price/currency/package fields purely so the EXISTING
`describeBestPricePerMetre()` (Phase 12) can be called on it. Verified by
test that this produces the exact same result a real Phase 12
`RetailerListing` would.

## Future extensibility (Part 2/9): beyond strings

Almost nothing in this architecture assumes "badminton string":

- `CatalogItemRef` is `{ id, catalogType, brand, name, modelCode?,
  aliases? }` — a future racket, shoe, grip, bag, or accessory satisfies
  this exact interface.
- `matcher.ts` only ever reads `brand`/`name`/`modelCode`/`aliases` — no
  string-specific field (no gauge, no tension, no durability rating).
- `RetailerAdapter` has no category concept at all — the same interface
  works for any product type a retailer sells.
- `src/logic/retailImport/fixtures/fixtureCatalog.ts` is the one
  necessarily string-specific piece — a thin mapping of real
  `src/data/strings.ts` ids into `CatalogItemRef`, kept in `fixtures/`
  precisely because it's a demo/test convenience, not part of the core
  architecture. A real catalog-to-`CatalogItemRef` mapping for a future
  product category is expected to be an equally thin layer near that
  category's own catalog service, not a change to the matcher.

## Security review (Part 15)

- No service-role key was added anywhere in this phase.
- No frontend cross-origin retailer scraping exists — the one shipped
  adapter (`fixtureAdapter`) makes no network call of any kind.
- No arbitrary URL fetching, and therefore no SSRF-capable endpoint —
  there is no fetch call anywhere in this phase's code.
- No database writes of any kind — verified by test
  (`scripts/testRetailSyncFoundation.ts`'s "the pipeline never writes to
  Supabase" check, and simply by the fact that no file under
  `src/logic/retailImport/` imports `getSupabaseClient`).
- No public exposure of importer internals — none of this code is
  imported by any component, admin page, or route.
- Fixture data lives only in `src/logic/retailImport/fixtures/` and is
  used only by dev scripts and the test suite.
- URLs are validated via the existing `SAFE_URL_PATTERN` (http/https
  only) before ever being kept in a draft.

## What this phase deliberately did NOT build

- No database migration, no `import_candidates` table, no RLS policy, no
  grant, no persisted candidate state of any kind.
- No "Retailer Imports" admin page, no candidate cards, no
  approve/ignore/restore UI, no manual-candidate-creation form.
- No Playwright/scraping of any kind.
- No retailer-specific adapters (the one shipped adapter performs no
  network access at all).
- No scheduled/automatic scanning of any kind, no GitHub Actions.
- No AI/LLM extraction.
- No changes to the recommendation engine, the public UI, the existing
  admin UI, or any existing database table's schema.

## Roadmap: how later phases build on this

- **Phase 13A (this phase)**: the pure foundation — types, normalization,
  package detection, matcher, confidence, candidate draft, the
  listing-conversion boundary, and price-per-metre reuse. No persistence,
  no UI, no scraping.
- **Phase 13B**: implement ONE real retailer adapter (`search()` makes an
  actual HTTP/JSON call; `parse()` reads that retailer's real response
  shape into a `DetectedRetailProduct`), run manually from a
  development/admin-safe server-side environment — still no scheduled
  automation, and still no persistence. Everything downstream of
  `search()`/`parse()` (matching, confidence, candidate draft) needs zero
  changes, because the adapter contract is already generic.
- **Phase 13C**: add the persistent review queue this phase deliberately
  deferred — a database table for `ImportCandidateDraft`s (now that
  13B's real adapter gives them something worth reviewing across
  sessions), plus the "Retailer Imports" admin UI (Approve / Edit /
  Ignore) and the approval flow that finally calls
  `convertCandidateDraftToListingFormInput()` followed by the EXISTING
  `validateRetailerListingInput()` + `createRetailerListing()`.
- **Phase 13D**: scheduled price/availability refresh on top of 13B's
  adapter(s) and 13C's review queue — the point at which "automatic
  retailer price sync" actually becomes automatic, with a human review
  step still gating anything that changes a real listing.
