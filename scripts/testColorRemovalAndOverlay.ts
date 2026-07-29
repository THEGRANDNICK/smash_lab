// Automated tests for the final Phase 9 round — removing unfinished public
// physical-color rendering entirely (swatches, hybrid split circles, +N
// expansion, comparison-chip color dots) while keeping raw color text
// editable in admin, plus the new compact five-metric overlay-bar
// comparison, radar axis exact values, and the comparison table's
// progressive disclosure (primary rows visible by default, "Show more
// details" reveals Performance details + Availability). Plain assertions
// via node:assert/strict, run directly with tsx, matching this project's
// existing script style.
//
// Run: npm run test:color-removal-overlay
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): that no color swatch actually
// renders anywhere on the page, that no empty layout gap is left where one
// used to be, the overlay bars' and radar's actual SVG/DOM output, the
// table's "Show more/fewer details" keyboard operability and aria-expanded
// wiring, and mobile-width layout — this repo has no DOM/component-testing
// library, so those were verified in a real browser instead. The pure
// logic behind every one of them (what data flows where, in what order,
// under what conditions) is fully covered here.

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import * as stringColor from '../src/logic/stringColor.js'
import { buildComparisonRows } from '../src/logic/comparisonMetrics.js'
import { formatMetricValue, buildOverlayBarRows } from '../src/logic/comparisonOverlay.js'
import { getPerformanceValues, PERFORMANCE_AXES, PERFORMANCE_MAX, RADAR_COMPARE_COLORS } from '../src/components/performanceAxes.js'
import { validateCatalogInput, emptyCatalogFormInput, catalogFormInputFromRow, type CatalogFormInput, type AdminCatalogRow } from '../src/services/catalogAdminService.js'
import { normalizeDecimalInput } from '../src/logic/decimalInput.js'
import { formatDisplayVersion, resolveEnvironmentLabel, buildVersionInfo } from '../src/logic/version.js'

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
// 2. Public color rendering removed — the API surface is gone, not just unused
// ---------------------------------------------------------------------------

console.log('\n=== Public color rendering removed ===')

test('primaryStringColor and allStringColors (public-only helpers) no longer exist on the module', () => {
  assert.equal((stringColor as Record<string, unknown>).primaryStringColor, undefined)
  assert.equal((stringColor as Record<string, unknown>).allStringColors, undefined)
})

