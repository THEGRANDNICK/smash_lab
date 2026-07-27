// Automated tests for Phase 5's catalog administration (create/edit/delete
// validation and mapping). Plain assertions via node:assert/strict, run
// directly with tsx — matching scripts/testCatalog.ts's style. No network
// calls: these test the pure validation/mapping logic only. The actual
// Supabase CRUD calls (createString/updateString/deleteString) require a
// real or local Postgres+PostgREST instance and were verified separately
// through manual/integration testing — see the Phase 5 report.
//
// Run: npm run test:catalog-admin

import assert from 'node:assert/strict'
import {
  validateCatalogInput,
  emptyCatalogFormInput,
  suggestCatalogId,
  catalogFormInputFromRow,
  type AdminCatalogRow,
  type CatalogFormInput,
} from '../src/services/catalogAdminService.js'

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

function validInput(overrides: Partial<CatalogFormInput> = {}): CatalogFormInput {
  return {
    ...emptyCatalogFormInput(),
    id: 'test-brand-name',
    brand: 'TestBrand',
    name: 'TestName',
    category: 'repulsion',
    repulsion: '10',
    durability: '8',
    hittingSound: '9',
    control: '7',
    ...overrides,
  }
}

const EMPTY_CONTEXT = { isNew: true, existingIds: new Set<string>(), existingBrandNamePairs: new Set<string>() }

console.log('=== suggestCatalogId ===')
test('slugifies brand + name', () => {
  assert.equal(suggestCatalogId('Yonex', 'BG 80 Power'), 'yonex-bg-80-power')
})
test('handles punctuation and mixed case', () => {
  assert.equal(suggestCatalogId('Li-Ning', "No.1 Boost!"), 'li-ning-no-1-boost')
})

console.log('\n=== Required-field validation ===')
test('rejects a completely empty input with a distinct error per required field', () => {
  const result = validateCatalogInput(emptyCatalogFormInput(), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) {
    for (const field of ['id', 'brand', 'name', 'category', 'repulsion', 'durability', 'hittingSound', 'control'] as const) {
      assert.ok(result.errors[field], `expected an error for ${field}`)
    }
  }
})
test('accepts a fully valid input and produces both insert and update payloads', () => {
  const result = validateCatalogInput(validInput(), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.ok(result.payload.insert)
    assert.equal(result.payload.insert?.id, 'test-brand-name')
    assert.equal(result.payload.update.brand, 'TestBrand')
    assert.equal(result.payload.update.repulsion, 10)
  }
})
test('edit mode does not require or validate an id', () => {
  const result = validateCatalogInput(validInput({ id: '' }), { isNew: false, existingIds: new Set(), existingBrandNamePairs: new Set() })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.insert, undefined)
})

console.log('\n=== Duplicate detection ===')
test('rejects a duplicate id on create', () => {
  const result = validateCatalogInput(validInput(), { isNew: true, existingIds: new Set(['test-brand-name']), existingBrandNamePairs: new Set() })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.errors.id ?? '', /already in use/)
})
test('rejects an id with invalid characters', () => {
  const result = validateCatalogInput(validInput({ id: 'Not A Valid ID!' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.id)
})
test('duplicate brand/name is a non-blocking warning, not an error (schema allows legitimate variants)', () => {
  const result = validateCatalogInput(validInput(), { isNew: true, existingIds: new Set(), existingBrandNamePairs: new Set(['testbrand|testname']) })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.warnings.length, 1)
    assert.match(result.warnings[0], /already uses/)
  }
})
test('brand/name comparison is case-insensitive', () => {
  const result = validateCatalogInput(validInput({ brand: 'TESTBRAND', name: 'testname' }), { isNew: true, existingIds: new Set(), existingBrandNamePairs: new Set(['testbrand|testname']) })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.warnings.length, 1)
})

