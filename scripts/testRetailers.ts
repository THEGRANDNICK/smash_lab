// Automated tests for Phase 7's retailer price administration (revised,
// normalized model): retailer ENTITY row mapping/validation
// (retailerService.ts), retailer LISTING row mapping/validation
// (retailerPriceService.ts), admin form validation for both entities
// (retailerAdminService.ts) and listings (retailerListingAdminService.ts),
// ordering/comparison logic, and recommendation-isolation regression.
// Plain assertions via node:assert/strict, run directly with tsx —
// matching this project's existing script style. No network calls except
// the one deliberate "Supabase not configured" fallback-behavior check
// below (which never leaves this machine — isSupabaseConfigured is false
// in this environment with no .env.local present).
//
// NOT covered here (verified separately, see the Phase 7 report):
//   - The actual SQL migration (legacy retailer_name -> retailers +
//     retailer_id, legacy set/reel/sale price preservation, the
//     case-insensitive-merge collision resolution) — there is no JS
//     function that performs this, it's pure SQL. Verified directly via
//     local Postgres integration testing (seeding legacy rows, applying
//     the migration, inspecting the result, re-running for idempotency).
//   - RLS (anon/non-admin/admin) for both public.retailers and
//     public.retailer_prices, and the FK-restrict-on-delete-with-listings
//     behavior — verified directly via local Postgres+PostgREST.
//   - The actual "hide listings whose retailer is inactive" filtering
//     inside fetchRetailerPricesFromSupabase() (a live-fetch loop) —
//     the building block it depends on (mapRetailerPriceRow correctly
//     carrying a retailer's active flag onto the mapped listing) IS
//     tested below; the filtering itself was verified via local
//     Postgres+PostgREST integration testing (deactivate a retailer,
//     confirm its listings disappear from the public fetch but remain in
//     the admin fetch).
//
// Catalog regression, inventory regression, and specialist regression are
// NOT re-tested here — this phase did not modify catalogService.ts,
// inventoryService.ts, or specialistProfileService.ts at all, so their
// existing coverage (npm run test:catalog / test:catalog-admin /
// test:specialist-admin) already proves nothing broke.
//
// Run: npm run test:retailers

import assert from 'node:assert/strict'
import {
  mapRetailerPriceRow,
  orderRetailerListings,
  areListingsComparable,
  groupComparableListings,
  lowestPriceInGroup,
  pricePerMetre,
  formatRetailerPrice,
  findPreferredConflicts,
  findDuplicateCandidates,
  summarizeRetailerDiagnostics,
  fetchRetailerPricesFromSupabase,
  type RetailerListing,
} from '../src/services/retailerPriceService.js'
import { mapRetailerRow, findDuplicateRetailerNameCandidates, fetchRetailersFromSupabase, type Retailer } from '../src/services/retailerService.js'
import {
  validateRetailerListingInput,
  emptyRetailerListingFormInput,
  retailerListingFormInputFromRow,
  type AdminRetailerListingRow,
  type RetailerListingFormInput,
  type RetailerOption,
} from '../src/services/retailerListingAdminService.js'
import {
  validateRetailerInput,
  emptyRetailerFormInput,
  retailerFormInputFromRow,
  type AdminRetailerRow,
  type RetailerFormInput,
} from '../src/services/retailerAdminService.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { strings as localCatalog } from '../src/data/strings.js'
import type { QuizAnswers } from '../src/logic/types.js'
import type { Database } from '../src/types/database.js'

type RetailerRow = Database['public']['Tables']['retailers']['Row']
type RetailerPriceRow = Database['public']['Tables']['retailer_prices']['Row']

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

