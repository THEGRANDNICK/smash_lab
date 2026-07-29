// Automated tests for the Phase 9 fix round — real Supabase testing
// surfaced gaps this suite pins down: multiple colors packed into the
// single inventory `color` field (comma/semicolon-safe parsing), hybrid
// strings (AeroBite, AeroBite Boost) whose split swatch never appeared
// publicly because it only ever looked at structured main/cross metadata
// (now falls back to a safe legacy "Main/Cross" combined value), new
// special color names (Cosmic Gold) and a legacy alias (Turquois ->
// Turquoise), the extended color diagnostics, and the mobile decimal
// comma/period normalization used by every admin numeric field.
//
// Plain assertions via node:assert/strict, run directly with tsx,
// matching this project's existing script style.
//
// Run: npm run test:color-inventory-fix
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual rendered swatch
// circles/split-circle beside the string name, keyboard-triggered
// expand/collapse, the admin color-entry warning banners, and the mobile
// numeric keypad's real on-device behavior — this repo has no
// DOM/component-testing library, so those were verified in a real
// browser instead. The pure logic behind every one of them is fully
// covered here.

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { mergeInventoryIntoCatalog, type InventoryMap } from '../src/services/inventoryService.js'
import { resolveStringColor, buildColorPreview, hybridColorSource, describeColorAlias } from '../src/logic/stringColor.js'
import { splitColorList, containsUnambiguousDelimiter, containsSlash, parseLegacyHybridPair } from '../src/logic/colorParsing.js'
import { summarizeColorDiagnostics } from '../src/logic/colorDiagnostics.js'
import { normalizeDecimalInput } from '../src/logic/decimalInput.js'
import { validateCatalogInput, emptyCatalogFormInput, type CatalogFormInput } from '../src/services/catalogAdminService.js'
import { validateSpecialistInput, emptySpecialistFormInput } from '../src/services/specialistAdminService.js'

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

function baseItem(overrides: Partial<StringItem> = {}): StringItem {
  return {
    id: 'synthetic',
    brand: 'Synthetic',
    name: 'Test String',
    category: 'control',
    repulsion: 8,
    durability: 8,
    hittingSound: 8,
    shockAbsorption: 8,
    control: 8,
    stock: 'in-stock',
    stringCost: 10,
    ...overrides,
  }
}

function validCatalogInput(overrides: Partial<CatalogFormInput> = {}): CatalogFormInput {
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
const CATALOG_CONTEXT = { isNew: true, existingIds: new Set<string>(), existingBrandNamePairs: new Set<string>() }

// ---------------------------------------------------------------------------
// 1. Recommendation / ranking / tension regression (fresh pin)
// ---------------------------------------------------------------------------

console.log('\n=== Recommendation, ranking and tension regression ===')

const SAMPLE_ANSWERS: QuizAnswers[] = [
  { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' },
  { level: 'beginner', priorities: ['comfort'], playStyles: ['balanced'], hittingFeel: 'softComfortable' },
  { level: 'tournament', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] },
  {},
]
const REC_FIXTURES = [
  { best: 'yonex-exbolt-63', pct: 91, cross: 'lining-no1-boost', spec: 'yonex-bg80' },
  { best: 'yonex-skyarc', pct: 93, cross: 'lining-no1-boost', spec: 'yonex-exbolt-65' },
  { best: 'yonex-aerobite', pct: 91, cross: 'lining-no1-boost', spec: 'yonex-nanogy-99' },
  { best: 'yonex-exbolt-63', pct: 82, cross: 'lining-no1-boost', spec: 'yonex-exbolt-68' },
]
const TENSION_FIXTURES = [
  { recommendedKg: 12, lowerKg: 11.5, higherKg: 12.5 },
  { recommendedKg: 9.5, lowerKg: 9, higherKg: 10 },
  { recommendedKg: 12, lowerKg: 11.5, higherKg: 12.5 },
  { recommendedKg: 11, lowerKg: 10.5, higherKg: 11.5 },
]

for (const [i, answers] of SAMPLE_ANSWERS.entries()) {
  test(`quiz input #${i + 1}: recommendStrings output matches fixture (ranking/scoring unchanged)`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const fixture = REC_FIXTURES[i]
    assert.equal(rec.best.string.id, fixture.best)
    assert.equal(rec.best.matchPercent, fixture.pct)
    assert.equal(rec.crossBrandAlternative?.string.id, fixture.cross)
    assert.equal(rec.specialistChoice?.string.id, fixture.spec)
  })

  test(`quiz input #${i + 1}: recommendTension output matches fixture (tension logic unchanged)`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const tension = recommendTension(answers, rec.best.string)
    const fixture = TENSION_FIXTURES[i]
    assert.equal(tension.recommendedKg, fixture.recommendedKg)
    assert.equal(tension.lowerKg, fixture.lowerKg)
    assert.equal(tension.higherKg, fixture.higherKg)
  })
}

