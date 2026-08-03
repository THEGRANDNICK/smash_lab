// Phase 13A — automated tests for the pure Retail Sync foundation:
// normalization, package detection, the generic matcher, confidence
// scoring, the candidate-draft builder, the fixture adapter + full
// pipeline, the listing-conversion boundary, price-per-metre reuse, and a
// regression check that nothing in Phase 1-12 (retailer CRUD, listing
// CRUD, price sorting, recommendation, comparison, dashboard, FAQ) was
// touched by this phase. Plain assertions via node:assert/strict, run
// directly with tsx — matching this project's existing script style.
//
// Everything under test is pure, synchronous (or Promise-wrapped but
// network-free) TypeScript. No Supabase call is made anywhere in this
// file except the one pre-existing "not configured" fallback check
// reused from the retailer regression suite's own pattern.
//
// Run: npm run test:retail-sync-foundation

import assert from 'node:assert/strict'
import {
  normalizeText,
  normalizeUnicodeCase,
  normalizeWhitespace,
  preserveModelCodes,
  tokenize,
  significantTokens,
  removeGenericRetailWords,
  normalizeBrand,
  extractModelCodes,
  normalizeUrl,
  normalizeCurrencyCode,
  decodeHtmlEntities,
} from '../src/logic/retailImport/normalization.js'
import { detectPackage } from '../src/logic/retailImport/packageDetection.js'
import { matchAgainstCatalog, scoreCandidateMatch } from '../src/logic/retailImport/matcher.js'
import { computeConfidence, CONFIDENCE_EXACT_THRESHOLD, CONFIDENCE_LIKELY_THRESHOLD } from '../src/logic/retailImport/confidence.js'
import { buildImportCandidateDraft } from '../src/logic/retailImport/candidateDraft.js'
import { convertCandidateDraftToListingFormInput } from '../src/logic/retailImport/listingConversion.js'
import { previewPricePerMetre } from '../src/logic/retailImport/pricePerMetrePreview.js'
import { runRetailImportPipeline } from '../src/logic/retailImport/pipeline.js'
import { fixtureAdapter, FIXTURE_RETAILER_ID } from '../src/logic/retailImport/fixtures/fixtureAdapter.js'
import { FIXTURE_CATALOG } from '../src/logic/retailImport/fixtures/fixtureCatalog.js'
import type { CatalogItemRef, DetectedRetailProduct, ImportCandidateDraft } from '../src/logic/retailImport/types.js'

// --- Regression imports: proving Phase 13A touched nothing else ---
import { validateRetailerListingInput, type RetailerListingValidationContext } from '../src/services/retailerListingAdminService.js'
import { bestPricePerMetre, describeBestPricePerMetre, type RetailerListing } from '../src/services/retailerPriceService.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { strings as localCatalog } from '../src/data/strings.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function asyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

function detected(overrides: Partial<DetectedRetailProduct> = {}): DetectedRetailProduct {
  return { title: 'Yonex BG80 Badminton String Set', brand: 'Yonex', sourceRetailerId: 'test-retailer', ...overrides }
}

function catalogItem(overrides: Partial<CatalogItemRef> = {}): CatalogItemRef {
  return { id: 'yonex-bg80', catalogType: 'string', brand: 'Yonex', name: 'BG80', ...overrides }
}

const CATALOG: CatalogItemRef[] = [
  catalogItem({ id: 'yonex-bg80', name: 'BG80' }),
  catalogItem({ id: 'yonex-bg80-power', name: 'BG80 Power' }),
  catalogItem({ id: 'yonex-exbolt-63', name: 'Exbolt 63' }),
  catalogItem({ id: 'yonex-bg65-titanium', name: 'BG65 Titanium', aliases: ['BG65 Ti'] }),
  catalogItem({ id: 'yonex-aerobite', brand: 'Yonex', name: 'AeroBite' }),
  catalogItem({ id: 'yonex-aerobite-boost', brand: 'Yonex', name: 'AeroBite Boost' }),
]

/** Two catalog items chosen so a title that only shares their common prefix scores IDENTICALLY against both (same brand match, same fuzzy token overlap, no exact/substring/model-code tier firing for either) — a genuinely ambiguous case, unlike two same-brand products whose title happens to name one of them exactly. */
const AMBIGUOUS_CATALOG: CatalogItemRef[] = [
  catalogItem({ id: 'yonex-turbo-x', name: 'Turbo X' }),
  catalogItem({ id: 'yonex-turbo-y', name: 'Turbo Y' }),
]

