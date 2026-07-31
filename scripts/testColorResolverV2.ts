// Automated tests for the second Phase 9 fix round — the layered,
// mostly-automatic color resolver (logic/cssColor.ts,
// logic/baseColorInference.ts, logic/stringColor.ts's resolveColor()),
// the clearer hybrid color-override workflow, and the simplified
// comparison chips. Plain assertions via node:assert/strict, run
// directly with tsx, matching this project's existing script style.
//
// Run: npm run test:color-resolver-v2
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual rendered swatch
// placement beside the string name, the removed physical-color dots in
// comparison chips, the native <input type="color"> picker, and the
// admin form's live resolution-source text — this repo has no
// DOM/component-testing library, so those were verified in a real
// browser instead. The pure logic behind every one of them is fully
// covered here.

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { isSafeCssColor, isCssSyntaxColor, isCssNamedColorKeyword } from '../src/logic/cssColor.js'
import { inferBaseColor, resolveAlias, baseColorKeys } from '../src/logic/baseColorInference.js'
import { resolveColor, resolveStringColor, buildColorPreview, hybridColorSource } from '../src/logic/stringColor.js'
import { summarizeColorDiagnostics } from '../src/logic/colorDiagnostics.js'
import { normalizeDecimalInput } from '../src/logic/decimalInput.js'
import { validateCatalogInput, emptyCatalogFormInput, type CatalogFormInput } from '../src/services/catalogAdminService.js'

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
// 2. Safe CSS color validation
// ---------------------------------------------------------------------------

console.log('\n=== Safe CSS color validation ===')

test('a valid CSS named color validates', () => {
  assert.ok(isSafeCssColor('orange'))
  assert.ok(isCssNamedColorKeyword('orange'))
})
test('a valid hex color validates', () => {
  assert.equal(isSafeCssColor('#ff6600'), '#ff6600')
  assert.ok(isCssSyntaxColor('#ff6600'))
})
test('a valid short hex color validates', () => {
  assert.ok(isSafeCssColor('#f60'))
})
test('a valid rgb() color validates', () => {
  assert.ok(isSafeCssColor('rgb(255, 102, 0)'))
  assert.ok(isCssSyntaxColor('rgb(255, 102, 0)'))
})
test('a valid hsl() color validates, including space-separated CSS4 syntax', () => {
  assert.ok(isSafeCssColor('hsl(24, 100%, 50%)'))
  assert.ok(isSafeCssColor('hsl(24 100% 50%)'))
})
test('rejects unsafe CSS constructs outright', () => {
  assert.equal(isSafeCssColor('url(evil.svg)'), undefined)
  assert.equal(isSafeCssColor('var(--x)'), undefined)
  assert.equal(isSafeCssColor('calc(1px + 2px)'), undefined)
  assert.equal(isSafeCssColor('red; background: url(x)'), undefined)
  assert.equal(isSafeCssColor('background-image: url(x)'), undefined)
  assert.equal(isSafeCssColor('red{color:blue}'), undefined)
})
test('rejects a made-up word that is not a real CSS keyword', () => {
  assert.equal(isSafeCssColor('fireorangeglow'), undefined)
})

// ---------------------------------------------------------------------------
// 3. Automatic base-color keyword inference
// ---------------------------------------------------------------------------

console.log('\n=== Automatic base-color inference ===')

const INFERENCE_CASES: [string, string][] = [
  ['Fire Orange', 'orange'],
  ['Ivory White', 'white'],
  ['Cosmic Gold', 'gold'],
  ['Royal Blue', 'blue'],
  ['Neon Yellow', 'yellow'],
  ['Dark Green', 'green'],
  ['Light Pink', 'pink'],
  ['Metallic Silver', 'silver'],
  ['Graphite Black', 'black'],
]
for (const [input, expectedBase] of INFERENCE_CASES) {
  test(`"${input}" automatically infers base color "${expectedBase}"`, () => {
    const match = inferBaseColor(input)
    assert.ok(match, `expected "${input}" to infer a base color`)
    assert.equal(match!.canonicalKey, expectedBase)
  })
}

test('multi-word base colors (e.g. "sky blue") are preserved intact, not split', () => {
  const match = inferBaseColor('Neon Sky Blue')
  assert.ok(match)
  assert.equal(match!.canonicalKey, 'sky blue')
})
test('inference preserves the original display label ("Fire Orange" stays "Fire Orange")', () => {
  const resolution = resolveColor('Fire Orange')
  assert.equal(resolution.displayName, 'Fire Orange')
  assert.equal(resolution.source, 'inferred_keyword')
})
test('inference returns undefined for a name with no recognizable base color', () => {
  assert.equal(inferBaseColor('Ocean'), undefined)
  assert.equal(inferBaseColor('Flash'), undefined)
})
test('every documented base color is actually resolvable end to end', () => {
  for (const key of baseColorKeys()) {
    assert.ok(resolveStringColor(key), `expected base color "${key}" to resolve`)
  }
})

// ---------------------------------------------------------------------------
// 4. The small exceptional alias table
// ---------------------------------------------------------------------------

console.log('\n=== Exceptional alias table ===')

test('"Turquois" (misspelling) resolves via the alias table, not inference', () => {
  const resolution = resolveColor('Turquois')
  assert.equal(resolution.source, 'alias')
  assert.equal(resolution.displayName, 'Turquoise')
})
test('"Grey" canonicalizes to "Gray" via the alias table', () => {
  const resolution = resolveColor('Grey')
  assert.equal(resolution.source, 'alias')
  assert.equal(resolution.displayName, 'Gray')
})
test('"Cosmic Gold" is NOT a full alias entry — it resolves via inference instead', () => {
  assert.equal(resolveAlias('Cosmic Gold'), undefined)
  assert.equal(resolveColor('Cosmic Gold').source, 'inferred_keyword')
})

