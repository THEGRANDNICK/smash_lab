// Automated tests for Phase 11 — the read-only operational admin
// dashboard (services/adminDashboardService.ts, components/admin/DashboardPage.tsx,
// the Dashboard-as-default routing in AdminApp.tsx/App.tsx). Plain
// assertions via node:assert/strict, run directly with tsx, matching this
// project's existing script style.
//
// Run: npm run test:admin-dashboard
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual rendered dashboard
// DOM, the Refresh button's disabled/aria-busy state, keyboard-operable
// navigation between admin sections, and mobile layout — this repo has no
// DOM/component-testing library, so those were verified in a real browser
// instead. The pure aggregation logic behind every dashboard number (fully
// exported from adminDashboardService.ts specifically so it's testable
// without a live Supabase connection) is fully covered here, plus a real
// end-to-end call to fetchDashboardData() itself to prove the resilient
// full-failure path actually works when Supabase isn't configured (as in
// this sandbox).

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { buildComparisonRows } from '../src/logic/comparisonMetrics.js'
import { buildOverlayBarRows } from '../src/logic/comparisonOverlay.js'
import { formatRelativeTime, daysSince } from '../src/logic/relativeTime.js'
import {
  fetchDashboardData,
  buildSummary,
  buildInventoryAttention,
  attentionPriorityOf,
  buildCoverage,
  buildRetailerHealth,
  buildDataQuality,
  buildRecentUpdates,
  STALE_LISTING_DAYS,
  type DashboardSourceId,
} from '../src/services/adminDashboardService.js'
import type { AdminCatalogRow } from '../src/services/catalogAdminService.js'
import type { AdminInventoryRow } from '../src/services/adminInventoryService.js'
import type { AdminSpecialistRow } from '../src/services/specialistAdminService.js'
import type { AdminRetailerRow } from '../src/services/retailerAdminService.js'
import type { AdminRetailerListingRow } from '../src/services/retailerListingAdminService.js'
import { validateCatalogInput, emptyCatalogFormInput, type CatalogFormInput } from '../src/services/catalogAdminService.js'
import { validateSpecialistInput, emptySpecialistFormInput, type SpecialistFormInput } from '../src/services/specialistAdminService.js'
import { validateRetailerInput, emptyRetailerFormInput, type RetailerFormInput } from '../src/services/retailerAdminService.js'
import { validateRetailerListingInput, emptyRetailerListingFormInput, type RetailerListingFormInput } from '../src/services/retailerListingAdminService.js'
import { normalizeDecimalInput } from '../src/logic/decimalInput.js'
import { formatDisplayVersion, resolveEnvironmentLabel, buildVersionInfo } from '../src/logic/version.js'

let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

const NOW = new Date('2026-07-31T12:00:00.000Z')

function catalogRow(overrides: Partial<AdminCatalogRow> = {}): AdminCatalogRow {
  return {
    id: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    category: 'repulsion',
    gaugeMm: 0.68,
    repulsion: 8,
    durability: 7,
    hittingSound: 8,
    shockAbsorption: 7,
    control: 7,
    stringCostEur: 12,
    description: 'A well-loved all-rounder.',
    tensionMeta: null,
    popularityRank: null,
    productUrl: 'https://example.com/bg80',
    imageUrl: 'https://example.com/bg80.png',
    colors: ['White'],
    isHybrid: false,
    mainStringMeta: null,
    crossStringMeta: null,
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  }
}

function inventoryRow(overrides: Partial<AdminInventoryRow> = {}): AdminInventoryRow {
  return {
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    stockStatus: 'in-stock',
    quantity: 5,
    packageType: 'set',
    color: 'White',
    notes: null,
    updatedAt: '2026-07-20T09:00:00.000Z',
    isHybrid: false,
    ...overrides,
  }
}