// ---------------------------------------------------------------------------
// 2. Safe delimited-color parsing (logic/colorParsing.ts)
// ---------------------------------------------------------------------------

console.log('\n=== Safe delimited-color parsing ===')

test('splits on a comma', () => {
  assert.deepEqual(splitColorList('White, Red'), ['White', 'Red'])
})
test('splits on a semicolon', () => {
  assert.deepEqual(splitColorList('White; Red'), ['White', 'Red'])
})
test('splits on mixed comma and semicolon', () => {
  assert.deepEqual(splitColorList('White, Red; Black'), ['White', 'Red', 'Black'])
})
test('never splits on a bare slash', () => {
  assert.deepEqual(splitColorList('Black/Yellow'), ['Black/Yellow'])
})
test('preserves multi-word color names intact', () => {
  assert.deepEqual(splitColorList('Sky Blue, Neon Yellow'), ['Sky Blue', 'Neon Yellow'])
})
test('trims each piece and drops blanks', () => {
  assert.deepEqual(splitColorList(' White ,  , Red '), ['White', 'Red'])
})
test('containsUnambiguousDelimiter detects comma/semicolon, not slash', () => {
  assert.equal(containsUnambiguousDelimiter('White, Red'), true)
  assert.equal(containsUnambiguousDelimiter('White; Red'), true)
  assert.equal(containsUnambiguousDelimiter('White/Red'), false)
  assert.equal(containsUnambiguousDelimiter('White'), false)
})
test('containsSlash detects a bare slash', () => {
  assert.equal(containsSlash('Black/Yellow'), true)
  assert.equal(containsSlash('Black, Yellow'), false)
})
test('parseLegacyHybridPair reads an unambiguous "Main/Cross" pair', () => {
  assert.deepEqual(parseLegacyHybridPair('White/Red'), { main: 'White', cross: 'Red' })
  assert.deepEqual(parseLegacyHybridPair('Black/Yellow'), { main: 'Black', cross: 'Yellow' })
})
test('parseLegacyHybridPair trims each side', () => {
  assert.deepEqual(parseLegacyHybridPair(' White / Red '), { main: 'White', cross: 'Red' })
})
test('parseLegacyHybridPair rejects more than one slash', () => {
  assert.equal(parseLegacyHybridPair('White/Red/Blue'), undefined)
})
test('parseLegacyHybridPair rejects an empty side', () => {
  assert.equal(parseLegacyHybridPair('White/'), undefined)
  assert.equal(parseLegacyHybridPair('/Red'), undefined)
})
test('parseLegacyHybridPair rejects a side that looks like a list', () => {
  assert.equal(parseLegacyHybridPair('White, Pink/Red'), undefined)
})
test('parseLegacyHybridPair returns undefined for no slash at all', () => {
  assert.equal(parseLegacyHybridPair('White'), undefined)
  assert.equal(parseLegacyHybridPair(undefined), undefined)
})

// ---------------------------------------------------------------------------
// 3. Color mapping additions — Cosmic Gold, Sky Blue, and the Turquois alias
// ---------------------------------------------------------------------------

console.log('\n=== Special color mapping ===')

