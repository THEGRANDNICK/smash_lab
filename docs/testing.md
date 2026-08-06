# Testing

## The one obvious command

```
npm test
```

Runs every real test suite in the project — the Vitest suites
(`src/**/*.test.ts`) and every remaining legacy `scripts/testX.ts` suite —
via `scripts/runAllTests.ts`. `npm run test:all` is an exact alias (kept
for anyone who types the more explicit name). `npm run verify` runs
`npm test`, then lint, then the production build — the full pre-push
check.

```
npm test           # everything
npm run test:all   # same as above
npm run test:unit  # only the Vitest suites
npm run verify     # test + lint + build
```

Excluded from `npm test` on purpose: `verify:supabase` and
`verify:catalog` are diagnostics against a **real** Supabase project —
they need live credentials and can't run in a fresh checkout or CI
without secrets, so they stay separate, manually-run commands.

## Suite inventory

Two conventions coexist right now, deliberately — see "Migration status"
below for why.

### Vitest (`src/**/*.test.ts`)

| Suite | Covers |
|---|---|
| `src/data/faqContent.test.ts` | FAQ content — required questions, length/tone rules, structure |

### Legacy plain-`assert` scripts (`scripts/testX.ts`, run via `npm run test:x`)

Each is a standalone script using `node:assert/strict`, printing its own
`"N passed, M failed."` summary and calling `process.exit(1)` on failure —
runnable individually (`npm run test:catalog`) or as part of `npm test`.

| npm script | File | Covers |
|---|---|---|
| `test:catalog` | `testCatalog.ts` | Catalog data integrity, recommendation-engine isolation from Supabase-shaped rows |
| `test:catalog-admin` | `testCatalogAdmin.ts` | Admin catalog CRUD validation (hybrid strings, gauge, color fields) |
| `test:specialist-admin` | `testSpecialistAdmin.ts` | Admin specialist-profile CRUD validation |
| `test:retailers` | `testRetailers.ts` | Retailer/retailer-listing validation, recommendation isolation from retailer modules |
| `test:ui` | `testUiPresentation.ts` | Comparison-row rendering across the full real catalog |
| `test:ui-polish` | `testUiPolish.ts` | Recommendation/tension/comparison regression fixtures, color-swatch resolution, comparison-view persistence, description-clamp threshold |
| `test:catalog-polish` | `testCatalogPolish.ts` | Version/environment display logic |
| `test:color-inventory-fix` | `testColorInventoryFix.ts` | Decimal-input parsing (comma/period) across admin forms |
| `test:color-resolver-v2` | `testColorResolverV2.ts` | String color-swatch resolution against the real catalog |
| `test:color-removal-overlay` | `testColorRemovalAndOverlay.ts` | Overlay-bar and comparison-row generation against the real catalog |
| `test:comparison-experience` | `testComparisonExperience.ts` | Comparison overlay bars + row grouping (overlaps `color-removal-overlay`'s catalog smoke test — see below) |
| `test:admin-dashboard` | `testAdminDashboard.ts` | Admin dashboard data-quality/recent-updates derivation |
| `test:calibration` | `testCalibration.ts` | Recommendation calibration determinism, manufacturer-only vs. specialist-blended scoring |
| `test:price-per-metre` | `testPricePerMetre.ts` | Price-per-metre calculation and retailer-listing ordering |
| `test:retail-sync-foundation` | `testRetailSyncFoundation.ts` | Retail-import module regression (Phase 1-12 behavior unaffected) |
| `test:conversion` | `testConversionFeatures.ts` | This phase's new logic: podium `topThree`, data-source toggle, String Map derivation, match labels, saved-setup storage, enquiry message format, shareable result-state encode/decode |

## Migration status (Part 9)

This is an **incremental, controlled** migration off the plain-`assert`
scripts pattern — not a rewrite of everything at once, per the brief's own
instruction. `faqContent.test.ts` is the first suite ported, chosen
because it's small, self-contained, and easy to verify has identical
coverage to what it replaced (`scripts/testFaq.ts`, removed in the same
change once the Vitest version was confirmed to pass with the same
assertions).

The remaining 16 legacy suites stay as-is for now. They are not lower
quality — several (`testCalibration.ts`, `testRetailSyncFoundation.ts`,
`testUiPolish.ts`) are substantial regression suites pinning real
production behavior — migrating them is future work, not urgent given
`npm test` already runs all of them uniformly today.

**Known overlap, not yet consolidated**: `test:comparison-experience` and
`test:color-removal-overlay` both include a "real catalog smoke test" for
`buildOverlayBarRows`/`buildComparisonRows` that exercises very similar
ground. They were kept separate rather than merged in this phase because
proving the two suites' catalogue-currency assumptions are truly
interchangeable (not just superficially similar) needs a closer read than
this phase had room for — per the brief, "do not delete a test merely
because it looks repetitive without proving equivalent coverage exists
elsewhere." Flagged here for a future consolidation pass instead.