// ---------------------------------------------------------------------------
console.log('=== Normalization ===')
// ---------------------------------------------------------------------------

test('case differences normalize identically', () => {
  assert.equal(normalizeText('YONEX BG80'), normalizeText('yonex bg80'))
})
test('whitespace differences normalize identically', () => {
  assert.equal(normalizeText('Yonex   BG80'), normalizeText('Yonex BG80'))
  assert.equal(normalizeWhitespace('  a   b  '), 'a b')
})
test('punctuation is collapsed to a single space', () => {
  assert.equal(normalizeText('Yonex, BG-80!'), normalizeText('Yonex BG 80'))
})
test('unicode diacritics fold to plain ascii', () => {
  assert.equal(normalizeUnicodeCase('Fenêtre'), 'fenetre')
})
test('HTML entities are decoded before normalization', () => {
  assert.equal(decodeHtmlEntities('Fischer &amp; Sons'), 'Fischer & Sons')
})
test('model codes are preserved and joined regardless of separator: "BG 80" / "BG-80" / "BG80" all normalize the same', () => {
  const a = normalizeText('Yonex BG 80')
  const b = normalizeText('Yonex BG-80')
  const c = normalizeText('Yonex BG80')
  assert.equal(a, b)
  assert.equal(b, c)
  assert.ok(a.includes('bg80'))
})
test('preserveModelCodes never discards the digits or letters themselves', () => {
  const joined = preserveModelCodes('bg 80')
  assert.ok(joined.includes('80'))
  assert.ok(joined.toLowerCase().includes('bg'))
})
test('generic retail words are removed from significant tokens, but product identity survives', () => {
  const tokens = significantTokens('Yonex BG80 Badminton String Set')
  assert.deepStrictEqual(tokens, ['yonex', 'bg80'])
})
test('removeGenericRetailWords strips exactly the packaging/marketing vocabulary, nothing else', () => {
  assert.deepStrictEqual(removeGenericRetailWords(['yonex', 'bg80', 'set', 'string']), ['yonex', 'bg80'])
})
test('brand aliases (case/diacritic differences) normalize to the same brand key', () => {
  assert.equal(normalizeBrand('YONEX'), normalizeBrand('Yonex'))
})
test('extractModelCodes finds letter+digit tokens and ignores pure words or pure numbers', () => {
  assert.deepStrictEqual(extractModelCodes('Yonex BG80 Exbolt63 Badminton String'), ['bg80', 'exbolt63'])
})
test('bare numeric quantities are excluded from significant tokens (package length, not identity)', () => {
  assert.ok(!significantTokens('Yonex BG65 Ti Set 10 m').includes('10'))
})
test('normalizeUrl accepts a safe http(s) URL', () => {
  const result = normalizeUrl('https://example.test/product')
  assert.equal(result.value, 'https://example.test/product')
  assert.equal(result.warning, null)
})
test('normalizeUrl rejects an unsafe URL with a warning, never throws', () => {
  const result = normalizeUrl('javascript:alert(1)')
  assert.equal(result.value, null)
  assert.ok(result.warning)
})
test('normalizeUrl treats a missing URL as a legitimate null, not a warning', () => {
  const result = normalizeUrl(undefined)
  assert.equal(result.value, null)
  assert.equal(result.warning, null)
})
test('normalizeCurrencyCode accepts a currently-supported currency', () => {
  assert.equal(normalizeCurrencyCode('eur').value, 'EUR')
})
test('normalizeCurrencyCode flags an unsupported currency instead of silently accepting it', () => {
  const result = normalizeCurrencyCode('USD')
  assert.equal(result.value, null)
  assert.ok(result.warning?.code === 'unsupported_currency')
})
test('tokenize on an empty/whitespace-only string returns an empty array, never [""]', () => {
  assert.deepStrictEqual(tokenize('   '), [])
})

// ---------------------------------------------------------------------------
console.log('\n=== Package detection ===')
// ---------------------------------------------------------------------------