test('Cosmic Gold resolves to a swatch', () => {
  assert.ok(resolveStringColor('Cosmic Gold'))
  assert.ok(resolveStringColor('cosmic gold'))
})
test('Sky Blue resolves to a swatch', () => {
  assert.ok(resolveStringColor('Sky Blue'))
})
test('legacy misspelling "Turquois" resolves and displays as canonical "Turquoise"', () => {
  const swatch = resolveStringColor('Turquois')
  assert.ok(swatch)
  assert.equal(swatch!.label, 'Turquoise')
  assert.equal(swatch!.hex, resolveStringColor('Turquoise')!.hex)
})
test('the alias is case-insensitive and trimmed like any other color name', () => {
  assert.ok(resolveStringColor('  TURQUOIS  '))
})
test('describeColorAlias reports the alias hit for diagnostics without rewriting the raw value', () => {
  const described = describeColorAlias('Turquois')
  assert.deepEqual(described, { raw: 'Turquois', canonical: 'Turquoise' })
  assert.equal(describeColorAlias('Turquoise'), undefined, 'the canonical spelling itself is not an alias hit')
  assert.equal(describeColorAlias('Chartreuse'), undefined)
})
test('an unknown color still never invents a visual value', () => {
  assert.equal(resolveStringColor('Cosmic Metallic XYZ'), undefined)
})

// ---------------------------------------------------------------------------
// 4. Multiple inventory colors from the single free-text field
// ---------------------------------------------------------------------------

console.log('\n=== Multiple inventory colors (comma/semicolon-safe) ===')

test('a comma-separated inventory value renders as multiple swatches, inventory-first', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Red', colors: ['Black'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.deepEqual(
      preview.visible.map((s) => s.label),
      ['White', 'Red', 'Black'],
    )
  }
})
test('a semicolon-separated inventory value renders as multiple swatches', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White; Red' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.deepEqual(
      preview.visible.map((s) => s.label),
      ['White', 'Red'],
    )
  }
})
test('a bare-slash inventory value on a non-hybrid string does not silently split into two colors', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Black/Yellow' }))
  assert.equal(preview.kind, 'none', 'unrecognized as a single token — never guessed apart')
})
test('an unavailable inventory row excludes ALL of its multiple colors, falling back to catalog', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Red', colors: ['Black'], stock: 'unavailable' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.deepEqual(preview.visible.map((s) => s.label), ['Black'])
})
test('a low-stock row still counts its multiple inventory colors as available', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Red', stock: 'low-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible.length, 2)
})
test('inventory colors are never duplicated against catalog colors that resolve to the same hex', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Red', colors: ['red', 'Black'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    const labels = preview.visible.map((s) => s.label)
    assert.deepEqual(labels, ['White', 'Red', 'Black'])
  }
})
test('falls back to catalog colors alone when there is no inventoryColor at all', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Blue', 'Green'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.deepEqual(preview.visible.map((s) => s.label).sort(), ['Blue', 'Green'])
})
test('an unrecognized inventory token does not block the other recognized tokens in the same field', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Cosmic Metallic XYZ, Red' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.deepEqual(preview.visible.map((s) => s.label), ['White', 'Red'])
})
// ---------------------------------------------------------------------------
// 5. Hybrid color source priority (structured -> legacy fallback -> none)
// ---------------------------------------------------------------------------

console.log('\n=== Hybrid color source priority ===')

test('structured main+cross colors take priority and render a true split', () => {
  const item = baseItem({ isHybrid: true, mainString: { color: 'White' }, crossString: { color: 'Red' }, inventoryColor: 'Black/Yellow' })
  const source = hybridColorSource(item)
  assert.equal(source.kind, 'structured-both')
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'White')
    assert.equal(preview.cross.label, 'Red')
  }
})
test('one structured side known renders solid and is reported as structured-partial', () => {
  const item = baseItem({ isHybrid: true, mainString: { color: 'White' } })
  assert.equal(hybridColorSource(item).kind, 'structured-partial')
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible[0].label, 'White')
})
test('AeroBite-style real data: neither structured side set, but inventory color is "White/Red" — falls back to a legacy split', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White/Red' })
  assert.equal(hybridColorSource(item).kind, 'legacy-pair')
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'White')
    assert.equal(preview.cross.label, 'Red')
  }
})
test('AeroBite Boost-style real data: "Black/Yellow" also falls back to a legacy split', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'Black/Yellow' })
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'Black')
    assert.equal(preview.cross.label, 'Yellow')
  }
})
test('the legacy fallback is never used when the inventory row is out of stock', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White/Red', stock: 'unavailable' })
  assert.equal(hybridColorSource(item).kind, 'none')
  assert.equal(buildColorPreview(item).kind, 'none')
})
test('a legacy value with an unrecognized side does not produce a half-invented split', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White/Cosmic Metallic XYZ' })
  assert.equal(hybridColorSource(item).kind, 'none')
})
test('a hybrid with neither structured nor a parseable legacy value renders none', () => {
  const item = baseItem({ isHybrid: true })
  assert.equal(hybridColorSource(item).kind, 'none')
  assert.equal(buildColorPreview(item).kind, 'none')
})
test('a hybrid never falls back to its own top-level colors list, even as a legacy source', () => {
  const item = baseItem({ isHybrid: true, colors: ['White', 'Red'] })
  assert.equal(buildColorPreview(item).kind, 'none')
})