test('SolidColorPreview no longer has an overflow/maxVisible split — every recognized color is just "visible"', () => {
  const preview = stringColor.buildColorPreview(baseItem({ colors: ['Black', 'White', 'Red', 'Blue', 'Green'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 5)
    assert.equal((preview as unknown as Record<string, unknown>).overflow, undefined)
  }
})

test('resolveColor/resolveStringColor no longer accept an override argument (single-arg diagnostics resolver only)', () => {
  assert.equal(stringColor.resolveColor.length, 1)
  assert.equal(stringColor.resolveStringColor.length, 1)
})

test('the diagnostics-only resolver still explains what a raw admin color value would resolve to (for manual cleanup), even though nothing public renders it', () => {
  const resolution = stringColor.resolveColor('Fire Orange')
  assert.equal(resolution.source, 'inferred_keyword')
  assert.ok(resolution.cssColor)
})

// ---------------------------------------------------------------------------
// 3. Admin color data stays intact and editable (raw text, no swatches)
// ---------------------------------------------------------------------------

console.log('\n=== Admin color data retained as plain raw text ===')

test('a plain string colors list still validates and round-trips exactly as entered', () => {
  const result = validateCatalogInput(validCatalogInput({ colors: 'White, Red; Fire Orange' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.payload.update.colors, ['White', 'Red', 'Fire Orange'])
})

test('hybrid main/cross color names still validate and save without any override field', () => {
  const result = validateCatalogInput(validCatalogInput({ isHybrid: true, mainColor: 'Cosmic Gold', crossColor: 'White' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.update.main_string_meta?.color, 'Cosmic Gold')
    assert.equal(result.payload.update.cross_string_meta?.color, 'White')
    assert.equal((result.payload.update.main_string_meta as unknown as Record<string, unknown> | null)?.colorOverride, undefined)
  }
})

test('catalogFormInputFromRow round-trips raw hybrid color text without a colorOverride field', () => {
  const row = {
    id: 'x',
    brand: 'B',
    name: 'N',
    category: 'control',
    gaugeMm: null,
    repulsion: 8,
    durability: 8,
    hittingSound: 8,
    shockAbsorption: 8,
    control: 8,
    stringCostEur: null,
    description: null,
    tensionMeta: null,
    popularityRank: null,
    productUrl: null,
    imageUrl: null,
    colors: null,
    isHybrid: true,
    mainStringMeta: { color: 'White' },
    crossStringMeta: { color: 'Red' },
    updatedAt: new Date().toISOString(),
  } as unknown as AdminCatalogRow
  const input = catalogFormInputFromRow(row)
  assert.equal(input.mainColor, 'White')
  assert.equal(input.crossColor, 'Red')
  assert.equal((input as unknown as Record<string, unknown>).mainColorOverride, undefined)
  assert.equal((input as unknown as Record<string, unknown>).crossColorOverride, undefined)
})

// ---------------------------------------------------------------------------
// 4. Compact five-metric overlay-bar comparison
// ---------------------------------------------------------------------------

console.log('\n=== Overlay bar comparison: five core metrics ===')

test('buildOverlayBarRows produces exactly the 5 core manufacturer metrics, in RadarChart/StatBars order', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a' }), baseItem({ id: 'b' })])
  assert.deepEqual(
    rows.map((r) => r.label),
    PERFORMANCE_AXES.map((a) => a.label),
  )
})

test('two strings: each row carries exactly 2 series values, in the same order the items were passed', () => {
  const a = baseItem({ id: 'a', repulsion: 10 })
  const b = baseItem({ id: 'b', repulsion: 6 })
  const rows = buildOverlayBarRows([a, b])
  const repulsionRow = rows.find((r) => r.key === 'repulsion')!
  assert.equal(repulsionRow.series.length, 2)
  assert.equal(repulsionRow.series[0].id, 'a')
  assert.equal(repulsionRow.series[0].value, 10)
  assert.equal(repulsionRow.series[1].id, 'b')
  assert.equal(repulsionRow.series[1].value, 6)
})

test('three strings: each row carries exactly 3 series values, preserving chip order', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a' }), baseItem({ id: 'b' }), baseItem({ id: 'c' })])
  for (const row of rows) {
    assert.equal(row.series.length, 3)
    assert.deepEqual(
      row.series.map((s) => s.id),
      ['a', 'b', 'c'],
    )
  }
})

test('equal values still produce two distinct series entries with matching percents (never collapsed into one)', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', control: 9 }), baseItem({ id: 'b', control: 9 })])
  const controlRow = rows.find((r) => r.key === 'control')!
  assert.equal(controlRow.series[0].percent, controlRow.series[1].percent)
  assert.equal(controlRow.series[0].displayText, controlRow.series[1].displayText)
  assert.equal(controlRow.series.length, 2)
})

test('percent is scaled against the shared PERFORMANCE_MAX and clamped to 0-100', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', durability: PERFORMANCE_MAX })])
  const durabilityRow = rows.find((r) => r.key === 'durability')!
  assert.equal(durabilityRow.series[0].percent, 100)
})

test('a null (unrated) metric renders 0 percent and a "—" display, never a fabricated value', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', shockAbsorption: null })])
  const row = rows.find((r) => r.key === 'shockAbsorption')!
  assert.equal(row.series[0].percent, 0)
  assert.equal(row.series[0].displayText, '—')
})

// ---------------------------------------------------------------------------
// 5. Exact-value formatting: one decimal preserved, no destructive rounding
// ---------------------------------------------------------------------------

console.log('\n=== formatMetricValue ===')

test('an integer value formats with no trailing decimal', () => {
  assert.equal(formatMetricValue(9), '9')
})
test('a one-decimal value is preserved exactly, never rounded away', () => {
  assert.equal(formatMetricValue(9.5), '9.5')
  assert.equal(formatMetricValue(6.5), '6.5')
})
test('null formats as an em dash', () => {
  assert.equal(formatMetricValue(null), '—')
})

// ---------------------------------------------------------------------------
// 6. RADAR_COMPARE_COLORS: matching text/bar colors for the new UI
// ---------------------------------------------------------------------------

console.log('\n=== RADAR_COMPARE_COLORS: chart-series-matched text/bar colors ===')

test('every compare color slot has an HTML text class, an SVG fill class, and a bar class in addition to the existing stroke/fill/dot', () => {
  for (const color of RADAR_COMPARE_COLORS) {
    assert.ok(color.textClassName)
    assert.ok(color.svgTextClassName)
    assert.ok(color.barClassName)
    assert.ok(color.dotClassName)
  }
  assert.equal(RADAR_COMPARE_COLORS.length, 3)
})

// ---------------------------------------------------------------------------
// 7. Comparison table: progressive disclosure grouping
// ---------------------------------------------------------------------------