function specialistRow(overrides: Partial<AdminSpecialistRow> = {}): AdminSpecialistRow {
  return {
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    hasProfile: true,
    feel: 'medium',
    experienceSource: 'personal',
    confidence: 'high',
    reviewer: null,
    subjectiveNotes: null,
    strengths: null,
    weaknesses: null,
    specialistTags: null,
    personalTensionMinKg: null,
    personalTensionMaxKg: null,
    dimensions: {},
    updatedAt: '2026-07-20T08:00:00.000Z',
    ...overrides,
  }
}

function retailerRow(overrides: Partial<AdminRetailerRow> = {}): AdminRetailerRow {
  return { id: 1, name: 'Badminton Shop', logoUrl: null, websiteUrl: null, country: 'DE', active: true, listingCount: 1, updatedAt: '2026-07-19T00:00:00.000Z', ...overrides }
}

function listingRow(overrides: Partial<AdminRetailerListingRow> = {}): AdminRetailerListingRow {
  return {
    id: 1,
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    retailerId: 1,
    retailerName: 'Badminton Shop',
    retailerLogoUrl: null,
    retailerActive: true,
    productUrl: 'https://example.com/p',
    price: 12.5,
    currency: 'EUR',
    availabilityStatus: 'in_stock',
    packageType: 'set',
    packageLengthM: null,
    isPreferred: false,
    notes: null,
    lastCheckedAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Recommendation / ranking / tension / comparison regression (fresh pin)
// ---------------------------------------------------------------------------

console.log('\n=== Recommendation, ranking, tension and comparison regression ===')

const SAMPLE_ANSWERS: QuizAnswers[] = [
  { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' },
  { level: 'beginner', priorities: ['comfort'], playStyles: ['balanced'], hittingFeel: 'softComfortable' },
  { level: 'tournament', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] },
  {},
]
const REC_FIXTURES = [
  { best: 'yonex-exbolt-63', pct: 92, cross: 'lining-no1', spec: 'yonex-bg80' },
  { best: 'yonex-skyarc', pct: 93, cross: undefined, spec: 'yonex-exbolt-65' },
  { best: 'yonex-aerobite', pct: 92, cross: 'lining-no1-boost', spec: 'yonex-nanogy-99' },
  { best: 'yonex-exbolt-63', pct: 82, cross: 'lining-no1-boost', spec: 'yonex-exbolt-68' },
]
const TENSION_FIXTURES = [
  { recommendedKg: 12, lowerKg: 11.5, higherKg: 12.5 },
  { recommendedKg: 9.5, lowerKg: 9, higherKg: 10 },
  { recommendedKg: 12, lowerKg: 11.5, higherKg: 12.5 },
  { recommendedKg: 11, lowerKg: 10.5, higherKg: 11.5 },
]
for (const [i, answers] of SAMPLE_ANSWERS.entries()) {
  await test(`quiz input #${i + 1}: recommendStrings output matches fixture (ranking/scoring unchanged)`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const fixture = REC_FIXTURES[i]
    assert.equal(rec.best.string.id, fixture.best)
    assert.equal(rec.best.matchPercent, fixture.pct)
    assert.equal(rec.crossBrandAlternative?.string.id, fixture.cross)
    assert.equal(rec.specialistChoice?.string.id, fixture.spec)
  })
  await test(`quiz input #${i + 1}: recommendTension output matches fixture (tension logic unchanged)`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const tension = recommendTension(answers, rec.best.string)
    const fixture = TENSION_FIXTURES[i]
    assert.equal(tension.recommendedKg, fixture.recommendedKg)
    assert.equal(tension.lowerKg, fixture.lowerKg)
    assert.equal(tension.higherKg, fixture.higherKg)
  })
}
await test('comparison rows and overlay bars still compute unchanged for a real catalog string (comparison unchanged)', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80') as StringItem
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  assert.equal(rows.length, 12)
  const overlay = buildOverlayBarRows([bg80, bg80])
  assert.equal(overlay.length, 5)
})

