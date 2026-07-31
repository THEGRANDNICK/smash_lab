// Phase 12 — dedicated recommendation-calibration regression suite.
//
// Unlike the exact-snapshot fixtures pinned in earlier phases' test files
// (testUiPresentation.ts etc.), this suite deliberately asserts BEHAVIORAL
// properties ("BG65 is top-tier for a max-durability quiz", "a hard/direct
// string never wins a comfort-focused quiz") rather than exact string ids
// and match percentages everywhere — per the phase brief's instruction to
// avoid brittle full-ranking snapshots. A few scenarios do still name a
// specific expected winner where the calibration goal is unambiguous
// (e.g. BG65 for pure durability) since that IS the target behavior being
// verified, not an incidental implementation detail.
//
// Run: npm run test:calibration

import assert from 'node:assert/strict'
import { strings as localCatalog } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings, buildPreferenceProfile, buildSpecialistWeights, scoreString, type ScoredString } from '../src/logic/recommendationEngine.js'
import type { QuizAnswers } from '../src/logic/types.js'

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

/** Full ranked list (recommendStrings() only exposes 4 named slots) — built from the same exported, pure building blocks the engine itself uses, so this is never a second scoring implementation. */
function fullRanking(
  answers: QuizAnswers,
  pool = localCatalog,
  profiles: Record<string, unknown> = STRING_SPECIALIST_PROFILES as Record<string, unknown>,
): ScoredString[] {
  const profile = buildPreferenceProfile(answers)
  const specialistWeights = buildSpecialistWeights(answers)
  const budget = Object.values(specialistWeights).reduce((a, b) => a + b, 0)
  return pool
    .map((s) => scoreString(s, profile, specialistWeights, budget, profiles as Parameters<typeof scoreString>[4]))
    .sort((a, b) => b.matchPercent - a.matchPercent || a.string.id.localeCompare(b.string.id))
}

/** 1-based rank, or Infinity if the string isn't in the ranking at all. */
function rankOf(ranking: ScoredString[], id: string): number {
  const idx = ranking.findIndex((s) => s.string.id === id)
  return idx === -1 ? Infinity : idx + 1
}

// ---------------------------------------------------------------------------
// 1. Maximum durability
// ---------------------------------------------------------------------------
console.log('\n=== 1. Maximum durability ===')
{
  const answers: QuizAnswers = { level: 'intermediate', priorities: ['durability'], restringReason: 'wearFraying', frequency: 'threePlusWeek' }
  const ranking = fullRanking(answers)
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('BG65 or BG65 Titanium appears in the top 2', () => {
    const bestRank = Math.min(rankOf(ranking, 'yonex-bg65'), rankOf(ranking, 'yonex-bg65-titanium'))
    assert.ok(bestRank <= 2, `expected rank <= 2, got ${bestRank}`)
  })
  test('a thin, low-durability string (Exbolt 63 / Aerosonic) does not rank first', () => {
    assert.notEqual(ranking[0].string.id, 'yonex-exbolt-63')
    assert.notEqual(ranking[0].string.id, 'yonex-aerosonic')
  })
  test('dominant archetype is maxDurability', () => {
    assert.equal(rec.dominantArchetype, 'maxDurability')
  })
  test('explanation mentions durability', () => {
    assert.match(rec.explanations.best.toLowerCase(), /durability/)
  })
}

// ---------------------------------------------------------------------------
// 2. Maximum repulsion
// ---------------------------------------------------------------------------
console.log('\n=== 2. Maximum repulsion ===')
{
  const answers: QuizAnswers = { level: 'advanced', priorities: ['easyPower'], powerGeneration: 'needsHelp' }
  const ranking = fullRanking(answers)

  test('a genuinely lively, high-repulsion string is top-tier (top 3)', () => {
    const bestRank = Math.min(rankOf(ranking, 'yonex-exbolt-63'), rankOf(ranking, 'yonex-aerosonic'))
    assert.ok(bestRank <= 3, `expected rank <= 3, got ${bestRank}`)
  })
  test('the pure durability specialist (BG65) does not win purely on broad average', () => {
    assert.notEqual(ranking[0].string.id, 'yonex-bg65')
  })
}

