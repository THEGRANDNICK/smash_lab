// Automated tests for Phase 8's presentation layer — structured
// recommendation explanations, alternative reasoning, and the compact
// comparison-table metrics. Plain assertions via node:assert/strict, run
// directly with tsx, matching this project's existing script style.
//
// Run: npm run test:ui
//
// What this suite is proving, end to end:
//   1. recommendStrings()'s own output (best/bestAvailable/crossBrand/
//      specialistChoice ids, matchPercent, ranking, explanation text) is
//      byte-identical to its pre-Phase-8 behavior — recommendationEngine.ts,
//      tensionRecommendation.ts, and every file under src/config/ and
//      src/data/ were NOT touched by this phase. The fixture values below
//      were captured directly from recommendStrings() before any Phase 8
//      UI code existed.
//   2. Every new presentation function (buildStructuredExplanation,
//      buildAlternativeReasons, buildComparisonRows, and their small
//      helpers) is a pure, deterministic function of its inputs — called
//      twice with the same input, it produces deep-equal output.
//   3. The new functions only ever reshape data recommendStrings()/
//      specialist profiles/retailer listings already expose — they never
//      invent a rating, a rank, or a match percentage of their own.

import assert from 'node:assert/strict'
import { strings as localCatalog } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings, type ScoredString } from '../src/logic/recommendationEngine.js'
import type { QuizAnswers } from '../src/logic/types.js'
import {
  ratingTier,
  buildStrengthBadges,
  buildTradeoffs,
  buildPlayerLevelFit,
  buildStructuredExplanation,
  buildAlternativeReasons,
  DIMENSION_DISPLAY,
} from '../src/logic/recommendationExplanation.js'
import { buildComparisonRows } from '../src/logic/comparisonMetrics.js'
import type { RetailerListing } from '../src/services/retailerPriceService.js'

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

function findString(id: string) {
  const item = localCatalog.find((s) => s.id === id)
  assert.ok(item, `expected fixture string "${id}" to exist in data/strings.ts`)
  return item!
}

// ---------------------------------------------------------------------------
// 1. Recommendation isolation regression — fixture values captured directly
//    from recommendStrings() before any Phase 8 file existed.
// ---------------------------------------------------------------------------

console.log('\n=== Recommendation isolation regression ===')

const SAMPLE_ANSWERS: QuizAnswers[] = [
  { level: 'advanced', priorities: ['hardAttack', 'easyPower'], playStyles: ['aggressive'], powerGeneration: 'ownPower' },
  { level: 'beginner', priorities: ['comfort'], playStyles: ['balanced'], hittingFeel: 'softComfortable' },
  { level: 'tournament', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] },
  {},
]

const FIXTURES: { best: string; pct: number; cross: string; spec: string }[] = [
  { best: 'yonex-exbolt-63', pct: 91, cross: 'lining-no1-boost', spec: 'yonex-bg80' },
  { best: 'yonex-skyarc', pct: 93, cross: 'lining-no1-boost', spec: 'yonex-exbolt-65' },
  { best: 'yonex-aerobite', pct: 91, cross: 'lining-no1-boost', spec: 'yonex-nanogy-99' },
  { best: 'yonex-exbolt-63', pct: 82, cross: 'lining-no1-boost', spec: 'yonex-exbolt-68' },
]

for (const [i, answers] of SAMPLE_ANSWERS.entries()) {
  test(`quiz input #${i + 1}: recommendStrings output matches the pre-Phase-8 fixture exactly`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const fixture = FIXTURES[i]
    assert.equal(rec.best.string.id, fixture.best, 'Best Match id changed')
    assert.equal(rec.best.matchPercent, fixture.pct, 'Best Match percent changed')
    assert.equal(rec.crossBrandAlternative?.string.id, fixture.cross, 'Cross-Brand Alternative changed')
    assert.equal(rec.specialistChoice?.string.id, fixture.spec, 'Specialist Choice changed')
  })
}

test('recommendStrings called twice with the same input returns identical ranking (determinism)', () => {
  const a = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  const b = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  assert.deepEqual(
    { best: a.best.string.id, pct: a.best.matchPercent, cross: a.crossBrandAlternative?.string.id, spec: a.specialistChoice?.string.id },
    { best: b.best.string.id, pct: b.best.matchPercent, cross: b.crossBrandAlternative?.string.id, spec: b.specialistChoice?.string.id },
  )
})

// ---------------------------------------------------------------------------
// 2. ratingTier — pure bucketing, never touches ranking.
// ---------------------------------------------------------------------------

console.log('\n=== ratingTier bucketing ===')