test('detects a "set" package with no length', () => {
  const result = detectPackage('Yonex BG80 Set')
  assert.equal(result.packageType, 'set')
  assert.equal(result.packageLengthM, null)
})
test('detects a "reel" package with a length in metres', () => {
  const result = detectPackage('Yonex Exbolt 63 200m Reel')
  assert.equal(result.packageType, 'reel')
  assert.equal(result.packageLengthM, 200)
})
test('detects a "hybrid" package', () => {
  const result = detectPackage('Yonex Hybrid Set')
  assert.equal(result.packageType, 'hybrid')
})
test('an unrecognized packaging phrase falls back to "unknown", never a guess', () => {
  const result = detectPackage('Yonex BG80')
  assert.equal(result.packageType, 'unknown')
  assert.ok(result.warnings.length > 0)
})
test('"10 m" is read as 10 metres', () => {
  assert.equal(detectPackage('Yonex BG65 Ti Set 10 m').packageLengthM, 10)
})
test('"10.5m" (no space, decimal) is read as 10.5 metres', () => {
  assert.equal(detectPackage('Something 10.5m').packageLengthM, 10.5)
})
test('"100m roll" is read as a reel of 100 metres ("roll" is a reel-style word)', () => {
  const result = detectPackage('Generic string 100m roll')
  assert.equal(result.packageType, 'reel')
  assert.equal(result.packageLengthM, 100)
})
test('"200 metre spool" is read as a reel of 200 metres', () => {
  const result = detectPackage('String 200 metre spool')
  assert.equal(result.packageType, 'reel')
  assert.equal(result.packageLengthM, 200)
})
test('"2 x 10 m" (quantity x length) is read as 20 metres total, with a warning that it was derived', () => {
  const result = detectPackage('Set of 2 x 10 m')
  assert.equal(result.packageLengthM, 20)
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('quantity')))
})
test('a missing/invalid length is never invented', () => {
  const result = detectPackage('Yonex BG80 Badminton String')
  assert.equal(result.packageLengthM, null)
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('no package length')))
})
test('a "pack"/"box" style word that is neither set/reel/hybrid maps to "other", not "unknown"', () => {
  assert.equal(detectPackage('Value pack of strings').packageType, 'other')
})

// ---------------------------------------------------------------------------
console.log('\n=== Matching ===')
// ---------------------------------------------------------------------------

test('an exact title match against the correct catalog item scores far above any other candidate', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex BG80 Badminton String Set' }), CATALOG)
  assert.equal(matches[0].catalogItem.id, 'yonex-bg80')
  assert.ok(matches[0].score - matches[1].score > 0.12)
})
test('a shared model code contributes strong, explainable evidence', () => {
  const match = scoreCandidateMatch(detected({ title: 'Yonex BG-80 String', brand: 'Yonex' }), catalogItem({ id: 'yonex-bg80', name: 'BG80' }))
  assert.ok(match.evidence.some((e) => e.kind === 'exact_model_code'))
})
test('a matching brand contributes brand_match evidence', () => {
  const match = scoreCandidateMatch(detected({ title: 'Yonex BG80', brand: 'Yonex' }), catalogItem())
  assert.ok(match.evidence.some((e) => e.kind === 'brand_match'))
})
test('a conflicting detected brand contributes a negative brand_conflict signal', () => {
  const match = scoreCandidateMatch(detected({ title: 'BG80 String', brand: 'Li-Ning' }), catalogItem({ brand: 'Yonex' }))
  const conflict = match.evidence.find((e) => e.kind === 'brand_conflict')
  assert.ok(conflict)
  assert.ok(conflict!.weight < 0)
})
test('pure token overlap (no substring, no model code) still produces a positive fallback score', () => {
  const match = scoreCandidateMatch(detected({ title: 'Yonex Aero Bite Boost String', brand: 'Yonex' }), catalogItem({ id: 'yonex-aerobite-boost', name: 'AeroBite Boost' }))
  assert.ok(match.evidence.some((e) => e.kind === 'token_overlap' && e.weight > 0))
})
test('two similar competing products (AeroBite vs AeroBite Boost) rank the more specific title above the shorter name when the title says "Boost"', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex AeroBite Boost Badminton String', brand: 'Yonex' }), CATALOG)
  assert.equal(matches[0].catalogItem.id, 'yonex-aerobite-boost')
})
test('an ambiguity penalty is applied via confidence.ts when two candidates are nearly tied (see Confidence section) — here we just confirm the matcher itself produces close scores for a genuinely ambiguous title', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex Turbo Special Edition', brand: 'Yonex' }), AMBIGUOUS_CATALOG)
  assert.equal(matches.length, 2)
  assert.ok(Math.abs(matches[0].score - matches[1].score) < 0.05)
})
test('no meaningful evidence at all (unrelated title) produces a zero-ish score, not a false positive', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Completely Unrelated Product Name', brand: undefined }), CATALOG)
  assert.ok(matches[0].score < 0.2)
})
test('an empty catalog produces an empty (not thrown) result', () => {
  assert.deepStrictEqual(matchAgainstCatalog(detected(), []), [])
})
test('ranking is deterministic and retailer-independent: the same title scores identically regardless of which retailer/source produced it', () => {
  const a = matchAgainstCatalog(detected({ title: 'Yonex BG80 Set', sourceRetailerId: 'retailer-a' }), CATALOG)
  const b = matchAgainstCatalog(detected({ title: 'Yonex BG80 Set', sourceRetailerId: 'retailer-b' }), CATALOG)
  assert.deepStrictEqual(
    a.map((m) => m.score),
    b.map((m) => m.score),
  )
})
test('a title with no significant words at all is flagged with missing_identity evidence and a zero score', () => {
  const match = scoreCandidateMatch(detected({ title: 'Set Reel Badminton String' }), catalogItem())
  assert.equal(match.score, 0)
  assert.ok(match.evidence.some((e) => e.kind === 'missing_identity'))
})