// ---------------------------------------------------------------------------
// 3. Hard/direct attacking control
// ---------------------------------------------------------------------------
console.log('\n=== 3. Hard/direct attacking control ===')
{
  const answers: QuizAnswers = {
    level: 'advanced',
    priorities: ['hardAttack', 'directPrecision'],
    playStyles: ['aggressive'],
    hittingFeel: 'hardCrisp',
    powerGeneration: 'ownPower',
  }
  const ranking = fullRanking(answers)
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('BG80 is strongly competitive (top 5)', () => {
    assert.ok(rankOf(ranking, 'yonex-bg80') <= 5, `expected rank <= 5, got ${rankOf(ranking, 'yonex-bg80')}`)
  })
  test('a soft comfort string (SkyArc) does not dominate (outside top 5)', () => {
    assert.ok(rankOf(ranking, 'yonex-skyarc') > 5)
  })
  test('dominant archetype is hardDirectAttack', () => {
    assert.equal(rec.dominantArchetype, 'hardDirectAttack')
  })
}

// ---------------------------------------------------------------------------
// 4. Comfort / arm-friendliness
// ---------------------------------------------------------------------------
console.log('\n=== 4. Comfort / arm-friendliness ===')
{
  const answers: QuizAnswers = { level: 'beginner', priorities: ['comfort'], hittingFeel: 'softComfortable' }
  const ranking = fullRanking(answers)
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('a soft, high-comfort string leads', () => {
    assert.equal(ranking[0].string.id, 'yonex-skyarc')
  })
  test('a hard/direct string (BG80, Exbolt 63) gets a meaningful contradiction penalty (outside top 3)', () => {
    assert.ok(rankOf(ranking, 'yonex-bg80') > 3)
    assert.ok(rankOf(ranking, 'yonex-exbolt-63') > 3)
  })
  test('dominant archetype is comfortArmFriendly', () => {
    assert.equal(rec.dominantArchetype, 'comfortArmFriendly')
  })
  test('explanation mentions comfort', () => {
    assert.match(rec.explanations.best.toLowerCase(), /comfort/)
  })
}

// ---------------------------------------------------------------------------
// 5. Net precision / control
// ---------------------------------------------------------------------------
console.log('\n=== 5. Net precision / control ===')
{
  const answers: QuizAnswers = { level: 'advanced', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] }
  const ranking = fullRanking(answers)
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  const KNOWN_CONTROL_SPECIALISTS = ['yonex-aerobite', 'yonex-nanogy-99', 'yonex-bg66-force', 'yonex-bg66-ultimax']
  test('a genuine control specialist leads, not just a broad high-average string', () => {
    assert.ok(KNOWN_CONTROL_SPECIALISTS.includes(ranking[0].string.id), `got ${ranking[0].string.id}`)
  })
  test('dominant archetype is netPrecisionControl', () => {
    assert.equal(rec.dominantArchetype, 'netPrecisionControl')
  })
}

// ---------------------------------------------------------------------------
// 6. Balanced all-round
// ---------------------------------------------------------------------------
console.log('\n=== 6. Balanced all-round ===')
{
  const answers: QuizAnswers = { level: 'intermediate', playStyles: ['balanced'], powerGeneration: 'balanced', hittingFeel: 'mediumBalanced' }
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('dominant archetype is balancedAllRound', () => {
    assert.equal(rec.dominantArchetype, 'balancedAllRound')
  })
  test('no narrow single-dimension specialist (SkyArc, pure BG65) is forced to win a balanced profile', () => {
    assert.notEqual(rec.best.string.id, 'yonex-skyarc')
    assert.notEqual(rec.best.string.id, 'yonex-bg65')
  })
}

// ---------------------------------------------------------------------------
// 7. Fast doubles and drives
// ---------------------------------------------------------------------------
console.log('\n=== 7. Fast doubles and drives ===')
{
  const answers: QuizAnswers = { level: 'advanced', priorities: ['fastDrives'], playStyles: ['fastDoubles'] }
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
  const ranking = fullRanking(answers)

  test('dominant archetype is fastDoublesDrives', () => {
    assert.equal(rec.dominantArchetype, 'fastDoublesDrives')
  })
  test('a durability-first string (BG65) is not the top pick for reflex speed', () => {
    assert.ok(rankOf(ranking, 'yonex-bg65') > 3)
  })
}

// ---------------------------------------------------------------------------
// 8. Beginner-friendly
// ---------------------------------------------------------------------------
console.log('\n=== 8. Beginner-friendly ===')
{
  const answers: QuizAnswers = { level: 'beginner', priorities: ['comfort', 'easyPower'], hittingFeel: 'softComfortable' }
  const ranking = fullRanking(answers)

  test('a narrow hard-attack specialist (BG80, Exbolt 63) is not recommended to a beginner (outside top 3)', () => {
    assert.ok(rankOf(ranking, 'yonex-bg80') > 3)
    assert.ok(rankOf(ranking, 'yonex-exbolt-63') > 3)
  })
  test('the top pick is forgiving (above-average comfort or control)', () => {
    const top = ranking[0].string
    assert.ok((top.shockAbsorption ?? 0) >= 6 || top.control >= 6)
  })
}

