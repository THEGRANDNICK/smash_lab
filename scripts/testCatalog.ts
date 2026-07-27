// Automated tests for Phase 4's catalog-loading architecture. Plain
// assertions via node:assert/strict, run directly with tsx — matching this
// project's existing script style (no test framework dependency added).
//
// Run: npm run test:catalog
//
// These are LOCAL/AUTOMATED tests only — they never touch a real Supabase
// project (no network calls at all). They verify:
//   1. Database-row -> StringItem mapping is lossless for real catalog data
//   2. Invalid rows are rejected with a clear reason, not silently accepted
//   3. Duplicate ids are detected
//   4. The live-vs-fallback completeness decision is correct
//   5. Canonical ordering is deterministic and matches strings.ts's own order
//   6. Inventory merge behavior (present/missing entries, no mutation of input)
//   7. Recommendation + tension outputs are IDENTICAL whether the pool comes
//      from strings.ts directly or from mapping synthetic DB rows built from
//      the exact same data — the actual regression guarantee this phase requires

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import type { Database } from '../src/types/database.js'
import { mapCatalogRow, detectDuplicateIds, isLiveCatalogComplete, sortByCanonicalOrder } from '../src/services/catalogService.js'
import { mergeInventoryIntoCatalog, findMissingInventoryIds, type InventoryMap } from '../src/services/inventoryService.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { toStringsRow } from './migrateInventory.js'

type StringsRow = Database['public']['Tables']['strings']['Row']

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

function toFullRow(item: StringItem): StringsRow {
  const insert = toStringsRow(item)
  return {
    id: insert.id,
    brand: insert.brand,
    name: insert.name,
    category: insert.category,
    gauge_mm: insert.gauge_mm ?? null,
    repulsion: insert.repulsion,
    durability: insert.durability,
    hitting_sound: insert.hitting_sound,
    shock_absorption: insert.shock_absorption ?? null,
    control: insert.control,
    string_cost_eur: insert.string_cost_eur ?? null,
    description: insert.description ?? null,
    tension_meta: insert.tension_meta ?? null,
    popularity_rank: insert.popularity_rank ?? null,
    product_url: insert.product_url ?? null,
    image_url: insert.image_url ?? null,
    colors: insert.colors ?? null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

/** The subset of StringItem that catalog rows actually determine — excludes stock/setsAvailable, which only ever come from the separate inventory merge step. */
function catalogRelevant(item: StringItem) {
  const { stock: _stock, setsAvailable: _setsAvailable, ...rest } = item
  return rest
}

console.log('=== 1. Database-row-to-application-model mapping (round-trip over all real catalog entries) ===')
test('every strings.ts entry round-trips through toStringsRow -> mapCatalogRow unchanged', () => {
  for (const item of localCatalog) {
    const row = toFullRow(item)
    const result = mapCatalogRow(row)
    assert.equal(result.ok, true, `mapping failed for ${item.id}: ${!result.ok ? result.reason : ''}`)
    if (result.ok) {
      assert.deepStrictEqual(catalogRelevant(result.item), catalogRelevant(item), `round-trip mismatch for ${item.id}`)
    }
  }
})

console.log('\n=== 2. Invalid row rejection ===')
const validRow = toFullRow(localCatalog[0])

test('rejects empty id', () => {
  const result = mapCatalogRow({ ...validRow, id: '' })
  assert.equal(result.ok, false)
})
test('rejects invalid category', () => {
  const result = mapCatalogRow({ ...validRow, category: 'nonsense' as never })
  assert.equal(result.ok, false)
})
test('rejects out-of-range rating (repulsion=50)', () => {
  const result = mapCatalogRow({ ...validRow, repulsion: 50 })
  assert.equal(result.ok, false)
})
test('rejects negative rating', () => {
  const result = mapCatalogRow({ ...validRow, control: -1 })
  assert.equal(result.ok, false)
})
test('rejects out-of-range nullable shock_absorption', () => {
  const result = mapCatalogRow({ ...validRow, shock_absorption: 99 })
  assert.equal(result.ok, false)
})
test('accepts null shock_absorption as unknown', () => {
  const result = mapCatalogRow({ ...validRow, shock_absorption: null })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.item.shockAbsorption, null)
})
test('rejects negative gauge_mm', () => {
  const result = mapCatalogRow({ ...validRow, gauge_mm: -0.1 })
  assert.equal(result.ok, false)
})
test('rejects negative string_cost_eur', () => {
  const result = mapCatalogRow({ ...validRow, string_cost_eur: -5 })
  assert.equal(result.ok, false)
})
test('rejects non-positive popularity_rank', () => {
  const result = mapCatalogRow({ ...validRow, popularity_rank: 0 })
  assert.equal(result.ok, false)
})
test('rejects non-string entries in colors', () => {
  const result = mapCatalogRow({ ...validRow, colors: [123 as unknown as string] })
  assert.equal(result.ok, false)
})
test('rejects javascript: scheme in product_url (XSS guard)', () => {
  const result = mapCatalogRow({ ...validRow, product_url: 'javascript:alert(1)' })
  assert.equal(result.ok, false)
})
test('rejects tension_meta.recommendedMin > recommendedMax', () => {
  const result = mapCatalogRow({ ...validRow, tension_meta: { recommendedMin: 12, recommendedMax: 9 } })
  assert.equal(result.ok, false)
})
test('does not silently coerce bad values — never accepts a corrupt row', () => {
  const result = mapCatalogRow({ ...validRow, repulsion: Number.NaN })
  assert.equal(result.ok, false)
})

console.log('\n=== 3. Duplicate ID detection ===')
test('detects a single duplicate id', () => {
  const dupes = detectDuplicateIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }])
  assert.deepStrictEqual(dupes, ['a'])
})
test('reports each duplicate id once even with 3+ occurrences', () => {
  const dupes = detectDuplicateIds([{ id: 'a' }, { id: 'a' }, { id: 'a' }])
  assert.deepStrictEqual(dupes, ['a'])
})
test('no duplicates in a clean list', () => {
  const dupes = detectDuplicateIds([{ id: 'a' }, { id: 'b' }])
  assert.deepStrictEqual(dupes, [])
})

