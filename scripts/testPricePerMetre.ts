// Phase 12 — dedicated price-per-metre regression suite (Part 23). Covers
// the shared helpers in services/retailerPriceService.ts
// (bestPricePerMetre, describeBestPricePerMetre) and their consumers
// (logic/sortStrings.ts, mapRetailerPriceRow's own validation), so pricing
// and sorting behavior is pinned independently of testRetailers.ts's
// broader Phase 7 suite.
//
// Run: npm run test:price-per-metre

import assert from 'node:assert/strict'
import {
  bestPricePerMetre,
  describeBestPricePerMetre,
  mapRetailerPriceRow,
  pricePerMetre,
  type RetailerListing,
} from '../src/services/retailerPriceService.js'
import { sortStrings } from '../src/logic/sortStrings.js'
import { strings as localCatalog } from '../src/data/strings.js'
import type { Database } from '../src/types/database.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${err instanceof Error ? err.message : String(err)}`)
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

type Row = Database['public']['Tables']['retailer_prices']['Row']

function row(overrides: Partial<Row> = {}): Row {
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
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Row
}

const RETAILER = { id: 1, name: 'RetailerA', logoUrl: null, active: true, websiteUrl: null, country: null, updatedAt: '2026-01-01T00:00:00Z' }

// ---------------------------------------------------------------------------
// pricePerMetre() — per-listing calculation
// ---------------------------------------------------------------------------
console.log('\n=== Per-listing price-per-metre calculation ===')
test('valid reel: known price and length', () => {
  assert.equal(pricePerMetre(listing({ price: 120, packageType: 'reel', packageLengthM: 200 })), 0.6)
})
test('valid set: known price and length', () => {
  assert.equal(pricePerMetre(listing({ price: 8.5, packageType: 'set', packageLengthM: 10 })), 0.85)
})
test('decimal price', () => {
  assert.equal(pricePerMetre(listing({ price: 11.99, packageLengthM: 10 })), 1.2)
})
test('decimal package length', () => {
  assert.equal(pricePerMetre(listing({ price: 10, packageLengthM: 6.5 })), Math.round((10 / 6.5) * 100) / 100)
})
test('missing price returns null', () => {
  assert.equal(pricePerMetre(listing({ price: null, packageLengthM: 10 })), null)
})
test('missing length returns null', () => {
  assert.equal(pricePerMetre(listing({ price: 10, packageLengthM: null })), null)
})
test('zero length returns null (never divides by zero)', () => {
  assert.equal(pricePerMetre(listing({ price: 10, packageLengthM: 0 })), null)
})
test('negative length returns null', () => {
  assert.equal(pricePerMetre(listing({ price: 10, packageLengthM: -5 })), null)
})

// ---------------------------------------------------------------------------
// Row validation — zero/negative length and unsupported currency rejected
// before a listing ever reaches pricePerMetre()
// ---------------------------------------------------------------------------
console.log('\n=== Row validation ===')
test('rejects a negative package_length_m', () => {
  const result = mapRetailerPriceRow(row({ package_length_m: -1 }), RETAILER)
  assert.equal(result.ok, false)
})
test('rejects a zero package_length_m', () => {
  const result = mapRetailerPriceRow(row({ package_length_m: 0 }), RETAILER)
  assert.equal(result.ok, false)
})
test('rejects a negative price', () => {
  const result = mapRetailerPriceRow(row({ price: -5 }), RETAILER)
  assert.equal(result.ok, false)
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
test('rejects an unsupported currency', () => {
  const result = mapRetailerPriceRow(row({ currency: 'USD' as unknown as Row['currency'] }), RETAILER)
  assert.equal(result.ok, false)
})
test('accepts a missing (null) package length — allowed, just not comparable', () => {
  const result = mapRetailerPriceRow(row({ package_length_m: null }), RETAILER)
  assert.equal(result.ok, true)
})
test('accepts a missing (null) price — allowed, "price on request"', () => {
  const result = mapRetailerPriceRow(row({ price: null }), RETAILER)
  assert.equal(result.ok, true)
})
test('original package price and length are preserved unchanged on the mapped listing', () => {
  const result = mapRetailerPriceRow(row({ price: 45.5, package_length_m: 100, package_type: 'reel' }), RETAILER)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.item.price, 45.5)
    assert.equal(result.item.packageLengthM, 100)
  }
})

