// Automated tests for the Phase 8 polish revision — string-color swatch
// data, comparison-view session persistence, description-clamp behavior,
// and a fresh regression pin proving recommendation/tension/ranking output
// is unaffected by this purely visual pass. Plain assertions via
// node:assert/strict, run directly with tsx, matching this project's
// existing script style.
//
// Run: npm run test:ui-polish
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual visual rendering of
// swatches/hero/comparison-panel, and the accessible aria-pressed state of
// the Radar/Table switch — those were verified in a real browser, not
// simulated here, since this repo has no DOM/component-testing library.

import assert from 'node:assert/strict'
import { strings as localCatalog } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { resolveStringColor } from '../src/logic/stringColor.js'
import { needsClamp, DEFAULT_CLAMP_THRESHOLD } from '../src/logic/textClamp.js'
import {
  readStoredComparisonView,
  writeStoredComparisonView,
  isComparisonView,
  DEFAULT_COMPARISON_VIEW,
  COMPARISON_VIEW_STORAGE_KEY,
} from '../src/logic/comparisonViewPreference.js'
import { buildComparisonRows } from '../src/logic/comparisonMetrics.js'

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

// ---------------------------------------------------------------------------
// 1. Recommendation / ranking / tension regression — this is a UI-only
//    polish pass; recommendationEngine.ts and tensionRecommendation.ts were
//    not touched. Fixture values captured directly from both before this
//    revision's component changes.
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
    assert.equal(tension.wasCappedByRacketMax, false)
  })
}

test('buildComparisonRows metrics are unchanged by this revision (same fixture as Phase 8 base)', () => {
  const bg80 = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const rows = buildComparisonRows(bg80, STRING_SPECIALIST_PROFILES['yonex-bg80'], undefined)
  assert.equal(rows.length, 12)
  assert.equal(rows[0].label, 'Repulsion')
  assert.equal(rows[0].dots?.filled, Math.round((bg80.repulsion / 11) * 5))
})

// ---------------------------------------------------------------------------
// 2. String color data source: StringItem.colors (see data/strings.ts) —
//    deterministic mapping, missing-color behavior, white/black borders.
// ---------------------------------------------------------------------------

console.log('\n=== String color swatch data ===')

test('resolveStringColor maps a known name case-insensitively', () => {
  const a = resolveStringColor('Yellow')
  const b = resolveStringColor('yellow')
  const c = resolveStringColor('  YELLOW  ')
  assert.ok(a && b && c)
  assert.equal(a!.hex, b!.hex)
  assert.equal(b!.hex, c!.hex)
})

test('resolveStringColor is deterministic', () => {
  assert.deepEqual(resolveStringColor('Neon Yellow'), resolveStringColor('Neon Yellow'))
})

test('resolveStringColor returns undefined for an unrecognized name rather than a placeholder', () => {
  assert.equal(resolveStringColor('Chartreuse Sparkle'), undefined)
})

test('resolveStringColor returns undefined for missing/blank input', () => {
  assert.equal(resolveStringColor(undefined), undefined)
  assert.equal(resolveStringColor(null), undefined)
})

test('white and black swatches use the "strong" ring class for border visibility', () => {
  const white = resolveStringColor('White')
  const black = resolveStringColor('Black')
  assert.ok(white!.ringClassName.includes('ring-black/30'))
  assert.ok(black!.ringClassName.includes('ring-black/30'))
  assert.ok(white!.ringClassName.includes('dark:ring-white/50'))
  assert.ok(black!.ringClassName.includes('dark:ring-white/50'))
})

test('a mid-tone color (e.g. red) still gets a subtle but visible ring', () => {
  const red = resolveStringColor('red')
  assert.ok(red!.ringClassName.length > 0)
})

test('resolveStringColor title-cases multi-word names for display', () => {
  const neon = resolveStringColor('neon yellow')
  assert.equal(neon!.label, 'Neon Yellow')
})

test('every known color name in the brief resolves to a swatch', () => {
  const names = ['yellow', 'white', 'black', 'red', 'blue', 'green', 'orange', 'pink', 'purple', 'silver', 'grey', 'gray', 'natural', 'neon yellow', 'turquoise', 'lime']
  for (const name of names) {
    assert.ok(resolveStringColor(name), `expected "${name}" to resolve to a swatch`)
  }
})