// ---------------------------------------------------------------------------
// 9. Tension retention
// ---------------------------------------------------------------------------
console.log('\n=== 9. Tension retention ===')
{
  const answers: QuizAnswers = { priorities: ['tensionRetention'], restringReason: 'tensionLoss' }
  const ranking = fullRanking(answers)
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('Nanogy 99 (known for tension retention) is top-tier (top 3)', () => {
    assert.ok(rankOf(ranking, 'yonex-nanogy-99') <= 3, `expected rank <= 3, got ${rankOf(ranking, 'yonex-nanogy-99')}`)
  })
  test('dominant archetype is tensionRetention', () => {
    assert.equal(rec.dominantArchetype, 'tensionRetention')
  })
}

// ---------------------------------------------------------------------------
// 10. Sound / feedback preference
// ---------------------------------------------------------------------------
console.log('\n=== 10. Sound / feedback preference ===')
{
  const answers: QuizAnswers = { priorities: ['sound'], hittingFeel: 'hardCrisp' }
  const rec = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)

  test('dominant archetype is hittingSoundFeedback', () => {
    assert.equal(rec.dominantArchetype, 'hittingSoundFeedback')
  })
  test('the top pick has an above-average hitting-sound rating', () => {
    assert.ok(rec.best.string.hittingSound >= 7, `got ${rec.best.string.hittingSound}`)
  })
}

// ---------------------------------------------------------------------------
// 11. Contradictory answers
// ---------------------------------------------------------------------------
console.log('\n=== 11. Contradictory answers ===')
{
  const answers: QuizAnswers = { priorities: ['comfort', 'hardAttack'], hittingFeel: 'hardCrisp' }
  const clean: QuizAnswers = { level: 'intermediate', priorities: ['durability'], restringReason: 'wearFraying' }
  const contradictory = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
  const clear = recommendStrings(clean, localCatalog, STRING_SPECIALIST_PROFILES)

  test('never throws and always returns a valid 1-99 match percent', () => {
    assert.ok(contradictory.best.matchPercent >= 1 && contradictory.best.matchPercent <= 99)
  })
  test('a contradictory profile is capped lower than a clear, peaked one (reduced confidence)', () => {
    assert.ok(contradictory.best.matchPercent < clear.best.matchPercent, `contradictory=${contradictory.best.matchPercent} clear=${clear.best.matchPercent}`)
  })
}

// ---------------------------------------------------------------------------
// 12. Missing specialist-profile data
// ---------------------------------------------------------------------------
console.log('\n=== 12. Missing specialist-profile data ===')
{
  const answers: QuizAnswers = { level: 'intermediate', priorities: ['durability'], restringReason: 'wearFraying' }
  const rec = recommendStrings(answers, localCatalog, {})

  test('recommendStrings never throws with an empty specialist-profile map', () => {
    assert.ok(rec.best.matchPercent >= 1 && rec.best.matchPercent <= 99)
  })
  test('falls back cleanly to manufacturer-only scoring (zero specialist influence for every candidate)', () => {
    assert.equal(rec.best.specialistInfluence, 0)
    assert.equal(rec.crossBrandAlternative?.specialistInfluence ?? 0, 0)
  })
  test('still produces a sensible durability-focused winner without any specialist data', () => {
    assert.ok(rec.best.string.durability >= 7, `got ${rec.best.string.durability}`)
  })
}

// ---------------------------------------------------------------------------
// Determinism & repeatability
// ---------------------------------------------------------------------------
console.log('\n=== Determinism ===')
test('identical input produces identical output on repeated calls', () => {
  const answers: QuizAnswers = { level: 'advanced', priorities: ['hardAttack'], playStyles: ['aggressive'] }
  const a = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
  const b = recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES)
  assert.deepEqual(
    { best: a.best.string.id, pct: a.best.matchPercent, archetype: a.dominantArchetype },
    { best: b.best.string.id, pct: b.best.matchPercent, archetype: b.dominantArchetype },
  )
})
test('unchanged inputs and unchanged data produce an unchanged result (no hidden non-determinism)', () => {
  const answers: QuizAnswers = { priorities: ['comfort'] }
  const results = Array.from({ length: 5 }, () => recommendStrings(answers, localCatalog, STRING_SPECIALIST_PROFILES).best.matchPercent)
  assert.ok(results.every((r) => r === results[0]))
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