// ---------------------------------------------------------------------------
// 2. relativeTime helpers
// ---------------------------------------------------------------------------

console.log('\n=== formatRelativeTime / daysSince ===')

await test('just now for anything under a minute old', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 30_000).toISOString(), NOW), 'Just now')
})
await test('minutes ago', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW), '5 minutes ago')
})
await test('singular minute', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 60_000).toISOString(), NOW), '1 minute ago')
})
await test('hours ago', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), NOW), '3 hours ago')
})
await test('yesterday for exactly one day old', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 25 * 3_600_000).toISOString(), NOW), 'Yesterday')
})
await test('days ago under a week', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 5 * 86_400_000).toISOString(), NOW), '5 days ago')
})
await test('falls back to a formatted date beyond a week', () => {
  const result = formatRelativeTime(new Date(NOW.getTime() - 30 * 86_400_000).toISOString(), NOW)
  assert.ok(!/ago/.test(result))
})
await test('an invalid timestamp is returned unchanged rather than throwing', () => {
  assert.equal(formatRelativeTime('not-a-date', NOW), 'not-a-date')
})
await test('daysSince computes whole days and handles null/invalid gracefully', () => {
  assert.equal(daysSince(new Date(NOW.getTime() - 40 * 86_400_000).toISOString(), NOW), 40)
  assert.equal(daysSince(null, NOW), null)
  assert.equal(daysSince(undefined, NOW), null)
  assert.equal(daysSince('garbage', NOW), null)
})

// ---------------------------------------------------------------------------
// 3. Summary calculations
// ---------------------------------------------------------------------------

console.log('\n=== Summary calculations ===')

await test('catalog total is just the row count', () => {
  const summary = buildSummary([catalogRow({ id: 'a' }), catalogRow({ id: 'b' })], [], [], [], [], NOW)
  assert.equal(summary.catalog.total, 2)
})
await test('inventory status counts split correctly, including missing quantity', () => {
  const summary = buildSummary(
    [],
    [
      inventoryRow({ stringId: 'a', stockStatus: 'in-stock' }),
      inventoryRow({ stringId: 'b', stockStatus: 'low-stock' }),
      inventoryRow({ stringId: 'c', stockStatus: 'unavailable' }),
      inventoryRow({ stringId: 'd', stockStatus: 'in-stock', quantity: null }),
    ],
    [],
    [],
    [],
    NOW,
  )
  assert.equal(summary.inventory.total, 4)
  assert.equal(summary.inventory.inStock, 2)
  assert.equal(summary.inventory.lowStock, 1)
  assert.equal(summary.inventory.unavailable, 1)
  assert.equal(summary.inventory.missingQuantity, 1)
})
await test('specialist coverage percent is rounded and never divides by zero', () => {
  const withTwoOfThree = buildSummary(
    [],
    [],
    [specialistRow({ stringId: 'a', hasProfile: true }), specialistRow({ stringId: 'b', hasProfile: true }), specialistRow({ stringId: 'c', hasProfile: false })],
    [],
    [],
    NOW,
  )
  assert.equal(withTwoOfThree.specialists.withProfile, 2)
  assert.equal(withTwoOfThree.specialists.withoutProfile, 1)
  assert.equal(withTwoOfThree.specialists.coveragePercent, 67)

  const empty = buildSummary([], [], [], [], [], NOW)
  assert.equal(empty.specialists.coveragePercent, 0)
})
await test('active retailer count splits correctly', () => {
  const summary = buildSummary([], [], [], [retailerRow({ id: 1, active: true }), retailerRow({ id: 2, active: false })], [], NOW)
  assert.equal(summary.retailers.active, 1)
  assert.equal(summary.retailers.inactive, 1)
})
await test('retailer-listing totals: available, missing price, never checked, stale', () => {
  const summary = buildSummary(
    [],
    [],
    [],
    [],
    [
      listingRow({ id: 1, availabilityStatus: 'in_stock', price: 10, lastCheckedAt: NOW.toISOString() }),
      listingRow({ id: 2, availabilityStatus: 'out_of_stock', price: null, lastCheckedAt: null }),
      listingRow({ id: 3, availabilityStatus: 'in_stock', price: 5, lastCheckedAt: new Date(NOW.getTime() - (STALE_LISTING_DAYS + 5) * 86_400_000).toISOString() }),
    ],
    NOW,
  )
  assert.equal(summary.retailerListings.total, 3)
  assert.equal(summary.retailerListings.available, 2)
  assert.equal(summary.retailerListings.missingPrice, 1)
  assert.equal(summary.retailerListings.neverChecked, 1)
  assert.equal(summary.retailerListings.stale, 1)
})
await test('a listing checked exactly at the threshold is not yet stale (strictly greater-than)', () => {
  const summary = buildSummary(
    [],
    [],
    [],
    [],
    [listingRow({ id: 1, lastCheckedAt: new Date(NOW.getTime() - STALE_LISTING_DAYS * 86_400_000).toISOString() })],
    NOW,
  )
  assert.equal(summary.retailerListings.stale, 0)
})