// ---------------------------------------------------------------------------
// bestPricePerMetre() — availability preference + best-available selection
// ---------------------------------------------------------------------------
console.log('\n=== bestPricePerMetre() — availability preference ===')
test('prefers an available (in_stock) listing over a cheaper out_of_stock one', () => {
  const listings = [
    listing({ id: 1, availabilityStatus: 'out_of_stock', price: 5, packageLengthM: 100 }), // €0.05/m, but unavailable
    listing({ id: 2, availabilityStatus: 'in_stock', price: 20, packageLengthM: 100 }), // €0.20/m, available
  ]
  const best = bestPricePerMetre(listings)
  assert.equal(best?.listing.id, 2)
})
test('among equally-available listings, the lowest price-per-metre wins', () => {
  const listings = [
    listing({ id: 1, availabilityStatus: 'in_stock', price: 30, packageLengthM: 100 }),
    listing({ id: 2, availabilityStatus: 'in_stock', price: 15, packageLengthM: 100 }),
  ]
  const best = bestPricePerMetre(listings)
  assert.equal(best?.listing.id, 2)
  assert.equal(best?.pricePerMetre, 0.15)
})
test('a listing without a valid price-per-metre never wins even if otherwise available', () => {
  const listings = [
    listing({ id: 1, availabilityStatus: 'in_stock', price: null, packageLengthM: null }),
    listing({ id: 2, availabilityStatus: 'out_of_stock', price: 10, packageLengthM: 100 }),
  ]
  const best = bestPricePerMetre(listings)
  assert.equal(best?.listing.id, 2)
})
test('returns null when no listing has a valid price-per-metre at all', () => {
  const listings = [listing({ price: null }), listing({ packageLengthM: null })]
  assert.equal(bestPricePerMetre(listings), null)
})
test('a set and a reel of the same string are both valid candidates (normalized by length)', () => {
  const listings = [
    listing({ id: 1, packageType: 'set', price: 8, packageLengthM: 10 }), // €0.80/m
    listing({ id: 2, packageType: 'reel', price: 100, packageLengthM: 200 }), // €0.50/m
  ]
  const best = bestPricePerMetre(listings)
  assert.equal(best?.listing.id, 2)
})
test('deterministic tie-break: identical price-per-metre and availability falls back to retailer name then id', () => {
  const listings = [
    listing({ id: 2, retailerName: 'Zed Store', price: 10, packageLengthM: 100 }),
    listing({ id: 1, retailerName: 'Alpha Store', price: 10, packageLengthM: 100 }),
  ]
  const best = bestPricePerMetre(listings)
  assert.equal(best?.listing.retailerName, 'Alpha Store')
})
test('stable, repeatable result across repeated calls with the same input', () => {
  const listings = [listing({ id: 1, price: 20, packageLengthM: 100 }), listing({ id: 2, price: 10, packageLengthM: 100 })]
  const a = bestPricePerMetre(listings)
  const b = bestPricePerMetre(listings)
  assert.deepEqual(a, b)
})

// ---------------------------------------------------------------------------
// describeBestPricePerMetre() — display formatting
// ---------------------------------------------------------------------------
console.log('\n=== describeBestPricePerMetre() — formatting ===')
test('formats a price-per-metre with a "/m" suffix and a source description', () => {
  const summary = describeBestPricePerMetre([listing({ price: 120, packageType: 'reel', packageLengthM: 200, retailerName: 'ProShop' })])
  assert.ok(summary)
  assert.match(summary!.formatted, /\/m$/)
  assert.match(summary!.sourceDescription, /200m reel at ProShop/)
})
test('returns null when nothing has a valid price-per-metre', () => {
  assert.equal(describeBestPricePerMetre([listing({ price: null })]), null)
})
test('never shows a price-per-metre when package length is unknown', () => {
  assert.equal(describeBestPricePerMetre([listing({ price: 15, packageLengthM: null })]), null)
})

// ---------------------------------------------------------------------------
// sortStrings() — catalog-level price sorting
// ---------------------------------------------------------------------------
console.log('\n=== sortStrings() — price-per-metre sorting ===')
{
  const sample = localCatalog.slice(0, 3)
  const [a, b, c] = sample

  const listingsByStringId: Record<string, RetailerListing[]> = {
    [a.id]: [listing({ stringId: a.id, price: 30, packageLengthM: 100 })], // €0.30/m
    [b.id]: [listing({ stringId: b.id, price: 10, packageLengthM: 100 })], // €0.10/m
    // c has no listings at all
  }

  test('priceAsc sorts by real price-per-metre, cheapest first', () => {
    const sorted = sortStrings(sample, 'priceAsc', listingsByStringId)
    assert.equal(sorted[0].id, b.id)
    assert.equal(sorted[1].id, a.id)
  })
  test('a string with no retailer listings sorts after every string with a known price', () => {
    const sorted = sortStrings(sample, 'priceAsc', listingsByStringId)
    assert.equal(sorted[2].id, c.id)
  })
  test('priceDesc reverses the known-price ordering, unknown still sorts last', () => {
    const sorted = sortStrings(sample, 'priceDesc', listingsByStringId)
    assert.equal(sorted[0].id, a.id)
    assert.equal(sorted[1].id, b.id)
    assert.equal(sorted[2].id, c.id)
  })
  test('omitting listingsByStringId entirely never crashes and is a stable no-op ordering', () => {
    const sorted = sortStrings(sample, 'priceAsc')
    assert.equal(sorted.length, sample.length)
  })
  test('never falls back to the local stringCost field when no retailer price-per-metre exists', () => {
    // c has a stringCost in the local catalog (or not) but no retailer listing —
    // it must sort last regardless of what stringCost says.
    const sorted = sortStrings(sample, 'priceAsc', listingsByStringId)
    assert.equal(sorted[sorted.length - 1].id, c.id)
  })
  test('sorting is stable/deterministic across repeated calls', () => {
    const first = sortStrings(sample, 'priceAsc', listingsByStringId).map((s) => s.id)
    const second = sortStrings(sample, 'priceAsc', listingsByStringId).map((s) => s.id)
    assert.deepEqual(first, second)
  })
}

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