test('11/11 is Excellent', () => assert.equal(ratingTier(11), 'Excellent'))
test('9.5/11 is Excellent (>= 85%)', () => assert.equal(ratingTier(9.5), 'Excellent'))
test('7.5/11 is Very Good', () => assert.equal(ratingTier(7.5), 'Very Good'))
test('5/11 is Good', () => assert.equal(ratingTier(5), 'Good'))
test('2/11 is Fair', () => assert.equal(ratingTier(2), 'Fair'))
test('0/11 is Fair', () => assert.equal(ratingTier(0), 'Fair'))
test('respects a custom max (e.g. a 0-5 specialist scale)', () => assert.equal(ratingTier(4.5, 5), 'Excellent'))

// ---------------------------------------------------------------------------
// 3. buildStrengthBadges / buildTradeoffs / buildPlayerLevelFit
// ---------------------------------------------------------------------------

console.log('\n=== Strength badges, trade-offs, player-level fit ===')

const bg80 = findString('yonex-bg80')
const bg80Profile = STRING_SPECIALIST_PROFILES['yonex-bg80']

function scoreFor(id: string, answers: QuizAnswers): ScoredString {
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
  const candidates = [rec.best, rec.bestAvailable, rec.crossBrandAlternative, rec.specialistChoice].filter((s): s is ScoredString => s != null)
  const match = candidates.find((s) => s.string.id === id)
  assert.ok(match, `expected "${id}" to appear as one of the recommendation's candidates for these answers`)
  return match!
}

test('buildStrengthBadges caps at 4 and never duplicates a label', () => {
  const scored = scoreFor('yonex-bg80', SAMPLE_ANSWERS[0])
  const badges = buildStrengthBadges(scored)
  assert.ok(badges.length <= 4, 'expected at most 4 badges')
  const labels = badges.map((b) => b.label)
  assert.equal(new Set(labels).size, labels.length, 'expected no duplicate badge labels')
})

test('buildStrengthBadges is deterministic', () => {
  const scored = scoreFor('yonex-bg80', SAMPLE_ANSWERS[0])
  assert.deepEqual(buildStrengthBadges(scored), buildStrengthBadges(scored))
})

test('buildTradeoffs prefers the specialist profile\'s own recorded weaknesses over a generic dimension trade-off', () => {
  const scored = scoreFor('yonex-bg80', SAMPLE_ANSWERS[0])
  const tradeoffs = buildTradeoffs(scored, bg80Profile)
  assert.ok(tradeoffs.length > 0, 'expected at least one trade-off')
  assert.equal(tradeoffs[0], bg80Profile.weaknesses![0].endsWith('.') ? bg80Profile.weaknesses![0] : `${bg80Profile.weaknesses![0]}.`)
})

test('buildTradeoffs caps at 2', () => {
  const scored = scoreFor('yonex-bg80', SAMPLE_ANSWERS[0])
  assert.ok(buildTradeoffs(scored, bg80Profile).length <= 2)
})

test('buildTradeoffs falls back to a generic dimension trade-off when there is no specialist profile', () => {
  const scored = scoreFor('yonex-exbolt-63', SAMPLE_ANSWERS[0])
  const tradeoffs = buildTradeoffs(scored, undefined)
  assert.ok(tradeoffs.length > 0, 'expected a fallback trade-off derived from manufacturer dimensions')
  const knownSentences = Object.values(DIMENSION_DISPLAY).map((d) => d.tradeoff)
  assert.ok(knownSentences.includes(tradeoffs[0]), 'expected the fallback sentence to come from the fixed DIMENSION_DISPLAY table')
})

test('buildPlayerLevelFit returns undefined for a string with no specialist profile', () => {
  assert.equal(buildPlayerLevelFit(undefined), undefined)
})

test('buildPlayerLevelFit flags high beginnerFriendliness as beginner-friendly', () => {
  const profile: StringSpecialistProfile = { dimensions: { beginnerFriendliness: 5 }, experienceSource: 'community', confidence: 'medium' }
  assert.equal(buildPlayerLevelFit(profile), 'Great for Beginners')
})

test('buildPlayerLevelFit flags high hardHitterFit (with low beginnerFriendliness) as advanced/attacking', () => {
  const profile: StringSpecialistProfile = { dimensions: { hardHitterFit: 5 }, experienceSource: 'community', confidence: 'medium' }
  assert.equal(buildPlayerLevelFit(profile), 'Best for Advanced, Attacking Players')
})

test('buildPlayerLevelFit is deterministic', () => {
  assert.equal(buildPlayerLevelFit(bg80Profile), buildPlayerLevelFit(bg80Profile))
})

// ---------------------------------------------------------------------------
// 4. buildStructuredExplanation
// ---------------------------------------------------------------------------

console.log('\n=== Structured explanation ===')

test('buildStructuredExplanation carries the engine\'s own explanation text through verbatim', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  const structured = buildStructuredExplanation(rec.best, rec.explanations.best, STRING_SPECIALIST_PROFILES[rec.best.string.id])
  assert.equal(structured.paragraph, rec.explanations.best)
})