// ---------------------------------------------------------------------------
// 4. Inventory attention: priority, ordering, limiting
// ---------------------------------------------------------------------------

console.log('\n=== Inventory attention priority ===')

await test('attentionPriorityOf ranks unavailable, then low-stock, then data-issue, then nothing', () => {
  assert.equal(attentionPriorityOf(inventoryRow({ stockStatus: 'unavailable' })), 'unavailable')
  assert.equal(attentionPriorityOf(inventoryRow({ stockStatus: 'low-stock' })), 'low-stock')
  assert.equal(attentionPriorityOf(inventoryRow({ stockStatus: 'in-stock', quantity: null })), 'data-issue')
  assert.equal(attentionPriorityOf(inventoryRow({ stockStatus: 'in-stock', packageType: 'unknown' })), 'data-issue')
  assert.equal(attentionPriorityOf(inventoryRow({ stockStatus: 'in-stock', quantity: 5, packageType: 'set' })), null)
})
await test('buildInventoryAttention sorts unavailable before low-stock before data-issue, then alphabetically', () => {
  const rows = [
    inventoryRow({ stringId: 'z', brand: 'Zeta', name: 'Z1', stockStatus: 'low-stock' }),
    inventoryRow({ stringId: 'a', brand: 'Alpha', name: 'A1', stockStatus: 'unavailable' }),
    inventoryRow({ stringId: 'm', brand: 'Mid', name: 'M1', stockStatus: 'in-stock', quantity: null }),
    inventoryRow({ stringId: 'b', brand: 'Beta', name: 'B1', stockStatus: 'unavailable' }),
  ]
  const { items } = buildInventoryAttention(rows)
  assert.deepEqual(
    items.map((i) => i.stringId),
    ['a', 'b', 'z', 'm'],
  )
  assert.deepEqual(
    items.map((i) => i.priority),
    ['unavailable', 'unavailable', 'low-stock', 'data-issue'],
  )
})
await test('a fully healthy in-stock row never appears in the attention list', () => {
  const { items, totalNeedingAttention } = buildInventoryAttention([inventoryRow({ stockStatus: 'in-stock', quantity: 5, packageType: 'set' })])
  assert.equal(items.length, 0)
  assert.equal(totalNeedingAttention, 0)
})
await test('the attention list is capped at 10 even when more rows need attention, and reports the true total', () => {
  const rows = Array.from({ length: 15 }, (_, i) => inventoryRow({ stringId: `s${i}`, brand: `Brand${i}`, name: `Name${i}`, stockStatus: 'unavailable' }))
  const { items, totalNeedingAttention } = buildInventoryAttention(rows)
  assert.equal(items.length, 10)
  assert.equal(totalNeedingAttention, 15)
})