console.log('\n=== 4. Catalog completeness / fallback decision ===')
test('complete when every local id is present (extras allowed)', () => {
  const local = new Set(['a', 'b'])
  const accepted = new Set(['a', 'b', 'c'])
  assert.equal(isLiveCatalogComplete(local, accepted), true)
})
test('incomplete when a local id is missing', () => {
  const local = new Set(['a', 'b'])
  const accepted = new Set(['a'])
  assert.equal(isLiveCatalogComplete(local, accepted), false)
})
test('incomplete when live returns nothing', () => {
  const local = new Set(['a'])
  const accepted = new Set<string>()
  assert.equal(isLiveCatalogComplete(local, accepted), false)
})

console.log('\n=== 5. Deterministic ordering ===')
test('sortByCanonicalOrder reproduces strings.ts order exactly when given the same set, shuffled', () => {
  const shuffled = [...localCatalog].reverse()
  const resorted = sortByCanonicalOrder(shuffled)
  assert.deepStrictEqual(
    resorted.map((i) => i.id),
    localCatalog.map((i) => i.id),
  )
})
test('an unknown id sorts after every known id, deterministically', () => {
  const extra: StringItem = { ...localCatalog[0], id: 'zzz-unknown-string', brand: 'ZBrand', name: 'Unknown' }
  const withExtra = sortByCanonicalOrder([extra, ...localCatalog])
  assert.equal(withExtra[withExtra.length - 1].id, 'zzz-unknown-string')
})
test('ordering is stable across repeated calls (idempotent)', () => {
  const once = sortByCanonicalOrder(localCatalog).map((i) => i.id)
  const twice = sortByCanonicalOrder(sortByCanonicalOrder(localCatalog)).map((i) => i.id)
  assert.deepStrictEqual(once, twice)
})