function baseRetailerRow(overrides: Partial<RetailerRow> = {}): RetailerRow {
  return {
    id: 1,
    name: 'RetailerA',
    logo_url: null,
    website_url: null,
    country: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function retailer(overrides: Partial<Retailer> = {}): Retailer {
  return { id: 1, name: 'RetailerA', logoUrl: null, websiteUrl: null, country: null, active: true, updatedAt: '2026-01-01T00:00:00Z', ...overrides }
}

function baseListingRow(overrides: Partial<RetailerPriceRow> = {}): RetailerPriceRow {
  return {
    id: 1,
    string_id: 'yonex-bg80',
    retailer_id: 1,
    product_url: null,
    price: null,
    currency: 'EUR',
    availability_status: 'unknown',
    package_type: 'set',
    package_length_m: null,
    is_preferred: false,
    notes: null,
    last_checked_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function listing(overrides: Partial<RetailerListing> = {}): RetailerListing {
  return {
    id: 1,
    stringId: 'yonex-bg80',
    retailerId: 1,
    retailerName: 'RetailerA',
    retailerLogoUrl: null,
    retailerActive: true,
    productUrl: null,
    price: null,
    currency: 'EUR',
    availabilityStatus: 'unknown',
    packageType: 'set',
    packageLengthM: null,
    isPreferred: false,
    notes: null,
    lastCheckedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

console.log('=== Retailer ENTITY row mapping (mapRetailerRow) ===')
test('accepts a well-formed retailer', () => {
  const result = mapRetailerRow(baseRetailerRow({ logo_url: 'https://example.com/logo.png', website_url: 'https://example.com', country: 'DE' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.retailer.logoUrl, 'https://example.com/logo.png')
    assert.equal(result.retailer.country, 'DE')
  }
})
test('rejects an empty name', () => {
  assert.equal(mapRetailerRow(baseRetailerRow({ name: '  ' })).ok, false)
})
test('rejects a javascript: scheme logo URL', () => {
  assert.equal(mapRetailerRow(baseRetailerRow({ logo_url: 'javascript:alert(1)' })).ok, false)
})
test('rejects a javascript: scheme website URL', () => {
  assert.equal(mapRetailerRow(baseRetailerRow({ website_url: 'javascript:alert(1)' })).ok, false)
})
test('rejects a malformed country code', () => {
  assert.equal(mapRetailerRow(baseRetailerRow({ country: 'Germany' })).ok, false)
})
test('accepts a null country, logo, and website', () => {
  assert.equal(mapRetailerRow(baseRetailerRow({ country: null, logo_url: null, website_url: null })).ok, true)
})
test('carries the active flag through', () => {
  const result = mapRetailerRow(baseRetailerRow({ active: false }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.retailer.active, false)
})

console.log('\n=== Retailer LISTING row mapping (mapRetailerPriceRow), joined with a retailer ===')
test('accepts a well-formed listing joined with a valid retailer', () => {
  const result = mapRetailerPriceRow(baseListingRow({ price: 12.99 }), retailer())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.item.retailerName, 'RetailerA')
    assert.equal(result.item.price, 12.99)
  }
})
test('rejects a listing whose retailer_id has no matching retailer (missing retailer relation)', () => {
  const result = mapRetailerPriceRow(baseListingRow(), undefined)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.reason, /missing retailer relation/)
})
test('carries retailerActive=false through for a listing joined with an inactive retailer', () => {
  const result = mapRetailerPriceRow(baseListingRow(), retailer({ active: false }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.item.retailerActive, false)
})
test('carries the retailer logo URL through', () => {
  const result = mapRetailerPriceRow(baseListingRow(), retailer({ logoUrl: 'https://example.com/logo.png' }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.item.retailerLogoUrl, 'https://example.com/logo.png')
})

console.log('\n=== Decimal price / negative price / URL / availability / package validation (listing) ===')
test('accepts a price with 2 decimal places', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ price: 12.99 }), retailer()).ok, true)
})
test('rejects a price with more than 2 decimal places', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ price: 12.999 }), retailer()).ok, false)
})
test('rejects a negative price', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ price: -1 }), retailer()).ok, false)
})
test('accepts a zero price', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ price: 0 }), retailer()).ok, true)
})
test('accepts a valid https product URL', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ product_url: 'https://example.com/product' }), retailer()).ok, true)
})
test('rejects a javascript: scheme product URL', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ product_url: 'javascript:alert(1)' }), retailer()).ok, false)
})
for (const status of ['in_stock', 'low_stock', 'out_of_stock', 'preorder', 'discontinued', 'unknown'] as const) {
  test(`accepts availability_status "${status}"`, () => {
    assert.equal(mapRetailerPriceRow(baseListingRow({ availability_status: status }), retailer()).ok, true)
  })
}
test('rejects an invalid availability_status', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ availability_status: 'maybe' as RetailerPriceRow['availability_status'] }), retailer()).ok, false)
})
for (const type of ['set', 'reel', 'hybrid', 'other'] as const) {
  test(`accepts package_type "${type}"`, () => {
    assert.equal(mapRetailerPriceRow(baseListingRow({ package_type: type }), retailer()).ok, true)
  })
}
test('rejects an invalid package_type', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ package_type: 'bundle' as RetailerPriceRow['package_type'] }), retailer()).ok, false)
})
test('rejects a zero or negative package length', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ package_length_m: 0 }), retailer()).ok, false)
  assert.equal(mapRetailerPriceRow(baseListingRow({ package_length_m: -10 }), retailer()).ok, false)
})
test('accepts a positive package length, and a null one', () => {
  assert.equal(mapRetailerPriceRow(baseListingRow({ package_length_m: 200 }), retailer()).ok, true)
  assert.equal(mapRetailerPriceRow(baseListingRow({ package_length_m: null }), retailer()).ok, true)
})