// ---------------------------------------------------------------------------
// 5. Coverage metrics
// ---------------------------------------------------------------------------

console.log('\n=== Coverage metrics ===')

await test('coverage flags missing description, product URL, image URL, and shock absorption independently', () => {
  const catalog = [
    catalogRow({ id: 'a', description: null }),
    catalogRow({ id: 'b', productUrl: null }),
    catalogRow({ id: 'c', imageUrl: null }),
    catalogRow({ id: 'd', shockAbsorption: null }),
    catalogRow({ id: 'e' }),
  ]
  const coverage = buildCoverage(catalog, [])
  assert.equal(coverage.missingDescription, 1)
  assert.equal(coverage.missingProductUrl, 1)
  assert.equal(coverage.missingImageUrl, 1)
  assert.equal(coverage.missingShockAbsorption, 1)
})
await test('hybrid strings with neither structured side flagged; a hybrid with one side known is not', () => {
  const catalog = [
    catalogRow({ id: 'a', isHybrid: true, mainStringMeta: null, crossStringMeta: null }),
    catalogRow({ id: 'b', isHybrid: true, mainStringMeta: { color: 'White' }, crossStringMeta: null }),
    catalogRow({ id: 'c', isHybrid: false, mainStringMeta: null, crossStringMeta: null }),
  ]
  const coverage = buildCoverage(catalog, [])
  assert.equal(coverage.hybridMissingStructuredMeta, 1)
})
await test('specialist coverage percent in the coverage panel matches the summary panel (same underlying numbers)', () => {
  const specialists = [specialistRow({ stringId: 'a', hasProfile: true }), specialistRow({ stringId: 'b', hasProfile: false })]
  const coverage = buildCoverage([], specialists)
  assert.equal(coverage.specialistProfiles.present, 1)
  assert.equal(coverage.specialistProfiles.missing, 1)
  assert.equal(coverage.specialistProfiles.percent, 50)
})

// ---------------------------------------------------------------------------
// 6. Retailer health: reused diagnostics, stale threshold, inactive-with-listings
// ---------------------------------------------------------------------------

console.log('\n=== Retailer health ===')

await test('preferred-listing conflicts are detected across the FULL admin listing set (including inactive retailers)', () => {
  const listings = [
    listingRow({ id: 1, stringId: 'a', retailerId: 1, isPreferred: true }),
    listingRow({ id: 2, stringId: 'a', retailerId: 2, isPreferred: true, retailerActive: false }),
  ]
  const health = buildRetailerHealth([retailerRow({ id: 1, active: true }), retailerRow({ id: 2, active: false })], listings, NOW)
  assert.deepEqual(health.preferredConflictStringIds, ['a'])
})
await test('an inactive retailer with an existing listing is surfaced by name with its listing count', () => {
  const listings = [listingRow({ id: 1, stringId: 'a', retailerId: 2 }), listingRow({ id: 2, stringId: 'b', retailerId: 2 })]
  const health = buildRetailerHealth([retailerRow({ id: 1, active: true }), retailerRow({ id: 2, name: 'Old Shop', active: false })], listings, NOW)
  assert.equal(health.inactiveRetailersWithListings.length, 1)
  assert.equal(health.inactiveRetailersWithListings[0].retailerName, 'Old Shop')
  assert.equal(health.inactiveRetailersWithListings[0].listingCount, 2)
})
await test('an inactive retailer with zero listings is not flagged', () => {
  const health = buildRetailerHealth([retailerRow({ id: 1, active: false })], [], NOW)
  assert.equal(health.inactiveRetailersWithListings.length, 0)
})
await test('stale uses the same centralized STALE_LISTING_DAYS threshold as the summary counts', () => {
  const health = buildRetailerHealth([], [listingRow({ id: 1, lastCheckedAt: new Date(NOW.getTime() - (STALE_LISTING_DAYS + 1) * 86_400_000).toISOString() })], NOW)
  assert.equal(health.stale, 1)
})
await test('Phase 12: a priced listing with no package length is flagged missingPackageLength', () => {
  const health = buildRetailerHealth([], [listingRow({ id: 1, price: 12.5, packageLengthM: null })], NOW)
  assert.equal(health.missingPackageLength, 1)
})
await test('Phase 12: a listing with both price and package length is not flagged missingPackageLength', () => {
  const health = buildRetailerHealth([], [listingRow({ id: 1, price: 12.5, packageLengthM: 200 })], NOW)
  assert.equal(health.missingPackageLength, 0)
})
await test('Phase 12: an unpriced listing with no package length is NOT double-counted as missingPackageLength (it is already missingPrice)', () => {
  const health = buildRetailerHealth([], [listingRow({ id: 1, price: null, packageLengthM: null })], NOW)
  assert.equal(health.missingPrice, 1)
  assert.equal(health.missingPackageLength, 0)
})