console.log('\n=== 6. Inventory merge behavior ===')
test('present inventory entry overrides stock and quantity', () => {
  const catalog: StringItem[] = [{ ...localCatalog[0], stock: 'unavailable', setsAvailable: undefined }]
  const inventory: InventoryMap = { [catalog[0].id]: { stockStatus: 'in-stock', quantity: 7, packageType: 'reel' } }
  const merged = mergeInventoryIntoCatalog(catalog, inventory)
  assert.equal(merged[0].stock, 'in-stock')
  assert.equal(merged[0].setsAvailable, 7)
})
test('missing inventory entry keeps the catalog item\'s own existing stock', () => {
  const catalog: StringItem[] = [{ ...localCatalog[0], stock: 'low-stock', setsAvailable: 2 }]
  const merged = mergeInventoryIntoCatalog(catalog, {})
  assert.equal(merged[0].stock, 'low-stock')
  assert.equal(merged[0].setsAvailable, 2)
})
test('merge never changes the number of items or introduces duplicates', () => {
  const inventory: InventoryMap = {}
  const merged = mergeInventoryIntoCatalog(localCatalog, inventory)
  assert.equal(merged.length, localCatalog.length)
  assert.equal(new Set(merged.map((i) => i.id)).size, localCatalog.length)
})
test('findMissingInventoryIds reports catalog ids absent from the inventory map', () => {
  const catalog: StringItem[] = [localCatalog[0], localCatalog[1]]
  const inventory: InventoryMap = { [catalog[0].id]: { stockStatus: 'in-stock', quantity: 1, packageType: 'reel' } }
  const missing = findMissingInventoryIds(catalog, inventory)
  assert.deepStrictEqual(missing, [catalog[1].id])
})

console.log('\n=== 7. Recommendation equivalence: local strings.ts pool vs. mapped-from-DB-row pool ===')
const mappedPool: StringItem[] = localCatalog.map((item) => {
  const result = mapCatalogRow(toFullRow(item))
  assert.equal(result.ok, true)
  // Real stock must be present for a meaningful comparison — mapCatalogRow's
  // placeholder is intentionally not real stock, so reattach it exactly as
  // the real merge step would (mergeInventoryIntoCatalog would do the same
  // by string_id, but reattaching directly here keeps this test dependency-free).
  return result.ok ? { ...result.item, stock: item.stock, setsAvailable: item.setsAvailable } : item
})

const SAMPLE_ANSWERS: QuizAnswers[] = [
  { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' },
  { level: 'beginner', priorities: ['comfort'], playStyles: ['balanced'], hittingFeel: 'softComfortable' },
  { level: 'tournament', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] },
  {},
]

for (const [i, answers] of SAMPLE_ANSWERS.entries()) {
  test(`quiz input #${i + 1}: identical Best Match / Best Available / Cross-Brand / Specialist Choice`, () => {
    const fromLocal = recommendStrings(answers, localCatalog)
    const fromMapped = recommendStrings(answers, mappedPool)

    assert.equal(fromMapped.best.string.id, fromLocal.best.string.id, 'Best Match id differs')
    assert.equal(fromMapped.best.matchPercent, fromLocal.best.matchPercent, 'Best Match percent differs')
    assert.equal(fromMapped.bestAvailable?.string.id, fromLocal.bestAvailable?.string.id, 'Best Available Alternative differs')
    assert.equal(fromMapped.crossBrandAlternative?.string.id, fromLocal.crossBrandAlternative?.string.id, 'Cross-Brand Alternative differs')
    assert.equal(fromMapped.specialistChoice?.string.id, fromLocal.specialistChoice?.string.id, 'Specialist Choice differs')
    assert.equal(fromMapped.explanations.best, fromLocal.explanations.best, 'Best Match explanation text differs')

    const tensionLocal = recommendTension(answers, fromLocal.best.string)
    const tensionMapped = recommendTension(answers, fromMapped.best.string)
    assert.deepStrictEqual(tensionMapped, tensionLocal, 'Tension recommendation differs')
  })
}

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