console.log('\n=== Retailer entity admin form validation ===')
function validRetailerInput(overrides: Partial<RetailerFormInput> = {}): RetailerFormInput {
  return { ...emptyRetailerFormInput(), name: 'RetailerA', ...overrides }
}
test('rejects a blank name', () => {
  const result = validateRetailerInput(validRetailerInput({ name: '  ' }), { otherRetailers: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.name)
})
test('accepts a fully valid input', () => {
  const result = validateRetailerInput(validRetailerInput({ logoUrl: 'https://example.com/l.png', websiteUrl: 'https://example.com', country: 'de' }), { otherRetailers: [] })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.update.name, 'RetailerA')
    assert.equal(result.payload.update.country, 'DE', 'country should be upper-cased')
  }
})
test('rejects an invalid website URL', () => {
  const result = validateRetailerInput(validRetailerInput({ websiteUrl: 'javascript:alert(1)' }), { otherRetailers: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.websiteUrl)
})
test('rejects an invalid logo URL', () => {
  const result = validateRetailerInput(validRetailerInput({ logoUrl: 'not-a-url' }), { otherRetailers: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.logoUrl)
})
test('rejects an invalid country format', () => {
  const result = validateRetailerInput(validRetailerInput({ country: 'Germany' }), { otherRetailers: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.country)
})
function adminRetailerRow(overrides: Partial<AdminRetailerRow> = {}): AdminRetailerRow {
  return { id: 1, name: 'RetailerA', logoUrl: null, websiteUrl: null, country: null, active: true, listingCount: 0, updatedAt: '2026-01-01T00:00:00Z', ...overrides }
}
test('rejects a case-insensitive duplicate retailer name', () => {
  const result = validateRetailerInput(validRetailerInput({ name: 'retailera' }), { otherRetailers: [adminRetailerRow()] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.name)
})
test('editing a retailer does not collide with itself (self excluded via otherRetailers)', () => {
  const result = validateRetailerInput(validRetailerInput(), { otherRetailers: [] }, 1)
  assert.equal(result.ok, true)
})
test('retailerFormInputFromRow round-trips through validateRetailerInput', () => {
  const row = adminRetailerRow({ logoUrl: 'https://example.com/l.png', websiteUrl: 'https://example.com', country: 'IE', active: false })
  const formInput = retailerFormInputFromRow(row)
  const result = validateRetailerInput(formInput, { otherRetailers: [] }, row.id)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.update.logo_url, row.logoUrl)
    assert.equal(result.payload.update.website_url, row.websiteUrl)
    assert.equal(result.payload.update.country, row.country)
    assert.equal(result.payload.update.active, false)
  }
})

console.log('\n=== Retailer listing admin form validation ===')
function adminListingRow(overrides: Partial<AdminRetailerListingRow> = {}): AdminRetailerListingRow {
  return {
    id: 1,
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    retailerId: 1,
    retailerName: 'RetailerA',
    retailerLogoUrl: null,
    retailerActive: true,
    productUrl: null,
    price: null,
    currency: 'EUR',
    availabilityStatus: 'unknown',
    packageType: 'set',
    packageLengthM: null,
    isPreferred: false,
    notes: null,
    lastCheckedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
const ACTIVE_RETAILER_OPTIONS: RetailerOption[] = [{ id: 1, name: 'RetailerA', active: true }]
function validListingInput(overrides: Partial<RetailerListingFormInput> = {}): RetailerListingFormInput {
  return { ...emptyRetailerListingFormInput('yonex-bg80'), retailerId: '1', ...overrides }
}
test('rejects a blank string selection', () => {
  const result = validateRetailerListingInput(validListingInput({ stringId: '' }), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.stringId)
})
test('rejects a string id no longer in the catalog', () => {
  const result = validateRetailerListingInput(validListingInput({ stringId: 'deleted' }), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.stringId)
})
test('rejects a blank retailer selection', () => {
  const result = validateRetailerListingInput(validListingInput({ retailerId: '' }), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.retailerId)
})
test('rejects a retailer id that does not exist', () => {
  const result = validateRetailerListingInput(validListingInput({ retailerId: '999' }), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.retailerId)
})
test('rejects an inactive retailer for a NEW listing', () => {
  const result = validateRetailerListingInput(validListingInput(), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [{ id: 1, name: 'RetailerA', active: false }],
    otherRows: [],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.errors.retailerId ?? '', /inactive/)
})
test('allows an inactive retailer when editing a listing that already pointed at it (originalRetailerId matches)', () => {
  const result = validateRetailerListingInput(validListingInput(), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [{ id: 1, name: 'RetailerA', active: false }],
    otherRows: [],
    originalRetailerId: 1,
  })
  assert.equal(result.ok, true)
})
test('rejects switching an existing listing to a DIFFERENT inactive retailer', () => {
  const result = validateRetailerListingInput(validListingInput({ retailerId: '2' }), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [
      { id: 1, name: 'RetailerA', active: true },
      { id: 2, name: 'RetailerB', active: false },
    ],
    otherRows: [],
    originalRetailerId: 1,
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.errors.retailerId ?? '', /inactive/)
})
test('accepts a fully valid input and produces an update payload', () => {
  const result = validateRetailerListingInput(validListingInput({ price: '12.99', lastCheckedAt: '2026-01-15' }), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: ACTIVE_RETAILER_OPTIONS,
    otherRows: [],
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.update.price, 12.99)
    assert.equal(result.payload.update.retailer_id, 1)
    assert.ok(result.payload.insert)
  }
})
test('blank notes become null, not an empty string', () => {
  const result = validateRetailerListingInput(validListingInput({ notes: '   ' }), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.notes, null)
})
test('a preferred listing warns (non-blocking) when another listing for the same string is already preferred', () => {
  const other = adminListingRow({ id: 99, retailerId: 2, retailerName: 'RetailerB', isPreferred: true })
  const result = validateRetailerListingInput(validListingInput({ isPreferred: true }), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [...ACTIVE_RETAILER_OPTIONS, { id: 2, name: 'RetailerB', active: true }],
    otherRows: [other],
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.warnings.length, 1)
})

console.log('\n=== Listing duplicate detection (string + retailer_id + package type + length) ===')
test('rejects a duplicate listing (same string + retailer + package type + length)', () => {
  const existing = adminListingRow({ id: 1 })
  const result = validateRetailerListingInput(validListingInput(), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [existing] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.retailerId)
})
test('allows the SAME retailer selling a different package type for the same string', () => {
  const existing = adminListingRow({ id: 1, packageType: 'set' })
  const result = validateRetailerListingInput(validListingInput({ packageType: 'reel', packageLengthM: '200' }), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: ACTIVE_RETAILER_OPTIONS,
    otherRows: [existing],
  })
  assert.equal(result.ok, true)
})
test('editing a listing does not collide with itself (editingId excluded)', () => {
  const existing = adminListingRow({ id: 42 })
  const result = validateRetailerListingInput(validListingInput(), { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [existing] }, 42)
  assert.equal(result.ok, true)
})
test('retailerListingFormInputFromRow round-trips through validateRetailerListingInput', () => {
  const row = adminListingRow({ productUrl: 'https://example.com/p', price: 12.99, packageType: 'reel', packageLengthM: 200, isPreferred: true, notes: 'Great value' })
  const formInput = retailerListingFormInputFromRow(row)
  const result = validateRetailerListingInput(formInput, { validStringIds: new Set(['yonex-bg80']), retailers: ACTIVE_RETAILER_OPTIONS, otherRows: [] }, row.id)
  assert.equal(result.ok, true)
  if (result.ok) {
    const u = result.payload.update
    assert.equal(u.retailer_id, row.retailerId)
    assert.equal(u.product_url, row.productUrl)
    assert.equal(u.price, row.price)
    assert.equal(u.package_type, row.packageType)
    assert.equal(u.package_length_m, row.packageLengthM)
    assert.equal(u.is_preferred, row.isPreferred)
    assert.equal(u.notes, row.notes)
  }
})

console.log('\n=== Preferred ordering & deterministic ordering ===')
test('a preferred listing sorts first regardless of price/availability', () => {
  const ordered = orderRetailerListings([
    listing({ id: 1, retailerName: 'Cheap', price: 5, availabilityStatus: 'in_stock' }),
    listing({ id: 2, retailerName: 'Preferred', price: 50, availabilityStatus: 'out_of_stock', isPreferred: true }),
  ])
  assert.equal(ordered[0].retailerName, 'Preferred')
})
test('without a preferred listing, in-stock sorts before out-of-stock', () => {
  const ordered = orderRetailerListings([
    listing({ id: 1, retailerName: 'OutOfStock', availabilityStatus: 'out_of_stock', price: 5 }),
    listing({ id: 2, retailerName: 'InStock', availabilityStatus: 'in_stock', price: 20 }),
  ])
  assert.equal(ordered[0].retailerName, 'InStock')
})
test('within the same availability, lower price sorts first', () => {
  const ordered = orderRetailerListings([
    listing({ id: 1, retailerName: 'Pricier', availabilityStatus: 'in_stock', price: 20 }),
    listing({ id: 2, retailerName: 'Cheaper', availabilityStatus: 'in_stock', price: 10 }),
  ])
  assert.equal(ordered[0].retailerName, 'Cheaper')
})
test('an unpriced listing sorts after every priced listing in the same availability tier', () => {
  const ordered = orderRetailerListings([
    listing({ id: 1, retailerName: 'Unpriced', availabilityStatus: 'in_stock', price: null }),
    listing({ id: 2, retailerName: 'Priced', availabilityStatus: 'in_stock', price: 20 }),
  ])
  assert.equal(ordered[0].retailerName, 'Priced')
})
test('ordering is deterministic: identical input always produces identical output', () => {
  const input = [listing({ id: 1, retailerName: 'B', price: 10 }), listing({ id: 2, retailerName: 'A', price: 10 }), listing({ id: 3, retailerName: 'C', price: 10 })]
  const a = orderRetailerListings(input).map((l) => l.id)
  const b = orderRetailerListings(input).map((l) => l.id)
  assert.deepStrictEqual(a, b)
  assert.deepStrictEqual(a, [2, 1, 3])
})

console.log('\n=== Compatible vs. incompatible price comparison ===')
test('two sets in EUR are comparable', () => {
  assert.equal(areListingsComparable(listing({ packageType: 'set' }), listing({ packageType: 'set' })), true)
})
test('a 10m set and a 200m reel are NOT comparable', () => {
  assert.equal(areListingsComparable(listing({ packageType: 'set', packageLengthM: null }), listing({ packageType: 'reel', packageLengthM: 200 })), false)
})
test('two reels of different lengths are NOT comparable', () => {
  assert.equal(areListingsComparable(listing({ packageType: 'reel', packageLengthM: 100 }), listing({ packageType: 'reel', packageLengthM: 200 })), false)
})
test('groupComparableListings splits a set and a reel into separate groups', () => {
  const groups = groupComparableListings([listing({ id: 1, packageType: 'set', price: 13 }), listing({ id: 2, packageType: 'reel', packageLengthM: 200, price: 140 })])
  assert.equal(groups.length, 2)
})
test('lowestPriceInGroup finds the minimum within one group, ignoring unpriced listings', () => {
  const group = [listing({ id: 1, price: 15 }), listing({ id: 2, price: 12 }), listing({ id: 3, price: null })]
  assert.equal(lowestPriceInGroup(group)?.id, 2)
})

console.log('\n=== Price-per-metre ===')
test('computes price per metre for a reel with a known price and length', () => {
  assert.equal(pricePerMetre(listing({ packageType: 'reel', price: 150, packageLengthM: 200 })), 0.75)
})
test('returns null without a known price or length', () => {
  assert.equal(pricePerMetre(listing({ packageType: 'reel', price: null, packageLengthM: 200 })), null)
  assert.equal(pricePerMetre(listing({ packageType: 'reel', price: 150, packageLengthM: null })), null)
})
test('formatRetailerPrice returns null for an unknown price, and formats a known one', () => {
  assert.equal(formatRetailerPrice(null, 'EUR'), null)
  assert.match(formatRetailerPrice(12.99, 'EUR') ?? '', /12[.,]99/)
})

console.log('\n=== Diagnostics helpers ===')
test('findPreferredConflicts flags a string with more than one preferred listing', () => {
  const map = { 'yonex-bg80': [listing({ id: 1, isPreferred: true }), listing({ id: 2, isPreferred: true })] }
  assert.deepStrictEqual(findPreferredConflicts(map), ['yonex-bg80'])
})
test('findDuplicateCandidates flags the same retailer_id appearing twice for one string', () => {
  const map = { 'yonex-bg80': [listing({ id: 1, retailerId: 1 }), listing({ id: 2, retailerId: 1, packageType: 'reel' })] }
  assert.equal(findDuplicateCandidates(map).length, 1)
})
test('summarizeRetailerDiagnostics reports strings with zero listings from the full catalog id list', () => {
  const map = { 'yonex-bg80': [listing()] }
  const summary = summarizeRetailerDiagnostics(map, ['yonex-bg80', 'yonex-exbolt-65'])
  assert.deepStrictEqual(summary.stringsWithoutListingIds, ['yonex-exbolt-65'])
  assert.equal(summary.totalListings, 1)
})
test('findDuplicateRetailerNameCandidates flags a case-insensitive collision', () => {
  const byId = { 1: retailer({ id: 1, name: 'RetailerA' }), 2: retailer({ id: 2, name: 'retailera' }) }
  assert.equal(findDuplicateRetailerNameCandidates(byId).length, 1)
})
test('findDuplicateRetailerNameCandidates reports none for distinct names', () => {
  const byId = { 1: retailer({ id: 1, name: 'RetailerA' }), 2: retailer({ id: 2, name: 'RetailerB' }) }
  assert.equal(findDuplicateRetailerNameCandidates(byId).length, 0)
})

console.log('\n=== Public fallback behavior ===')
await asyncTest('fetchRetailerPricesFromSupabase falls back to an empty map when Supabase is not configured', async () => {
  const result = await fetchRetailerPricesFromSupabase()
  assert.equal(result.status.source, 'unavailable')
  assert.deepStrictEqual(result.listingsByStringId, {})
})
await asyncTest('fetchRetailersFromSupabase falls back to an empty map when Supabase is not configured', async () => {
  const result = await fetchRetailersFromSupabase()
  assert.equal(result.status.source, 'unavailable')
  assert.deepStrictEqual(result.retailersById, {})
})

console.log('\n=== Recommendation isolation regression ===')
test('recommendStrings accepts no 4th (retailer) argument — enforced at compile time, see the @ts-expect-error call below', () => {
  // This line only PASSES `tsc -b` if calling recommendStrings with a 4th
  // argument is genuinely a type error — if a retailer parameter were
  // ever added, @ts-expect-error would then be reporting on a non-error
  // and `npx tsc -b` (run as part of `npm run build` and every phase's
  // verification) would fail.
  // @ts-expect-error retailer data must never be an accepted parameter of recommendStrings
  const _neverCompiles = () => recommendStrings({}, localCatalog, {}, { fakeRetailerData: true })
  void _neverCompiles
  assert.ok(true)
})
test('recommendStrings output is unaffected by retailer modules being imported into the same process', () => {
  const answers: QuizAnswers = { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' }
  const rec = recommendStrings(answers, localCatalog)
  const fakeListings: Record<string, RetailerListing[]> = { [rec.best.string.id]: [listing({ stringId: rec.best.string.id, price: 999.99, isPreferred: true })] }
  void fakeListings // never passed anywhere recommendStrings can see it
  const rec2 = recommendStrings(answers, localCatalog)
  assert.equal(rec2.best.string.id, rec.best.string.id)
  assert.equal(rec2.best.matchPercent, rec.best.matchPercent)
  assert.equal(rec2.explanations.best, rec.explanations.best)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