// ---------------------------------------------------------------------------
// 6. Extended color diagnostics
// ---------------------------------------------------------------------------

console.log('\n=== Extended color diagnostics ===')

test('flags inventory values containing a comma/semicolon', () => {
  const items = [baseItem({ id: 'a', inventoryColor: 'White, Red' }), baseItem({ id: 'b', inventoryColor: 'White' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.inventoryValuesWithDelimiters.length, 1)
  assert.match(summary.inventoryValuesWithDelimiters[0], /^a: /)
})
test('flags an ambiguous slash value on a non-hybrid string', () => {
  const items = [baseItem({ id: 'a', inventoryColor: 'Black/Yellow' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.ambiguousSlashValues.length, 1)
})
test('does NOT flag a hybrid slash value that resolves cleanly as a legacy pair', () => {
  const items = [baseItem({ id: 'a', isHybrid: true, inventoryColor: 'White/Red' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.ambiguousSlashValues.length, 0)
})
test('reports canonicalized aliases actually used, with the raw text preserved', () => {
  const items = [baseItem({ id: 'a', colors: ['Turquois'] })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.canonicalizedAliasesUsed.length, 1)
  assert.match(summary.canonicalizedAliasesUsed[0], /Turquois → Turquoise/)
})
test('counts strings with multiple available inventory colors', () => {
  const items = [baseItem({ id: 'a', inventoryColor: 'White, Red' }), baseItem({ id: 'b', inventoryColor: 'White' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.stringsWithMultipleAvailableInventoryColors, 1)
})
test('counts hybrids using structured colors vs. a legacy fallback separately', () => {
  const items = [
    baseItem({ id: 'a', isHybrid: true, mainString: { color: 'White' }, crossString: { color: 'Red' } }),
    baseItem({ id: 'b', isHybrid: true, inventoryColor: 'Black/Yellow' }),
    baseItem({ id: 'c', isHybrid: true }),
  ]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.hybridsUsingStructuredColors, 1)
  assert.equal(summary.hybridsUsingLegacyFallback, 1)
  assert.deepEqual(summary.hybridMissingColors, ['c'])
})
test('summarizeColorDiagnostics never throws on the real catalog', () => {
  assert.doesNotThrow(() => summarizeColorDiagnostics(localCatalog))
})

// ---------------------------------------------------------------------------
// 7. Real catalog smoke test — mergeInventoryIntoCatalog + buildColorPreview
// ---------------------------------------------------------------------------

console.log('\n=== Real catalog smoke test ===')

test('mergeInventoryIntoCatalog + buildColorPreview never throws for any real string, including AeroBite/AeroBite Boost with a legacy combined color', () => {
  const inventory: InventoryMap = {
    'yonex-aerobite': { stockStatus: 'in-stock', quantity: 5, packageType: 'set', color: 'White/Red' },
    'yonex-aerobite-boost': { stockStatus: 'in-stock', quantity: 2, packageType: 'set', color: 'Black/Yellow' },
  }
  const merged = mergeInventoryIntoCatalog(localCatalog, inventory)
  for (const item of merged) {
    assert.doesNotThrow(() => buildColorPreview(item))
  }
  const aeroBite = merged.find((s) => s.id === 'yonex-aerobite')!
  const preview = buildColorPreview(aeroBite)
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'White')
    assert.equal(preview.cross.label, 'Red')
  }
})

// ---------------------------------------------------------------------------
// 8. Catalog admin form — comma/semicolon color parsing, dedup
// ---------------------------------------------------------------------------

console.log('\n=== Catalog admin color field parsing ===')

test('the catalog Colors field accepts both commas and semicolons', () => {
  const result = validateCatalogInput(validCatalogInput({ colors: 'Yellow, Pink; White' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.payload.update.colors, ['Yellow', 'Pink', 'White'])
})
test('the catalog Colors field still deduplicates case-insensitively across both delimiters', () => {
  const result = validateCatalogInput(validCatalogInput({ colors: 'Yellow; yellow, YELLOW' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.payload.update.colors, ['Yellow'])
})
test('a bare slash in the Colors field is preserved as one entry, not split', () => {
  const result = validateCatalogInput(validCatalogInput({ colors: 'Black/Yellow' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.payload.update.colors, ['Black/Yellow'])
})

// ---------------------------------------------------------------------------
// 9. Mobile decimal input — comma/period normalization
// ---------------------------------------------------------------------------

console.log('\n=== Decimal input normalization ===')

const ACCEPT_CASES: [string, number][] = [
  ['5', 5],
  ['5.5', 5.5],
  ['5,5', 5.5],
  ['10', 10],
  ['10.5', 10.5],
  ['10,5', 10.5],
  ['0', 0],
  ['0.5', 0.5],
  ['0,5', 0.5],
  ['11', 11],
  ['11.0', 11],
  ['11,0', 11],
]
for (const [raw, expected] of ACCEPT_CASES) {
  test(`normalizeDecimalInput("${raw}") parses to ${expected}`, () => {
    assert.equal(Number(normalizeDecimalInput(raw)), expected)
  })
}

const REJECT_CASES = ['abc', '5..', '5,,', '5.5.5']
for (const raw of REJECT_CASES) {
  test(`normalizeDecimalInput("${raw}") still fails to parse as a number`, () => {
    assert.equal(Number.isFinite(Number(normalizeDecimalInput(raw))), false)
  })
}

test('normalizeDecimalInput never changes the numeric value itself, only the separator', () => {
  assert.equal(Number(normalizeDecimalInput('9,55')), 9.55)
})
test('normalizeDecimalInput trims surrounding whitespace', () => {
  assert.equal(Number(normalizeDecimalInput('  10,5  ')), 10.5)
})

console.log('\n=== Decimal input wired into real admin forms ===')

test('a rating field accepts "10,5" exactly like "10.5" (comma decimal on a 0-11 rating)', () => {
  const withComma = validateCatalogInput(validCatalogInput({ repulsion: '10,5' }), CATALOG_CONTEXT)
  const withPeriod = validateCatalogInput(validCatalogInput({ repulsion: '10.5' }), CATALOG_CONTEXT)
  assert.equal(withComma.ok, true)
  assert.equal(withPeriod.ok, true)
  if (withComma.ok && withPeriod.ok) assert.equal(withComma.payload.update.repulsion, withPeriod.payload.update.repulsion)
})
test('a rating field still rejects an out-of-range value after comma normalization (12 > 11)', () => {
  const result = validateCatalogInput(validCatalogInput({ repulsion: '12' }), CATALOG_CONTEXT)
  assert.equal(result.ok, false)
})
test('a rating field still rejects a negative value', () => {
  const result = validateCatalogInput(validCatalogInput({ repulsion: '-1' }), CATALOG_CONTEXT)
  assert.equal(result.ok, false)
})
test('the tension-adjustment field (allows negative) accepts a comma decimal', () => {
  const result = validateCatalogInput(validCatalogInput({ tensionAdjustment: '-0,25' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.tension_meta?.tensionAdjustment, -0.25)
})
test('string cost accepts a comma decimal', () => {
  const result = validateCatalogInput(validCatalogInput({ stringCost: '9,55' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.string_cost_eur, 9.55)
})
test('the specialist personal tension range accepts comma decimals on both bounds', () => {
  const result = validateSpecialistInput({
    ...emptySpecialistFormInput(),
    feel: '',
    experienceSource: 'personal',
    confidence: 'high',
    personalTensionMinKg: '10,5',
    personalTensionMaxKg: '11,5',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.personal_tension_min_kg, 10.5)
    assert.equal(result.update.personal_tension_max_kg, 11.5)
  }
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