console.log('\n=== Numeric field validation ===')
test('rejects an out-of-range rating', () => {
  const result = validateCatalogInput(validInput({ repulsion: '50' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.repulsion)
})
test('rejects a negative rating', () => {
  const result = validateCatalogInput(validInput({ control: '-1' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.control)
})
test('accepts a blank shock absorption as null (unknown)', () => {
  const result = validateCatalogInput(validInput({ shockAbsorption: '' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.shock_absorption, null)
})
test('rejects a negative gauge', () => {
  const result = validateCatalogInput(validInput({ gauge: '-0.5' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.gauge)
})
test('rejects a negative string cost', () => {
  const result = validateCatalogInput(validInput({ stringCost: '-5' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.stringCost)
})
test('rejects a non-positive popularity rank', () => {
  const result = validateCatalogInput(validInput({ popularityRank: '0' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.popularityRank)
})
test('rejects a non-integer popularity rank', () => {
  const result = validateCatalogInput(validInput({ popularityRank: '1.5' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.popularityRank)
})
test('accepts a negative tension adjustment (a +/- nudge, unlike the other numeric fields)', () => {
  const result = validateCatalogInput(validInput({ tensionAdjustment: '-0.25' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.tension_meta?.tensionAdjustment, -0.25)
})
test('rejects recommendedMin greater than recommendedMax', () => {
  const result = validateCatalogInput(validInput({ recommendedMin: '12', recommendedMax: '9' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.recommendedMax)
})

console.log('\n=== URL validation (XSS guard) ===')
test('rejects a javascript: scheme product URL', () => {
  const result = validateCatalogInput(validInput({ productUrl: 'javascript:alert(1)' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.productUrl)
})
test('rejects a javascript: scheme image URL', () => {
  const result = validateCatalogInput(validInput({ imageUrl: 'javascript:alert(1)' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.imageUrl)
})
test('accepts a valid https URL', () => {
  const result = validateCatalogInput(validInput({ productUrl: 'https://example.com/product' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.product_url, 'https://example.com/product')
})
test('rejects a malformed URL missing a scheme', () => {
  const result = validateCatalogInput(validInput({ imageUrl: 'example.com/image.png' }), EMPTY_CONTEXT)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.imageUrl)
})

console.log('\n=== Text handling ===')
test('trims brand/name/description', () => {
  const result = validateCatalogInput(validInput({ brand: '  TestBrand  ', name: '  TestName  ', description: '  hello  ' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.update.brand, 'TestBrand')
    assert.equal(result.payload.update.name, 'TestName')
    assert.equal(result.payload.update.description, 'hello')
  }
})
test('blank description becomes null, not an empty string', () => {
  const result = validateCatalogInput(validInput({ description: '   ' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.description, null)
})
test('parses a comma-separated colors field into a trimmed array', () => {
  const result = validateCatalogInput(validInput({ colors: ' Yellow, Pink ,White ' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepStrictEqual(result.payload.update.colors, ['Yellow', 'Pink', 'White'])
})
test('blank colors becomes null, not an empty array', () => {
  const result = validateCatalogInput(validInput({ colors: '' }), EMPTY_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.colors, null)
})

console.log('\n=== Row -> form input round-trip (used to populate the edit form) ===')
test('catalogFormInputFromRow round-trips through validateCatalogInput back to the same payload values', () => {
  const row: AdminCatalogRow = {
    id: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    category: 'repulsion',
    gaugeMm: 0.68,
    repulsion: 8,
    durability: 6,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 6,
    stringCostEur: 5.75,
    description: 'A performance string.',
    tensionMeta: { tensionAdjustment: -0.1, recommendedMin: 9, recommendedMax: 12, tensionNotes: 'Notes here' },
    popularityRank: 1,
    productUrl: 'https://www.yonex.com/bg80',
    imageUrl: null,
    colors: ['Yellow', 'White'],
    updatedAt: '2026-01-01T00:00:00Z',
  }
  const formInput = catalogFormInputFromRow(row)
  const result = validateCatalogInput(formInput, { isNew: false, existingIds: new Set(), existingBrandNamePairs: new Set() })
  assert.equal(result.ok, true)
  if (result.ok) {
    const u = result.payload.update
    assert.equal(u.brand, row.brand)
    assert.equal(u.name, row.name)
    assert.equal(u.category, row.category)
    assert.equal(u.gauge_mm, row.gaugeMm)
    assert.equal(u.repulsion, row.repulsion)
    assert.equal(u.shock_absorption, row.shockAbsorption)
    assert.equal(u.string_cost_eur, row.stringCostEur)
    assert.equal(u.description, row.description)
    assert.deepStrictEqual(u.tension_meta, row.tensionMeta)
    assert.equal(u.popularity_rank, row.popularityRank)
    assert.equal(u.product_url, row.productUrl)
    assert.equal(u.image_url, row.imageUrl)
    assert.deepStrictEqual(u.colors, row.colors)
  }
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