// ---------------------------------------------------------------------------
// 7. Data quality issues
// ---------------------------------------------------------------------------

console.log('\n=== Data quality issues ===')

await test('a catalog string with no matching inventory row is flagged critical', () => {
  const catalog = [catalogRow({ id: 'a' }), catalogRow({ id: 'b' })]
  const inventory = [inventoryRow({ stringId: 'a' })]
  const coverage = buildCoverage(catalog, [])
  const health = buildRetailerHealth([], [], NOW)
  const issues = buildDataQuality(catalog, inventory, coverage, health)
  const missing = issues.find((i) => i.id === 'missing-inventory-row')
  assert.ok(missing)
  assert.equal(missing?.severity, 'critical')
  assert.equal(missing?.count, 1)
  assert.equal(missing?.section, 'catalog')
})
await test('an issue with a zero count is never included in the list', () => {
  const catalog = [catalogRow({ id: 'a' })]
  const inventory = [inventoryRow({ stringId: 'a', quantity: 5, packageType: 'set' })]
  const coverage = buildCoverage(catalog, [specialistRow({ stringId: 'a', hasProfile: true })])
  const health = buildRetailerHealth([], [], NOW)
  const issues = buildDataQuality(catalog, inventory, coverage, health)
  assert.equal(issues.length, 0)
})
await test('every generated issue points at a real admin section', () => {
  const catalog = [catalogRow({ id: 'a', description: null })]
  const inventory: AdminInventoryRow[] = []
  const coverage = buildCoverage(catalog, [])
  const health = buildRetailerHealth([], [], NOW)
  const issues = buildDataQuality(catalog, inventory, coverage, health)
  const validSections = ['dashboard', 'inventory', 'catalog', 'specialists', 'retailers', 'retailerListings']
  for (const issue of issues) assert.ok(validSections.includes(issue.section))
})

// ---------------------------------------------------------------------------
// 8. Recent updates: sorting, labels, limit, missing-timestamp handling
// ---------------------------------------------------------------------------

console.log('\n=== Recent updates ===')