// ---------------------------------------------------------------------------
// 5. Unresolved / ambiguous names
// ---------------------------------------------------------------------------

console.log('\n=== Unresolved ambiguous names ===')

for (const ambiguous of ['Ocean', 'Flash', 'Pearl', 'Ice', 'Smoke', 'Graphite', 'Amber']) {
  test(`"${ambiguous}" remains unresolved rather than guessed`, () => {
    const resolution = resolveColor(ambiguous)
    assert.equal(resolution.source, 'unresolved')
    assert.equal(resolution.cssColor, undefined)
    assert.equal(resolveStringColor(ambiguous), undefined)
  })
}

// ---------------------------------------------------------------------------
// 7. Normal multi-color lists vs. hybrid pairs
// ---------------------------------------------------------------------------

console.log('\n=== Normal color lists vs. hybrid pairs ===')

test('a normal (non-hybrid) string with "White, Red" renders two ordinary swatches', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'White, Red' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible.length, 2)
})
test('"White, Red" on a HYBRID string is NOT treated as a main/cross pair', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White, Red' })
  assert.equal(hybridColorSource(item).kind, 'none')
  assert.equal(buildColorPreview(item).kind, 'none')
})
test('only "White/Red" (a single slash) is treated as a legacy hybrid pair, and only when isHybrid', () => {
  const hybrid = baseItem({ isHybrid: true, inventoryColor: 'White/Red' })
  assert.equal(hybridColorSource(hybrid).kind, 'legacy-pair')
  const nonHybrid = baseItem({ isHybrid: false, inventoryColor: 'White/Red' })
  const preview = buildColorPreview(nonHybrid)
  assert.equal(preview.kind, 'none', 'a non-hybrid string never guesses a slash value apart')
})

// ---------------------------------------------------------------------------
// 8. Hybrid rendering priority
// ---------------------------------------------------------------------------

console.log('\n=== Hybrid color priority ===')

test('structured main/cross catalog metadata produces a true split swatch', () => {
  const item = baseItem({ isHybrid: true, mainString: { color: 'White' }, crossString: { color: 'Red' } })
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'White')
    assert.equal(preview.cross.label, 'Red')
  }
})
test('AeroBite-style legacy fallback: no structured colors, but inventory "White/Red" produces a split swatch', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White/Red' })
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'hybrid')
})
test('a partial hybrid (only one structured side known) renders one solid swatch, never invents the other side', () => {
  const item = baseItem({ isHybrid: true, mainString: { color: 'White' } })
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible.length, 1)
  assert.equal(hybridColorSource(item).kind, 'structured-partial')
})
test('a single plain legacy inventory value (no slash) on a hybrid with no structured colors is a partial legacy-solid', () => {
  const item = baseItem({ isHybrid: true, inventoryColor: 'White' })
  assert.equal(hybridColorSource(item).kind, 'legacy-solid')
  const preview = buildColorPreview(item)
  assert.equal(preview.kind, 'solid')
})

// ---------------------------------------------------------------------------
// 9. Diagnostics for the new resolver
// ---------------------------------------------------------------------------

console.log('\n=== Diagnostics: resolution sources ===')

test('resolutionSourceCounts tallies every raw value by tier', () => {
  const items = [
    baseItem({ id: 'a', colors: ['Fire Orange'] }),
    baseItem({ id: 'b', colors: ['orange'] }),
    baseItem({ id: 'c', colors: ['#ff6600'] }),
    baseItem({ id: 'd', colors: ['Turquois'] }),
    baseItem({ id: 'e', colors: ['Ocean'] }),
  ]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.resolutionSourceCounts.inferred_keyword, 1)
  assert.equal(summary.resolutionSourceCounts.css_named_color, 1)
  assert.equal(summary.resolutionSourceCounts.explicit_css, 1)
  assert.equal(summary.resolutionSourceCounts.alias, 1)
  assert.equal(summary.resolutionSourceCounts.unresolved, 1)
})
test('inferredColorNames records raw -> base color pairs, deduplicated', () => {
  const items = [baseItem({ id: 'a', colors: ['Fire Orange'] }), baseItem({ id: 'b', colors: ['Fire Orange'] })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.inferredColorNames.length, 1)
  assert.match(summary.inferredColorNames[0], /Fire Orange → orange/)
})
test('partialHybridPairs and hybridMissingColors are distinct categories', () => {
  const items = [
    baseItem({ id: 'a', isHybrid: true, mainString: { color: 'White' } }),
    baseItem({ id: 'b', isHybrid: true }),
  ]
  const summary = summarizeColorDiagnostics(items)
  assert.deepEqual(summary.partialHybridPairs, ['a'])
  assert.deepEqual(summary.hybridMissingColors, ['b'])
})
test('omittedDueToUnresolvedColor counts strings that HAD color data but none of it resolved', () => {
  const items = [baseItem({ id: 'a', colors: ['Ocean'] }), baseItem({ id: 'b' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.omittedDueToUnresolvedColor, 1)
  assert.equal(summary.withNeither, 2)
})
test('summarizeColorDiagnostics never throws on the real catalog', () => {
  assert.doesNotThrow(() => summarizeColorDiagnostics(localCatalog))
})

// ---------------------------------------------------------------------------
// 11. Mobile decimal input regression (must not regress from prior round)
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
// 12. Real catalog smoke test
// ---------------------------------------------------------------------------

console.log('\n=== Real catalog smoke test ===')

test('buildColorPreview never throws for any real catalog string', () => {
  for (const item of localCatalog) {
    assert.doesNotThrow(() => buildColorPreview(item))
  }
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
