// Automated tests for Phase 9 — real available string colors (inventory
// priority + catalog fallback), the multi-color swatch preview (solid +
// hybrid, +N expand/collapse), the admin version footer, and a fresh
// recommendation/ranking/tension regression proving this catalog-and-
// comparison-presentation pass changed nothing about what gets
// recommended. Plain assertions via node:assert/strict, run directly with
// tsx, matching this project's existing script style.
//
// Run: npm run test:catalog-polish
//
// What this suite deliberately does NOT try to test (see the README's
// "Browser verification" section instead): the actual rendered swatch
// circles/split-circle, keyboard-triggered expand/collapse, the comparison
// chips' remove buttons, the larger radar/full-width table, and the
// rendered admin footer — this repo has no DOM/component-testing library,
// so those were verified in a real browser instead. The pure logic behind
// every one of them (what should render, in what order, under what
// conditions) is fully covered here.

import assert from 'node:assert/strict'
import { strings as localCatalog, type StringItem } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { recommendTension } from '../src/logic/tensionRecommendation.js'
import type { QuizAnswers } from '../src/logic/types.js'
import { mergeInventoryIntoCatalog, type InventoryMap } from '../src/services/inventoryService.js'
import { resolveStringColor, buildColorPreview, primaryStringColor, allStringColors } from '../src/logic/stringColor.js'
import { summarizeColorDiagnostics } from '../src/logic/colorDiagnostics.js'
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

// ---------------------------------------------------------------------------
// 1. Recommendation / ranking / tension regression
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

test('mergeInventoryIntoCatalog only ever changes stock/setsAvailable/inventoryColor, never scoring-relevant fields', () => {
  const inventory: InventoryMap = { 'yonex-bg80': { stockStatus: 'low-stock', quantity: 3, packageType: 'set', color: 'White' } }
  const merged = mergeInventoryIntoCatalog(localCatalog, inventory)
  const original = localCatalog.find((s) => s.id === 'yonex-bg80')!
  const updated = merged.find((s) => s.id === 'yonex-bg80')!
  assert.equal(updated.stock, 'low-stock')
  assert.equal(updated.setsAvailable, 3)
  assert.equal(updated.inventoryColor, 'White')
  assert.equal(updated.repulsion, original.repulsion)
  assert.equal(updated.control, original.control)
  assert.equal(updated.durability, original.durability)
  assert.equal(updated.hittingSound, original.hittingSound)
  assert.equal(updated.shockAbsorption, original.shockAbsorption)
})

// ---------------------------------------------------------------------------
// 2. Color mapping — shared, case-insensitive, trimmed, deterministic
// ---------------------------------------------------------------------------

console.log('\n=== Color mapping ===')

test('every color name required by the brief resolves to a swatch', () => {
  const names = [
    'yellow',
    'white',
    'black',
    'red',
    'blue',
    'green',
    'orange',
    'pink',
    'purple',
    'silver',
    'grey',
    'gray',
    'natural',
    'neon yellow',
    'neon green',
    'turquoise',
    'lime',
    'navy',
    'sky blue',
    'royal blue',
    'mint',
    'coral',
    'violet',
  ]
  for (const name of names) {
    assert.ok(resolveStringColor(name), `expected "${name}" to resolve`)
  }
})

test('resolution is case-insensitive and trimmed', () => {
  const a = resolveStringColor('  Royal Blue  ')
  const b = resolveStringColor('royal blue')
  const c = resolveStringColor('ROYAL BLUE')
  assert.ok(a && b && c)
  assert.equal(a!.hex, b!.hex)
  assert.equal(b!.hex, c!.hex)
})

test('resolution is deterministic', () => {
  assert.deepEqual(resolveStringColor('Mint'), resolveStringColor('Mint'))
})

test('an unknown color never invents a visual value', () => {
  assert.equal(resolveStringColor('Chartreuse Sparkle'), undefined)
  assert.equal(resolveStringColor(''), undefined)
  assert.equal(resolveStringColor(undefined), undefined)
})

test('white gets a darker visible outline', () => {
  assert.ok(resolveStringColor('white')!.ringClassName.includes('ring-black/30'))
})

test('black gets a light visible outline', () => {
  assert.ok(resolveStringColor('black')!.ringClassName.includes('dark:ring-white/50'))
})