await test('recent updates are sorted by updatedAt descending across all five sources', () => {
  const updates = buildRecentUpdates(
    [catalogRow({ id: 'a', updatedAt: '2026-07-01T00:00:00.000Z' })],
    [inventoryRow({ stringId: 'b', updatedAt: '2026-07-20T00:00:00.000Z' })],
    [specialistRow({ stringId: 'c', hasProfile: true, updatedAt: '2026-07-10T00:00:00.000Z' })],
    [retailerRow({ id: 1, updatedAt: '2026-07-25T00:00:00.000Z' })],
    [listingRow({ id: 1, updatedAt: '2026-07-05T00:00:00.000Z' })],
  )
  assert.deepEqual(
    updates.map((u) => u.sourceType),
    ['retailers', 'inventory', 'specialists', 'retailerListings', 'catalog'],
  )
})
await test('a specialist row with no profile (hasProfile false) is never treated as an update', () => {
  const updates = buildRecentUpdates([], [], [specialistRow({ stringId: 'a', hasProfile: false, updatedAt: null })], [], [])
  assert.equal(updates.length, 0)
})
await test('item type labels are human-readable and consistent', () => {
  const updates = buildRecentUpdates(
    [catalogRow({ id: 'a' })],
    [],
    [],
    [],
    [listingRow({ id: 1, brand: 'Yonex', name: 'BG80', retailerName: 'Badminton Shop' })],
  )
  const catalogUpdate = updates.find((u) => u.sourceType === 'catalog')!
  assert.equal(catalogUpdate.sourceLabel, 'Catalog')
  const listingUpdate = updates.find((u) => u.sourceType === 'retailerListings')!
  assert.equal(listingUpdate.sourceLabel, 'Retailer listing')
  assert.equal(listingUpdate.title, 'Yonex BG80')
  assert.equal(listingUpdate.secondary, 'at Badminton Shop')
})
await test('the recent-updates list is capped at 10 records', () => {
  const catalog = Array.from({ length: 20 }, (_, i) => catalogRow({ id: `s${i}`, updatedAt: new Date(NOW.getTime() - i * 60_000).toISOString() }))
  const updates = buildRecentUpdates(catalog, [], [], [], [])
  assert.equal(updates.length, 10)
})

// ---------------------------------------------------------------------------
// 9. Resilience: fetchDashboardData() itself, in an environment with no
//    Supabase configured (this sandbox) — proves the full-failure path
//    degrades gracefully rather than throwing.
// ---------------------------------------------------------------------------

console.log('\n=== fetchDashboardData resilience (no Supabase configured here) ===')

await test('fetchDashboardData never throws, even with no Supabase configuration at all', async () => {
  const result = await fetchDashboardData()
  assert.ok(Array.isArray(result.errors))
  assert.ok(result.errors.length > 0, 'expected every source to report an error without a configured Supabase client')
  const sources: DashboardSourceId[] = ['catalog', 'inventory', 'specialists', 'retailers', 'retailerListings']
  for (const s of sources) assert.ok(result.errors.some((e) => e.source === s))
})
await test('fetchDashboardData still returns a fully-shaped (if empty) DashboardData under total failure', async () => {
  const result = await fetchDashboardData()
  assert.equal(result.data.summary.catalog.total, 0)
  assert.deepEqual(result.data.inventoryAttention.items, [])
  assert.deepEqual(result.data.recentUpdates, [])
  assert.deepEqual(result.data.dataQuality, [])
})

// ---------------------------------------------------------------------------
// 10. Regression: CRUD validation, decimal-comma admin input, admin footer
// ---------------------------------------------------------------------------

console.log('\n=== CRUD validation regression (unaffected by the new dashboard) ===')

function validCatalogInput(overrides: Partial<CatalogFormInput> = {}): CatalogFormInput {
  return { ...emptyCatalogFormInput(), id: 'test-brand-name', brand: 'TestBrand', name: 'TestName', category: 'repulsion', repulsion: '10', durability: '8', hittingSound: '9', control: '7', ...overrides }
}
await test('catalog validation still accepts a valid input and a comma decimal rating', () => {
  const ctx = { isNew: true, existingIds: new Set<string>(), existingBrandNamePairs: new Set<string>() }
  const result = validateCatalogInput(validCatalogInput({ repulsion: '10,5' }), ctx)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.repulsion, 10.5)
})

function validSpecialistInput(overrides: Partial<SpecialistFormInput> = {}): SpecialistFormInput {
  return { ...emptySpecialistFormInput(), experienceSource: 'personal', confidence: 'high', ...overrides }
}
await test('specialist validation still accepts a valid input', () => {
  const result = validateSpecialistInput(validSpecialistInput())
  assert.equal(result.ok, true)
})