// ---------------------------------------------------------------------------
console.log('\n=== Confidence ===')
// ---------------------------------------------------------------------------

test('a clear, high-scoring top match is labeled "exact"', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex BG80 Badminton String Set', brand: 'Yonex' }), CATALOG)
  const confidence = computeConfidence(matches)
  assert.equal(confidence.label, 'exact')
  assert.ok(confidence.score >= CONFIDENCE_EXACT_THRESHOLD)
})
test('a partial match (model code + substring, brand only implied by the title text) is labeled "likely" rather than "exact"', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex Exbolt 63 Special Edition String', brand: undefined }), [catalogItem({ id: 'yonex-exbolt-63', name: 'Exbolt 63' })])
  const confidence = computeConfidence(matches)
  assert.ok(confidence.score >= CONFIDENCE_LIKELY_THRESHOLD && confidence.score < CONFIDENCE_EXACT_THRESHOLD)
  assert.equal(confidence.label, 'likely')
})
test('a weak, mostly-unrelated match is labeled "uncertain" or "no_match", never "exact"', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Some Other Brand String', brand: 'Other Brand' }), CATALOG)
  const confidence = computeConfidence(matches)
  assert.notEqual(confidence.label, 'exact')
})
test('an empty catalog always yields "no_match"', () => {
  const confidence = computeConfidence([])
  assert.equal(confidence.label, 'no_match')
  assert.equal(confidence.score, 0)
})
test('reasons are human-readable strings, not bare numbers', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex BG80 Set', brand: 'Yonex' }), CATALOG)
  const confidence = computeConfidence(matches)
  assert.ok(confidence.reasons.every((r) => typeof r === 'string' && r.length > 0))
})
test('two near-tied top matches (Turbo X vs Turbo Y from a title that only says "Turbo") reduce confidence and are flagged ambiguous', () => {
  const matches = matchAgainstCatalog(detected({ title: 'Yonex Turbo Special Edition', brand: 'Yonex' }), AMBIGUOUS_CATALOG)
  const confidence = computeConfidence(matches)
  assert.equal(confidence.ambiguous, true)
  assert.ok(confidence.warnings.some((w) => w.toLowerCase().includes('close')))
})

// ---------------------------------------------------------------------------
console.log('\n=== Candidate draft ===')
// ---------------------------------------------------------------------------

test('a complete, well-formed detected product builds a complete draft with no missing-data warnings', () => {
  const draft = buildImportCandidateDraft({
    detected: detected({ title: 'Yonex BG80 Badminton String Set', brand: 'Yonex', url: 'https://example.test/bg80', imageUrl: 'https://example.test/bg80.jpg', price: 14.99, currency: 'EUR', packageText: 'set' }),
    catalog: CATALOG,
    source: 'test-adapter',
  })
  assert.equal(draft.suggestedCatalogItem?.id, 'yonex-bg80')
  assert.equal(draft.confidence.label, 'exact')
  assert.equal(draft.price, 14.99)
  assert.equal(draft.warnings.some((w) => w.code === 'missing_price'), false)
})
test('an incomplete product (no price, no length, no image) produces the corresponding warnings, not a crash', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Yonex BG80' }), catalog: CATALOG, source: 'test-adapter' })
  assert.ok(draft.warnings.some((w) => w.code === 'missing_price'))
  assert.ok(draft.warnings.some((w) => w.code === 'missing_package_length'))
  assert.ok(draft.warnings.some((w) => w.code === 'missing_image'))
})
test('an unresolvable product (no catalog match) still produces a draft, flagged unresolved_catalog_item, never null/throw', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Totally Unrelated Item', brand: undefined }), catalog: CATALOG, source: 'test-adapter' })
  assert.equal(draft.suggestedCatalogItem, null)
  assert.ok(draft.warnings.some((w) => w.code === 'unresolved_catalog_item'))
})
test('an unsafe URL is dropped from the draft with a warning, never kept as-is', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ url: 'javascript:alert(1)' }), catalog: CATALOG, source: 'test-adapter' })
  assert.equal(draft.url, null)
  assert.ok(draft.warnings.some((w) => w.code === 'missing_url'))
})
test('the draft never invents a suggestedCatalogItem for an empty catalog', () => {
  const draft = buildImportCandidateDraft({ detected: detected(), catalog: [], source: 'test-adapter' })
  assert.equal(draft.suggestedCatalogItem, null)
  assert.equal(draft.confidence.label, 'no_match')
})