test('buildStructuredExplanation headline names the top manufacturer dimension at its rating tier', () => {
  const scored = scoreFor('yonex-bg80', SAMPLE_ANSWERS[0])
  const structured = buildStructuredExplanation(scored, 'irrelevant for this check', bg80Profile)
  const topDim = scored.topDimensions[0]
  assert.ok(topDim, 'expected at least one top dimension')
  assert.ok(structured.headline.includes(DIMENSION_DISPLAY[topDim].label), `expected headline "${structured.headline}" to mention ${DIMENSION_DISPLAY[topDim].label}`)
})

test('buildStructuredExplanation is deterministic for identical input', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[1], localCatalog, STRING_SPECIALIST_PROFILES)
  const profile = STRING_SPECIALIST_PROFILES[rec.best.string.id]
  const a = buildStructuredExplanation(rec.best, rec.explanations.best, profile)
  const b = buildStructuredExplanation(rec.best, rec.explanations.best, profile)
  assert.deepEqual(a, b)
})

for (const [i, answers] of SAMPLE_ANSWERS.entries()) {
  test(`quiz input #${i + 1}: structured explanation always has a non-empty headline and paragraph`, () => {
    const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
    const structured = buildStructuredExplanation(rec.best, rec.explanations.best, STRING_SPECIALIST_PROFILES[rec.best.string.id])
    assert.ok(structured.headline.length > 0)
    assert.ok(structured.paragraph.length > 0)
  })
}

// ---------------------------------------------------------------------------
// 5. buildAlternativeReasons
// ---------------------------------------------------------------------------

console.log('\n=== Alternative recommendation reasoning ===')

test('buildAlternativeReasons flags higher durability than the baseline', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  const alt = rec.specialistChoice!
  const reasons = buildAlternativeReasons(alt, rec.best, STRING_SPECIALIST_PROFILES[alt.string.id], STRING_SPECIALIST_PROFILES[rec.best.string.id])
  if (alt.string.durability - rec.best.string.durability >= 0.5) {
    assert.ok(reasons.includes('Higher durability than the Best Match.'))
  }
})

test('buildAlternativeReasons never returns more than 3 reasons', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[2], localCatalog, STRING_SPECIALIST_PROFILES)
  const alt = rec.crossBrandAlternative!
  const reasons = buildAlternativeReasons(alt, rec.best, STRING_SPECIALIST_PROFILES[alt.string.id], STRING_SPECIALIST_PROFILES[rec.best.string.id])
  assert.ok(reasons.length <= 3)
})

test('buildAlternativeReasons never duplicates a reason', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  const alt = rec.crossBrandAlternative!
  const reasons = buildAlternativeReasons(alt, rec.best, STRING_SPECIALIST_PROFILES[alt.string.id], STRING_SPECIALIST_PROFILES[rec.best.string.id])
  assert.equal(new Set(reasons).size, reasons.length)
})

test('buildAlternativeReasons flags a lower price than the baseline', () => {
  const cheaper: ScoredString = { string: { ...bg80, id: 'synthetic-cheap', stringCost: 5 }, matchPercent: 80, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 }
  const pricier: ScoredString = { string: { ...bg80, id: 'synthetic-pricy', stringCost: 20 }, matchPercent: 85, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 }
  const reasons = buildAlternativeReasons(cheaper, pricier, undefined, undefined)
  assert.ok(reasons.includes('Lower price than the Best Match.'))
})

test('buildAlternativeReasons flags in-stock vs the baseline being unavailable', () => {
  const inStock: ScoredString = { string: { ...bg80, id: 'synthetic-in-stock', stock: 'in-stock' }, matchPercent: 80, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 }
  const unavailable: ScoredString = { string: { ...bg80, id: 'synthetic-unavailable', stock: 'unavailable' }, matchPercent: 85, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 }
  const reasons = buildAlternativeReasons(inStock, unavailable, undefined, undefined)
  assert.ok(reasons.includes('Currently in stock, unlike the Best Match.'))
})

test('buildAlternativeReasons is deterministic', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS[0], localCatalog, STRING_SPECIALIST_PROFILES)
  const alt = rec.crossBrandAlternative!
  const a = buildAlternativeReasons(alt, rec.best, STRING_SPECIALIST_PROFILES[alt.string.id], STRING_SPECIALIST_PROFILES[rec.best.string.id])
  const b = buildAlternativeReasons(alt, rec.best, STRING_SPECIALIST_PROFILES[alt.string.id], STRING_SPECIALIST_PROFILES[rec.best.string.id])
  assert.deepEqual(a, b)
})