function validRetailerInput(overrides: Partial<RetailerFormInput> = {}): RetailerFormInput {
  return { ...emptyRetailerFormInput(), name: 'Some Retailer', ...overrides }
}
await test('retailer validation still accepts a valid input', () => {
  const result = validateRetailerInput(validRetailerInput(), { otherRetailers: [] })
  assert.equal(result.ok, true)
})

function validListingInput(overrides: Partial<RetailerListingFormInput> = {}): RetailerListingFormInput {
  return { ...emptyRetailerListingFormInput('yonex-bg80'), retailerId: '1', ...overrides }
}
await test('retailer-listing validation still accepts a valid input', () => {
  const result = validateRetailerListingInput(validListingInput(), {
    validStringIds: new Set(['yonex-bg80']),
    retailers: [{ id: 1, name: 'Shop', active: true }],
    otherRows: [],
  })
  assert.equal(result.ok, true)
})

await test('normalizeDecimalInput still parses comma decimals identically to periods', () => {
  assert.equal(Number(normalizeDecimalInput('10,5')), 10.5)
  assert.equal(Number(normalizeDecimalInput('10.5')), 10.5)
})

console.log('\n=== Admin footer regression ===')

await test('formatDisplayVersion drops a trailing ".0" prerelease build number', () => {
  assert.equal(formatDisplayVersion('0.9.0-beta.0'), 'v0.9.0-beta')
})
await test('resolveEnvironmentLabel maps Vite PROD correctly', () => {
  assert.equal(resolveEnvironmentLabel(true), 'Production')
  assert.equal(resolveEnvironmentLabel(false), 'Development')
})
await test('buildVersionInfo combines both into the footer-ready shape for the new 0.9.0-beta.0 version', () => {
  const info = buildVersionInfo('0.9.0-beta.0', true)
  assert.equal(info.display, 'v0.9.0-beta')
  assert.equal(info.environment, 'Production')
})

// ---------------------------------------------------------------------------
// 11. Real catalog smoke test
// ---------------------------------------------------------------------------

console.log('\n=== Real catalog smoke test ===')

await test('buildDataQuality and buildRecentUpdates never throw when fed shapes derived from the real local catalog', () => {
  const catalog: AdminCatalogRow[] = localCatalog.map((s) => ({
    id: s.id,
    brand: s.brand,
    name: s.name,
    category: s.category,
    gaugeMm: s.mainString?.gauge ?? null,
    repulsion: s.repulsion,
    durability: s.durability,
    hittingSound: s.hittingSound,
    shockAbsorption: s.shockAbsorption,
    control: s.control,
    stringCostEur: s.stringCost ?? null,
    description: s.notes ?? null,
    tensionMeta: null,
    popularityRank: s.popularityRank ?? null,
    productUrl: s.productUrl ?? null,
    imageUrl: null,
    colors: s.colors ?? null,
    isHybrid: Boolean(s.isHybrid),
    mainStringMeta: s.mainString ?? null,
    crossStringMeta: s.crossString ?? null,
    updatedAt: NOW.toISOString(),
  }))
  const inventory: AdminInventoryRow[] = localCatalog.map((s) => ({
    stringId: s.id,
    brand: s.brand,
    name: s.name,
    stockStatus: s.stock,
    quantity: s.setsAvailable ?? null,
    packageType: 'set',
    color: s.inventoryColor ?? null,
    notes: null,
    updatedAt: NOW.toISOString(),
    isHybrid: Boolean(s.isHybrid),
  }))
  const coverage = buildCoverage(catalog, [])
  const health = buildRetailerHealth([], [], NOW)
  assert.doesNotThrow(() => buildDataQuality(catalog, inventory, coverage, health))
  assert.doesNotThrow(() => buildRecentUpdates(catalog, inventory, [], [], []))
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