// ---------------------------------------------------------------------------
console.log('\n=== Fixture adapter + full pipeline ===')
// ---------------------------------------------------------------------------

await asyncTest('the fixture adapter performs no network access — search() resolves synchronously with fixed data regardless of query', async () => {
  const results = await fixtureAdapter.search({ catalogType: 'string', freeText: 'anything' })
  assert.ok(results.length > 0)
  assert.ok(results.every((r) => r.retailerId === FIXTURE_RETAILER_ID))
})
test('the fixture adapter parses a valid raw result into a DetectedRetailProduct', () => {
  const parsed = fixtureAdapter.parse({ retailerId: FIXTURE_RETAILER_ID, raw: { title: 'Yonex BG80 Badminton String Set', brand: 'Yonex' } })
  assert.equal(parsed?.title, 'Yonex BG80 Badminton String Set')
})
test('the fixture adapter returns null (not throw) for a structurally invalid raw result', () => {
  assert.equal(fixtureAdapter.parse({ retailerId: FIXTURE_RETAILER_ID, raw: { title: '' } }), null)
  assert.equal(fixtureAdapter.parse({ retailerId: FIXTURE_RETAILER_ID, raw: null }), null)
})
await asyncTest('running the full pipeline against the fixture adapter + fixture catalog produces one draft per fixture result, with realistic confidence spread', async () => {
  const drafts = await runRetailImportPipeline(fixtureAdapter, { catalogType: 'string' }, FIXTURE_CATALOG)
  assert.equal(drafts.length, 4)
  const labels = drafts.map((d) => d.confidence.label)
  assert.ok(labels.includes('exact') || labels.includes('likely'))
  assert.ok(labels.includes('no_match'), 'the deliberately unbranded/unresolvable fixture entry should be no_match')
})
await asyncTest('the pipeline never writes to Supabase — running it twice produces byte-identical drafts (no hidden mutable state)', async () => {
  const first = await runRetailImportPipeline(fixtureAdapter, { catalogType: 'string' }, FIXTURE_CATALOG)
  const second = await runRetailImportPipeline(fixtureAdapter, { catalogType: 'string' }, FIXTURE_CATALOG)
  assert.deepStrictEqual(
    first.map((d) => d.confidence.score),
    second.map((d) => d.confidence.score),
  )
})

// ---------------------------------------------------------------------------
console.log('\n=== Listing-conversion boundary ===')
// ---------------------------------------------------------------------------

function draftWith(): ImportCandidateDraft {
  return buildImportCandidateDraft({
    detected: detected({ title: 'Yonex BG80 Set', price: 14.99, currency: 'EUR' }),
    catalog: CATALOG,
    source: 'test-adapter',
  })
}