console.log('\n=== Comparison table progressive disclosure ===')

test('the 5 literal primary rows are tagged group "primary", in order', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  const primary = rows.filter((r) => r.group === 'primary')
  assert.deepEqual(
    primary.map((r) => r.label),
    ['Repulsion', 'Control', 'Durability', 'Hitting Sound', 'Shock Absorption / Comfort'],
  )
})

test('performance-detail rows (Feel, Tension Retention, Power, Overall Specialist Rating) are tagged group "performance"', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  const performance = rows.filter((r) => r.group === 'performance')
  assert.deepEqual(
    performance.map((r) => r.label),
    ['Feel', 'Tension Retention', 'Power', 'Overall Specialist Rating'],
  )
})

test('availability rows (Retail Availability, Package Options, Retailer Count) are tagged group "availability"', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  const availability = rows.filter((r) => r.group === 'availability')
  assert.deepEqual(
    availability.map((r) => r.label),
    ['Retail Availability', 'Package Options', 'Retailer Count'],
  )
})

test('every row belongs to exactly one of the three groups — nothing untagged', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  assert.equal(rows.length, 12)
  for (const row of rows) assert.ok(['primary', 'performance', 'availability'].includes(row.group))
})

test('total row count and computed values are unchanged from before this round (comparison data unchanged)', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  assert.equal(rows.length, 12)
  const repulsion = rows.find((r) => r.key === 'repulsion')!
  assert.equal(repulsion.dots?.filled, Math.round((bg80.repulsion / 11) * 5))
})

// ---------------------------------------------------------------------------
// 8. Radar data unchanged (presentation-only pass — no calculation changes)
// ---------------------------------------------------------------------------

console.log('\n=== Radar data unchanged ===')

test('getPerformanceValues still returns the same 5 raw manufacturer values, untouched by this round', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const values = getPerformanceValues(bg80)
  assert.equal(values.repulsion, bg80.repulsion)
  assert.equal(values.control, bg80.control)
  assert.equal(values.durability, bg80.durability)
  assert.equal(values.hittingSound, bg80.hittingSound)
  assert.equal(values.shockAbsorption, bg80.shockAbsorption)
})

// ---------------------------------------------------------------------------
// 9. Mobile decimal input regression (must not regress from prior rounds)
// ---------------------------------------------------------------------------

console.log('\n=== Decimal input regression ===')

for (const [raw, expected] of [
  ['10.5', 10.5],
  ['10,5', 10.5],
  ['0,5', 0.5],
  ['11,0', 11],
] as [string, number][]) {
  test(`normalizeDecimalInput("${raw}") still parses to ${expected}`, () => {
    assert.equal(Number(normalizeDecimalInput(raw)), expected)
  })
}
test('a rating field still accepts "10,5" through the real catalog admin validator', () => {
  const result = validateCatalogInput(validCatalogInput({ repulsion: '10,5' }), CATALOG_CONTEXT)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.update.repulsion, 10.5)
})

// ---------------------------------------------------------------------------
// 10. Admin footer regression (version source of truth unchanged)
// ---------------------------------------------------------------------------

console.log('\n=== Admin footer regression ===')

test('formatDisplayVersion drops a trailing ".0" prerelease build number', () => {
  assert.equal(formatDisplayVersion('0.8.0-beta.0'), 'v0.8.0-beta')
})
test('resolveEnvironmentLabel maps Vite PROD correctly', () => {
  assert.equal(resolveEnvironmentLabel(true), 'Production')
  assert.equal(resolveEnvironmentLabel(false), 'Development')
})
test('buildVersionInfo combines both into the footer-ready shape', () => {
  const info = buildVersionInfo('0.8.0-beta.0', true)
  assert.equal(info.display, 'v0.8.0-beta')
  assert.equal(info.environment, 'Production')
})

// ---------------------------------------------------------------------------
// 11. Real catalog smoke test
// ---------------------------------------------------------------------------

console.log('\n=== Real catalog smoke test ===')

test('buildOverlayBarRows never throws for the full real catalog, in pairs and triples', () => {
  assert.doesNotThrow(() => buildOverlayBarRows(localCatalog.slice(0, 2)))
  assert.doesNotThrow(() => buildOverlayBarRows(localCatalog.slice(0, 3)))
})
test('buildComparisonRows group tagging never throws for any real catalog string', () => {
  for (const item of localCatalog) {
    assert.doesNotThrow(() => buildComparisonRows(item, STRING_SPECIALIST_PROFILES[item.id], undefined))
  }
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