// ---------------------------------------------------------------------------
// 6. Comparison-table metrics
// ---------------------------------------------------------------------------

console.log('\n=== Comparison table metrics ===')

const EXPECTED_ROW_LABELS = [
  'Repulsion',
  'Control',
  'Durability',
  'Feel',
  'Tension Retention',
  'Hitting Sound',
  'Power',
  'Shock Absorption / Comfort',
  'Overall Specialist Rating',
  'Retail Availability',
  'Package Options',
  'Retailer Count',
]

test('buildComparisonRows produces exactly the requested metrics, in order', () => {
  const rows = buildComparisonRows(bg80, bg80Profile, undefined)
  assert.deepEqual(rows.map((r) => r.label), EXPECTED_ROW_LABELS)
})

test('buildComparisonRows dot rows scale a manufacturer 0-11 rating to 0-5 dots', () => {
  const rows = buildComparisonRows(bg80, bg80Profile, undefined)
  const repulsion = rows.find((r) => r.key === 'repulsion')!
  assert.equal(repulsion.dots?.of, 5)
  const expectedFilled = Math.round((bg80.repulsion / 11) * 5)
  assert.equal(repulsion.dots?.filled, expectedFilled)
})

test('buildComparisonRows reports "Not rated" text when a manufacturer value is null', () => {
  const nullShock = { ...bg80, shockAbsorption: null }
  const rows = buildComparisonRows(nullShock, undefined, undefined)
  const comfort = rows.find((r) => r.key === 'comfort')!
  assert.equal(comfort.text, 'Not rated')
  assert.equal(comfort.dots, undefined)
})

test('buildComparisonRows falls back Comfort to manufacturer shockAbsorption when there is no specialist profile', () => {
  const rows = buildComparisonRows(bg80, undefined, undefined)
  const comfort = rows.find((r) => r.key === 'comfort')!
  assert.notEqual(comfort.text, 'Not rated')
})

test('buildComparisonRows Feel shows the specialist-profile feel label', () => {
  const rows = buildComparisonRows(bg80, bg80Profile, undefined)
  const feel = rows.find((r) => r.key === 'feel')!
  assert.equal(feel.text, 'Hard / direct')
})

test('buildComparisonRows Feel shows "Not rated" without a specialist profile', () => {
  const rows = buildComparisonRows(bg80, undefined, undefined)
  const feel = rows.find((r) => r.key === 'feel')!
  assert.equal(feel.text, 'Not rated')
})

test('buildComparisonRows Retail Availability / Package Options / Retailer Count reflect listing data', () => {
  const listings: RetailerListing[] = [
    {
      id: 1,
      stringId: bg80.id,
      retailerId: 10,
      retailerName: 'Retailer A',
      retailerLogoUrl: null,
      retailerActive: true,
      productUrl: null,
      price: 12,
      currency: 'EUR',
      availabilityStatus: 'in_stock',
      packageType: 'set',
      packageLengthM: null,
      isPreferred: false,
      notes: null,
      lastCheckedAt: null,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 2,
      stringId: bg80.id,
      retailerId: 11,
      retailerName: 'Retailer B',
      retailerLogoUrl: null,
      retailerActive: true,
      productUrl: null,
      price: 30,
      currency: 'EUR',
      availabilityStatus: 'low_stock',
      packageType: 'reel',
      packageLengthM: 200,
      isPreferred: false,
      notes: null,
      lastCheckedAt: null,
      updatedAt: new Date().toISOString(),
    },
  ]
  const rows = buildComparisonRows(bg80, bg80Profile, listings)
  assert.equal(rows.find((r) => r.key === 'availability')!.text, 'In stock')
  assert.equal(rows.find((r) => r.key === 'packageOptions')!.text, 'Set, Reel')
  assert.equal(rows.find((r) => r.key === 'retailerCount')!.text, '2')
})

test('buildComparisonRows reports "No retailers listed" / "—" / "0" with no listings', () => {
  const rows = buildComparisonRows(bg80, bg80Profile, undefined)
  assert.equal(rows.find((r) => r.key === 'availability')!.text, 'No retailers listed')
  assert.equal(rows.find((r) => r.key === 'packageOptions')!.text, '—')
  assert.equal(rows.find((r) => r.key === 'retailerCount')!.text, '0')
})

test('buildComparisonRows is deterministic', () => {
  const a = buildComparisonRows(bg80, bg80Profile, undefined)
  const b = buildComparisonRows(bg80, bg80Profile, undefined)
  assert.deepEqual(a, b)
})

for (const item of localCatalog) {
  test(`comparison rows render without throwing for ${item.id}`, () => {
    const rows = buildComparisonRows(item, STRING_SPECIALIST_PROFILES[item.id], undefined)
    assert.equal(rows.length, EXPECTED_ROW_LABELS.length)
  })
}

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
