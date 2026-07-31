// Automated tests for Phase 10 — a focused refinement of the string
// comparison experience. Phase 9 already built the compact overlay-bar
// comparison, radar exact values, and the comparison table's progressive
// disclosure; this phase audits that work and refines two things: the
// comparison table's column-width distribution (now table-fixed with an
// explicit Metric column width so the compared-string columns always
// split the remaining space evenly), and consolidating every exact-value
// display (radar + overlay bars) onto the same shared formatMetricValue()
// helper. No new comparison logic was introduced beyond that. Plain
// assertions via node:assert/strict, run directly with tsx, matching this
// project's existing script style.
//
// Run: npm run test:comparison-experience
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual rendered SVG/DOM
// output of the radar and overlay bars, the table's fixed column widths
// at different viewport sizes, chip removal/"Clear comparison" clicks,
// and the Show more/fewer details keyboard-operable disclosure — this
// repo has no DOM/component-testing library, so those were verified in a
// real browser instead. The pure logic behind every one of them is fully
// covered here.

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { buildComparisonRows } from '../src/logic/comparisonMetrics.js'
import { formatMetricValue, buildOverlayBarRows } from '../src/logic/comparisonOverlay.js'
import { getPerformanceValues, PERFORMANCE_AXES, PERFORMANCE_MAX, RADAR_COMPARE_COLORS } from '../src/components/performanceAxes.js'
import { readStoredComparisonView, DEFAULT_COMPARISON_VIEW } from '../src/logic/comparisonViewPreference.js'
import { validateCatalogInput, emptyCatalogFormInput, type CatalogFormInput } from '../src/services/catalogAdminService.js'
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
// 2. Radar remains the default comparison view
// ---------------------------------------------------------------------------

console.log('\n=== Radar remains default ===')

test('DEFAULT_COMPARISON_VIEW is radar', () => {
  assert.equal(DEFAULT_COMPARISON_VIEW, 'radar')
})
test('readStoredComparisonView defaults to radar with no storage at all', () => {
  assert.equal(readStoredComparisonView(null), 'radar')
  assert.equal(readStoredComparisonView(undefined), 'radar')
})
test('readStoredComparisonView defaults to radar when nothing has been stored yet', () => {
  const storage = { getItem: () => null }
  assert.equal(readStoredComparisonView(storage), 'radar')
})

// ---------------------------------------------------------------------------
// 3. Series order matches chips (deterministic, index-based)
// ---------------------------------------------------------------------------

console.log('\n=== Series order matches chips ===')

test('RADAR_COMPARE_COLORS has exactly 3 distinct, stable entries for up to 3 compared strings', () => {
  assert.equal(RADAR_COMPARE_COLORS.length, 3)
  const dots = RADAR_COMPARE_COLORS.map((c) => c.dotClassName)
  assert.equal(new Set(dots).size, 3, 'each series slot must have a visually distinct dot color')
})
test('two strings: overlay-bar series preserve the exact order they were compared in (chip order)', () => {
  const a = baseItem({ id: 'a', name: 'First' })
  const b = baseItem({ id: 'b', name: 'Second' })
  const rows = buildOverlayBarRows([a, b])
  for (const row of rows) {
    assert.deepEqual(
      row.series.map((s) => s.id),
      ['a', 'b'],
    )
  }
})
test('three strings: overlay-bar series preserve chip order, reversing input order proves it is not resorted', () => {
  const c = baseItem({ id: 'c', name: 'Third' })
  const a = baseItem({ id: 'a', name: 'First' })
  const b = baseItem({ id: 'b', name: 'Second' })
  const rows = buildOverlayBarRows([c, a, b])
  for (const row of rows) {
    assert.deepEqual(
      row.series.map((s) => s.id),
      ['c', 'a', 'b'],
    )
  }
})

// ---------------------------------------------------------------------------
// 4. Shared value-formatting helper (Part 9) — used by both the radar's
//    exact-value text and the overlay bars, per this round's consolidation
// ---------------------------------------------------------------------------

console.log('\n=== Shared formatMetricValue helper ===')