test('silver and natural get a distinct visible outline understandable in both themes', () => {
  const silver = resolveStringColor('silver')!
  const natural = resolveStringColor('natural')!
  assert.ok(silver.ringClassName.includes('ring-black/30') && silver.ringClassName.includes('dark:ring-white/50'))
  assert.ok(natural.ringClassName.includes('ring-black/30') && natural.ringClassName.includes('dark:ring-white/50'))
})

test('neon colors resolve via automatic base-color inference this round (Phase 9 fix v2), not a bespoke neon entry (no animation/glow classes involved — plain color + ring only)', () => {
  const neonYellow = resolveStringColor('neon yellow')!
  const neonGreen = resolveStringColor('neon green')!
  assert.equal(neonYellow.hex, resolveStringColor('yellow')!.hex)
  assert.equal(neonGreen.hex, resolveStringColor('green')!.hex)
  assert.ok(!neonYellow.ringClassName.includes('animate'))
  assert.ok(!neonGreen.ringClassName.includes('animate'))
})

// ---------------------------------------------------------------------------
// 3. buildColorPreview — one/two/three colors, +N overflow, ordering, dedup
// ---------------------------------------------------------------------------

console.log('\n=== Color swatch preview: solid strings ===')

test('one recognized color renders as a single visible swatch, no overflow', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.visible[0].label, 'Yellow')
    assert.equal(preview.overflow.length, 0)
  }
})

test('two recognized colors render as two visible swatches, no overflow', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow', 'White'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 2)
    assert.equal(preview.overflow.length, 0)
  }
})

test('three recognized colors render as three visible swatches, no overflow (at the default maxVisible)', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow', 'White', 'Black'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 3)
    assert.equal(preview.overflow.length, 0)
  }
})

test('more than three colors overflow beyond maxVisible, available for expansion', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Black', 'White', 'Red', 'Blue', 'Green'] }), 3)
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 3)
    assert.equal(preview.overflow.length, 2)
  }
})

test('a custom maxVisible is respected', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow', 'White', 'Black'] }), 1)
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.overflow.length, 2)
  }
})

test('unrecognized color names are skipped, never fabricated', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Sparkle Fusion', 'Yellow'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.visible[0].label, 'Yellow')
  }
})

test('duplicate colors (case-insensitive) are deduplicated — "Yellow"/"yellow"/"YELLOW" is one color', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow', 'yellow', 'YELLOW'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
  }
})

test('no colors at all renders "none"', () => {
  assert.deepEqual(buildColorPreview(baseItem({ colors: undefined })), { kind: 'none' })
  assert.deepEqual(buildColorPreview(baseItem({ colors: [] })), { kind: 'none' })
})

test('a string with only unrecognized color names renders "none", never a placeholder', () => {
  assert.deepEqual(buildColorPreview(baseItem({ colors: ['Chartreuse Sparkle', 'Mystery Hue'] })), { kind: 'none' })
})

test('catalog-only colors (no inventory) are alphabetically ordered', () => {
  const preview = buildColorPreview(baseItem({ colors: ['Yellow', 'Black', 'White'] }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.deepEqual(
      preview.visible.map((s) => s.label),
      ['Black', 'White', 'Yellow'],
    )
  }
})

test('buildColorPreview never reorders randomly between calls (fully deterministic)', () => {
  const item = baseItem({ colors: ['Yellow', 'White', 'Black', 'Red'] })
  const a = buildColorPreview(item, 3)
  const b = buildColorPreview(item, 3)
  assert.deepEqual(a, b)
})

// ---------------------------------------------------------------------------
// 4. Inventory-over-catalog priority (merged, not fully replaced)
// ---------------------------------------------------------------------------

console.log('\n=== Inventory/catalog color priority ===')

test('an available inventory color is shown first, ahead of catalog colors (merged, not replaced)', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Black', colors: ['Yellow', 'White'], stock: 'in-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.deepEqual(
      preview.visible.map((s) => s.label),
      ['Black', 'White', 'Yellow'],
    )
  }
})

test('an inventory color already present in the catalog list is not duplicated', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Yellow', colors: ['Yellow', 'White'], stock: 'in-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.deepEqual(
      preview.visible.map((s) => s.label),
      ['Yellow', 'White'],
    )
  }
})