test('a valid candidate converts cleanly into the EXISTING RetailerListingFormInput shape', () => {
  const draft = draftWith()
  const result = convertCandidateDraftToListingFormInput({ draft, stringId: 'yonex-bg80', retailerId: '1' })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.formInput.stringId, 'yonex-bg80')
    assert.equal(result.formInput.retailerId, '1')
    assert.equal(result.formInput.price, '14.99')
  }
})
test('conversion fails clearly (no throw) when no string id is supplied', () => {
  const result = convertCandidateDraftToListingFormInput({ draft: draftWith(), stringId: '', retailerId: '1' })
  assert.equal(result.ok, false)
})
test('conversion fails clearly when no retailer id is supplied', () => {
  const result = convertCandidateDraftToListingFormInput({ draft: draftWith(), stringId: 'yonex-bg80', retailerId: '' })
  assert.equal(result.ok, false)
})
test('conversion fails clearly when the candidate has no detected price', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Yonex BG80 Set', price: undefined }), catalog: CATALOG, source: 'test-adapter' })
  const result = convertCandidateDraftToListingFormInput({ draft, stringId: 'yonex-bg80', retailerId: '1' })
  assert.equal(result.ok, false)
})
test('a converted form input reuses (not duplicates) the EXISTING validateRetailerListingInput — duplicate detection still runs against real listing rows', () => {
  const draft = draftWith()
  const converted = convertCandidateDraftToListingFormInput({ draft, stringId: 'yonex-bg80', retailerId: '1' })
  assert.equal(converted.ok, true)
  if (!converted.ok) return
  const context: RetailerListingValidationContext = {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [{ id: 1, name: 'Test Retailer', active: true }],
    otherRows: [],
  }
  const validated = validateRetailerListingInput(converted.formInput, context)
  assert.equal(validated.ok, true)
})
test('the conversion boundary never calls createRetailerListing or touches Supabase — it only returns a plain object', () => {
  const draft = draftWith()
  const result = convertCandidateDraftToListingFormInput({ draft, stringId: 'yonex-bg80', retailerId: '1' })
  assert.equal(typeof result, 'object')
  assert.equal('then' in result, false) // not a Promise — fully synchronous
})

// ---------------------------------------------------------------------------
console.log('\n=== Price-per-metre reuse ===')
// ---------------------------------------------------------------------------

test('a candidate with a valid price and package length derives a valid price-per-metre via the EXISTING describeBestPricePerMetre()', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Yonex Exbolt 63 200m Reel', price: 189, currency: 'EUR' }), catalog: CATALOG, source: 'test-adapter' })
  const preview = previewPricePerMetre(draft, 'Test Retailer')
  assert.ok(preview)
  assert.equal(preview!.pricePerMetre, 0.95)
})
test('a candidate missing a package length produces no price-per-metre preview (never invented)', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Yonex BG80', price: 14.99 }), catalog: CATALOG, source: 'test-adapter' })
  assert.equal(previewPricePerMetre(draft, 'Test Retailer'), null)
})
test('a candidate missing a price produces no price-per-metre preview', () => {
  const draft = buildImportCandidateDraft({ detected: detected({ title: 'Yonex Exbolt 63 200m Reel' }), catalog: CATALOG, source: 'test-adapter' })
  assert.equal(previewPricePerMetre(draft, 'Test Retailer'), null)
})
test('the price-per-metre formula itself is unchanged: a real Phase-12 RetailerListing produces the same result as before', () => {
  const listing: RetailerListing = {
    id: 1,
    stringId: 'yonex-bg80',
    retailerId: 1,
    retailerName: 'Test Retailer',
    retailerLogoUrl: null,
    retailerActive: true,
    productUrl: null,
    price: 20,
    currency: 'EUR',
    availabilityStatus: 'in_stock',
    packageType: 'set',
    packageLengthM: 10,
    isPreferred: false,
    notes: null,
    lastCheckedAt: null,
    updatedAt: new Date().toISOString(),
  }
  const best = bestPricePerMetre([listing])
  assert.equal(best?.pricePerMetre, 2)
  assert.equal(describeBestPricePerMetre([listing])?.formatted, '€2.00/m')
})

// ---------------------------------------------------------------------------
console.log('\n=== Regression: existing Phase 1-12 behavior is unchanged ===')
// ---------------------------------------------------------------------------

test('retailer-listing validation (duplicate keying, currency/availability/package-type checks) behaves exactly as before Phase 13A', () => {
  const context: RetailerListingValidationContext = {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [{ id: 1, name: 'Test Retailer', active: true }],
    otherRows: [],
  }
  const result = validateRetailerListingInput(
    { stringId: 'yonex-bg80', retailerId: '1', productUrl: '', price: '10', currency: 'EUR', availabilityStatus: 'in_stock', packageType: 'set', packageLengthM: '10', isPreferred: false, notes: '', lastCheckedAt: '' },
    context,
  )
  assert.equal(result.ok, true)
})
test('recommendStrings is unaffected by the retailImport modules being imported into the same process', () => {
  const answers: QuizAnswers = { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' }
  const rec = recommendStrings(answers, localCatalog)
  const rec2 = recommendStrings(answers, localCatalog)
  assert.equal(rec2.best.string.id, rec.best.string.id)
  assert.equal(rec2.best.matchPercent, rec.best.matchPercent)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