test('real catalog data: every populated StringItem.colors entry either resolves or is deliberately omitted, never throws', () => {
  for (const item of localCatalog) {
    if (item.colors && item.colors.length > 0) {
      assert.doesNotThrow(() => item.colors!.map((c) => resolveStringColor(c)))
    }
  }
})

// ---------------------------------------------------------------------------
// 3. Comparison view preference (Radar-first default, session persistence)
// ---------------------------------------------------------------------------

console.log('\n=== Comparison view preference (Radar-first, session persistence) ===')

class FakeStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private store = new Map<string, string>()
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

class ThrowingStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  getItem(): string {
    throw new Error('storage access denied')
  }
  setItem(): void {
    throw new Error('storage access denied')
  }
}

test('DEFAULT_COMPARISON_VIEW is radar, per the polish brief', () => {
  assert.equal(DEFAULT_COMPARISON_VIEW, 'radar')
})

test('readStoredComparisonView defaults to radar with no storage at all', () => {
  assert.equal(readStoredComparisonView(null), 'radar')
  assert.equal(readStoredComparisonView(undefined), 'radar')
})

test('readStoredComparisonView defaults to radar with empty storage', () => {
  assert.equal(readStoredComparisonView(new FakeStorage()), 'radar')
})

test('writeStoredComparisonView then readStoredComparisonView round-trips "table"', () => {
  const storage = new FakeStorage()
  writeStoredComparisonView(storage, 'table')
  assert.equal(readStoredComparisonView(storage), 'table')
})

test('switching back from table to radar persists correctly', () => {
  const storage = new FakeStorage()
  writeStoredComparisonView(storage, 'table')
  assert.equal(readStoredComparisonView(storage), 'table')
  writeStoredComparisonView(storage, 'radar')
  assert.equal(readStoredComparisonView(storage), 'radar')
})

test('a corrupted/foreign stored value falls back to radar rather than throwing', () => {
  const storage = new FakeStorage()
  storage.setItem(COMPARISON_VIEW_STORAGE_KEY, 'not-a-real-view')
  assert.equal(readStoredComparisonView(storage), 'radar')
})

test('a storage that throws (private-browsing-style) never crashes read or write', () => {
  const storage = new ThrowingStorage()
  assert.equal(readStoredComparisonView(storage), 'radar')
  assert.doesNotThrow(() => writeStoredComparisonView(storage, 'table'))
})

test('isComparisonView only accepts the two known literals', () => {
  assert.equal(isComparisonView('radar'), true)
  assert.equal(isComparisonView('table'), true)
  assert.equal(isComparisonView('bars'), false)
  assert.equal(isComparisonView(null), false)
  assert.equal(isComparisonView(42), false)
})

// ---------------------------------------------------------------------------
// 4. Catalog description clamp/expand (pure threshold logic)
// ---------------------------------------------------------------------------

console.log('\n=== Catalog description expand/collapse threshold ===')

test('a short description does not need clamping', () => {
  assert.equal(needsClamp('Short and sweet.'), false)
})

test('a description longer than the threshold needs clamping', () => {
  const long = 'x'.repeat(DEFAULT_CLAMP_THRESHOLD + 1)
  assert.equal(needsClamp(long), true)
})

test('a description exactly at the threshold does not need clamping (strictly greater-than)', () => {
  const exact = 'x'.repeat(DEFAULT_CLAMP_THRESHOLD)
  assert.equal(needsClamp(exact), false)
})

test('missing/empty description never needs clamping', () => {
  assert.equal(needsClamp(undefined), false)
  assert.equal(needsClamp(null), false)
  assert.equal(needsClamp(''), false)
})

test('needsClamp is deterministic', () => {
  const text = 'A reasonably long piece of descriptive text about a badminton string.'
  assert.equal(needsClamp(text), needsClamp(text))
})

test('real catalog data: notes needing a "Read more" control are identified consistently', () => {
  const longNotesCount = localCatalog.filter((s) => needsClamp(s.notes)).length
  // Just proving the real dataset produces a sane, non-degenerate split (not 0 and not all 21) —
  // pins the behavior against the actual catalog rather than only synthetic strings.
  assert.ok(longNotesCount > 0 && longNotesCount < localCatalog.length)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