test('falls back to the catalog colors list when there is no inventoryColor', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: undefined, colors: ['Yellow', 'White'], stock: 'in-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible.length, 2)
})

test('an inventory color is excluded when the string is out of stock — falls back to catalog colors instead of showing nothing', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Black', colors: ['Yellow'], stock: 'unavailable' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.visible[0].label, 'Yellow')
  }
})

test('an unrecognized inventoryColor does not block catalog colors from showing', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Unobtainium', colors: ['Yellow'], stock: 'in-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.visible[0].label, 'Yellow')
  }
})

test('an out-of-stock string with an unrecognized inventory color and no catalog colors renders "none"', () => {
  assert.deepEqual(buildColorPreview(baseItem({ inventoryColor: 'Unobtainium', colors: undefined, stock: 'unavailable' })), { kind: 'none' })
})

test('low-stock (not unavailable) still counts the inventory color as available', () => {
  const preview = buildColorPreview(baseItem({ inventoryColor: 'Black', colors: undefined, stock: 'low-stock' }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible[0].label, 'Black')
})

// ---------------------------------------------------------------------------
// 5. Hybrid split swatch
// ---------------------------------------------------------------------------

console.log('\n=== Color swatch preview: hybrid strings ===')

test('a hybrid with both main and cross colors known renders a true split swatch', () => {
  const preview = buildColorPreview(baseItem({ isHybrid: true, mainString: { color: 'White' }, crossString: { color: 'Red' } }))
  assert.equal(preview.kind, 'hybrid')
  if (preview.kind === 'hybrid') {
    assert.equal(preview.main.label, 'White')
    assert.equal(preview.cross.label, 'Red')
  }
})

test('a hybrid with only the main color known renders as an ordinary single solid swatch, never inventing the cross color', () => {
  const preview = buildColorPreview(baseItem({ isHybrid: true, mainString: { color: 'Red' }, crossString: undefined }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') {
    assert.equal(preview.visible.length, 1)
    assert.equal(preview.visible[0].label, 'Red')
  }
})

test('a hybrid with only the cross color known renders as an ordinary single solid swatch', () => {
  const preview = buildColorPreview(baseItem({ isHybrid: true, mainString: undefined, crossString: { color: 'Blue' } }))
  assert.equal(preview.kind, 'solid')
  if (preview.kind === 'solid') assert.equal(preview.visible[0].label, 'Blue')
})

test('a hybrid with neither side known renders "none" (missing data recorded via colorDiagnostics instead)', () => {
  assert.deepEqual(buildColorPreview(baseItem({ isHybrid: true, mainString: {}, crossString: {} })), { kind: 'none' })
})

test('a hybrid never falls back to its own top-level `colors` list (that would misrepresent which side is which)', () => {
  const preview = buildColorPreview(baseItem({ isHybrid: true, colors: ['Yellow', 'White'], mainString: undefined, crossString: undefined }))
  assert.deepEqual(preview, { kind: 'none' })
})

test('real catalog data: mergeInventoryIntoCatalog + buildColorPreview never throws for any real string', () => {
  const inventory: InventoryMap = {}
  for (const item of localCatalog) inventory[item.id] = { stockStatus: item.stock, quantity: null, packageType: 'unknown' }
  const merged = mergeInventoryIntoCatalog(localCatalog, inventory)
  for (const item of merged) {
    const preview = buildColorPreview(item)
    assert.ok(preview.kind === 'none' || preview.kind === 'solid' || preview.kind === 'hybrid')
  }
})

console.log('\n=== Deprecated Phase 8 API still works (backward compatibility) ===')

test('primaryStringColor still resolves the first recognized color', () => {
  assert.equal(primaryStringColor(['Unknown', 'Blue', 'Red'])?.label, 'Blue')
})

test('allStringColors still caps and dedupes', () => {
  const swatches = allStringColors(['Yellow', 'yellow', 'Red', 'Blue'], 2)
  assert.equal(swatches.length, 2)
})

// ---------------------------------------------------------------------------
// 6. Color diagnostics (admin/debug surface)
// ---------------------------------------------------------------------------

console.log('\n=== Color diagnostics ===')

test('counts strings with inventory colors, catalog colors, and neither', () => {
  const items = [
    baseItem({ id: 'a', inventoryColor: 'Yellow', stock: 'in-stock' }),
    baseItem({ id: 'b', colors: ['White'] }),
    baseItem({ id: 'c' }),
  ]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.withInventoryColor, 1)
  assert.equal(summary.withCatalogColors, 1)
  assert.equal(summary.withNeither, 1)
})

test('flags an unknown color value once, keeping the raw text for admin diagnostics', () => {
  const items = [baseItem({ id: 'a', colors: ['Mystery Hue', 'Mystery Hue', 'Yellow'] })]
  const summary = summarizeColorDiagnostics(items)
  assert.deepEqual(summary.unknownColorValues, ['Mystery Hue'])
})

test('flags same-string case-insensitive duplicate colors', () => {
  const items = [baseItem({ id: 'yonex-test', colors: ['Yellow', 'yellow', 'White'] })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.duplicateCaseInsensitiveColors.length, 1)
  assert.ok(summary.duplicateCaseInsensitiveColors[0].startsWith('yonex-test:'))
})

test('flags hybrid strings with neither side known separately from a partial (one-side-known) pair (Phase 9 fix v2 refinement)', () => {
  const items = [
    baseItem({ id: 'complete-hybrid', isHybrid: true, mainString: { color: 'White' }, crossString: { color: 'Red' } }),
    baseItem({ id: 'partial-hybrid', isHybrid: true, mainString: { color: 'White' }, crossString: undefined }),
    baseItem({ id: 'missing-hybrid', isHybrid: true }),
  ]
  const summary = summarizeColorDiagnostics(items)
  assert.deepEqual(summary.hybridMissingColors, ['missing-hybrid'])
  assert.deepEqual(summary.partialHybridPairs, ['partial-hybrid'])
})

test('counts inventory colors hidden because the string is out of stock', () => {
  const items = [baseItem({ id: 'a', inventoryColor: 'Black', stock: 'unavailable' }), baseItem({ id: 'b', inventoryColor: 'White', stock: 'in-stock' })]
  const summary = summarizeColorDiagnostics(items)
  assert.equal(summary.hiddenDueToUnavailableInventory, 1)
})

test('counts total unique mapped colors across inventory, catalog, and hybrid sides', () => {
  const items = [
    baseItem({ id: 'a', inventoryColor: 'Yellow', colors: ['White'] }),
    baseItem({ id: 'b', colors: ['yellow'] }), // same as "Yellow" case-insensitively — not a new unique color
    baseItem({ id: 'c', isHybrid: true, mainString: { color: 'Black' }, crossString: { color: 'Red' } }),
  ]
  const summary = summarizeColorDiagnostics(items)
  // Yellow, White, Black, Red = 4 distinct resolved colors
  assert.equal(summary.totalUniqueMappedColors, 4)
})

test('summarizeColorDiagnostics never throws on the real catalog', () => {
  assert.doesNotThrow(() => summarizeColorDiagnostics(localCatalog))
})

// ---------------------------------------------------------------------------
// 7. Version helper (admin footer, environment label)
// ---------------------------------------------------------------------------

console.log('\n=== Version helper (admin footer) ===')

test('formatDisplayVersion drops a trailing ".0" prerelease build number', () => {
  assert.equal(formatDisplayVersion('0.8.0-beta.0'), 'v0.8.0-beta')
})

test('formatDisplayVersion keeps a non-zero prerelease build number', () => {
  assert.equal(formatDisplayVersion('0.8.0-beta.1'), 'v0.8.0-beta.1')
})

test('formatDisplayVersion leaves a plain release version unchanged (just prefixed)', () => {
  assert.equal(formatDisplayVersion('1.2.3'), 'v1.2.3')
})

test('resolveEnvironmentLabel maps Vite PROD correctly', () => {
  assert.equal(resolveEnvironmentLabel(true), 'Production')
  assert.equal(resolveEnvironmentLabel(false), 'Development')
  assert.equal(resolveEnvironmentLabel(undefined), 'Development')
})

test('buildVersionInfo combines both into the footer-ready shape', () => {
  const info = buildVersionInfo('0.8.0-beta.0', true)
  assert.equal(info.raw, '0.8.0-beta.0')
  assert.equal(info.display, 'v0.8.0-beta')
  assert.equal(info.environment, 'Production')
})

test("package.json's version matches the display the brief targets", () => {
  assert.equal(formatDisplayVersion('0.8.0-beta.0'), 'v0.8.0-beta')
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