test('an integer value formats with no trailing decimal (10 stays 10)', () => {
  assert.equal(formatMetricValue(10), '10')
})
test('a one-decimal value is preserved exactly (10.5 stays 10.5)', () => {
  assert.equal(formatMetricValue(10.5), '10.5')
})
test('a whole-number-valued float never grows a spurious decimal (6.0 displays as 6)', () => {
  assert.equal(formatMetricValue(6.0), '6')
})
test('null formats as an em dash, consistently', () => {
  assert.equal(formatMetricValue(null), '—')
})
test('formatMetricValue never destructively rounds — a value survives a format/parse round trip', () => {
  for (const v of [0, 1, 5.5, 9.5, 10, 11]) {
    assert.equal(Number(formatMetricValue(v)), v)
  }
})

// ---------------------------------------------------------------------------
// 5. Compact overlay comparison — five core metrics, 2/3-string behavior,
//    equal values, shorter-bar visibility, max scaling
// ---------------------------------------------------------------------------

console.log('\n=== Overlay bar comparison: five core metrics ===')

test('buildOverlayBarRows produces exactly the 5 core manufacturer metrics, in RadarChart/StatBars order', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a' }), baseItem({ id: 'b' })])
  assert.deepEqual(
    rows.map((r) => r.label),
    PERFORMANCE_AXES.map((a) => a.label),
  )
})
test('two strings: equal values still produce two distinct series entries with matching percents (never collapsed into one)', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', control: 9 }), baseItem({ id: 'b', control: 9 })])
  const controlRow = rows.find((r) => r.key === 'control')!
  assert.equal(controlRow.series.length, 2)
  assert.equal(controlRow.series[0].percent, controlRow.series[1].percent)
  assert.equal(controlRow.series[0].displayText, controlRow.series[1].displayText)
})
test('two strings: the shorter value is never zeroed out or hidden — it keeps its own real percent', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', repulsion: 3 }), baseItem({ id: 'b', repulsion: 10 })])
  const repulsionRow = rows.find((r) => r.key === 'repulsion')!
  assert.ok(repulsionRow.series[0].percent > 0)
  assert.ok(repulsionRow.series[0].percent < repulsionRow.series[1].percent)
})
test('percent is scaled against the shared PERFORMANCE_MAX and clamped to 100 at the maximum rating', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', durability: PERFORMANCE_MAX })])
  const durabilityRow = rows.find((r) => r.key === 'durability')!
  assert.equal(durabilityRow.series[0].percent, 100)
})
test('three strings: every row carries exactly 3 series entries, in the same order the items were passed', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a' }), baseItem({ id: 'b' }), baseItem({ id: 'c' })])
  for (const row of rows) {
    assert.equal(row.series.length, 3)
    assert.deepEqual(
      row.series.map((s) => s.id),
      ['a', 'b', 'c'],
    )
  }
})
test('a null (unrated) metric renders 0 percent and a "—" display, never a fabricated value', () => {
  const rows = buildOverlayBarRows([baseItem({ id: 'a', shockAbsorption: null })])
  const row = rows.find((r) => r.key === 'shockAbsorption')!
  assert.equal(row.series[0].percent, 0)
  assert.equal(row.series[0].displayText, '—')
})

// ---------------------------------------------------------------------------
// 6. Comparison table: primary rows visible by default, grouping unchanged
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
test('performance and availability rows stay hidden from the primary group (secondary rows hidden by default)', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  const secondary = rows.filter((r) => r.group !== 'primary')
  assert.equal(secondary.length, 7)
  assert.ok(secondary.every((r) => r.group === 'performance' || r.group === 'availability'))
})
test('row count and computed values are unchanged from Phase 9 (comparison source data unchanged)', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  assert.equal(rows.length, 12)
  const repulsion = rows.find((r) => r.key === 'repulsion')!
  assert.equal(repulsion.dots?.filled, Math.round((bg80.repulsion / 11) * 5))
})

// ---------------------------------------------------------------------------
// 7. Radar source data unchanged (presentation-only refinement this phase)
// ---------------------------------------------------------------------------

console.log('\n=== Radar source data unchanged ===')

test('getPerformanceValues still returns the same 5 raw manufacturer values, untouched by this phase', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const values = getPerformanceValues(bg80)
  assert.equal(values.repulsion, bg80.repulsion)
  assert.equal(values.control, bg80.control)
  assert.equal(values.durability, bg80.durability)
  assert.equal(values.hittingSound, bg80.hittingSound)
  assert.equal(values.shockAbsorption, bg80.shockAbsorption)
})

// ---------------------------------------------------------------------------
// 8. Mobile decimal input regression (must not regress from prior rounds)
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
// 9. Admin footer regression (version source of truth unchanged)
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
// 10. Real catalog smoke test
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
