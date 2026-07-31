// Phase 12 — development-only calibration diagnostic report. NOT part of
// the test suite (no assertions, exit code always 0) and NEVER imported
// by production code — its only job is to print a human-readable snapshot
// of how the engine currently ranks a representative set of scenarios, for
// whoever tunes config/archetypes.ts, config/recommendationWeights.ts, or
// the CONCENTRATION_STRENGTH / CROSS_BRAND_SHRINKAGE / CONFIDENCE_CEILING
// constants in logic/recommendationEngine.ts next. It never prints a raw
// internal weight table (that stays internal, per the phase brief) — only
// the same match percentages, top dimensions, and explanation text a real
// user already sees.
//
// Run: npm run calibration-report

import { strings as localCatalog } from '../src/data/strings.js'
import { STRING_SPECIALIST_PROFILES } from '../src/data/stringSpecialistProfiles.js'
import { recommendStrings, buildPreferenceProfile, buildSpecialistWeights, scoreString, type ScoredString } from '../src/logic/recommendationEngine.js'
import { ARCHETYPES } from '../src/config/archetypes.js'
import type { QuizAnswers } from '../src/logic/types.js'

interface Scenario {
  name: string
  answers: QuizAnswers
}

const SCENARIOS: Scenario[] = [
  { name: 'Maximum durability', answers: { level: 'intermediate', priorities: ['durability'], restringReason: 'wearFraying' } },
  { name: 'Maximum repulsion', answers: { level: 'advanced', priorities: ['easyPower'], powerGeneration: 'needsHelp' } },
  {
    name: 'Hard/direct attacking control',
    answers: { level: 'advanced', priorities: ['hardAttack', 'directPrecision'], playStyles: ['aggressive'], hittingFeel: 'hardCrisp', powerGeneration: 'ownPower' },
  },
  { name: 'Comfort / arm-friendliness', answers: { level: 'beginner', priorities: ['comfort'], hittingFeel: 'softComfortable' } },
  { name: 'Net precision / control', answers: { level: 'advanced', priorities: ['netTechnical', 'directPrecision'], playStyles: ['control'] } },
  { name: 'Balanced all-round', answers: { level: 'intermediate', playStyles: ['balanced'], powerGeneration: 'balanced', hittingFeel: 'mediumBalanced' } },
  { name: 'Fast doubles and drives', answers: { level: 'advanced', priorities: ['fastDrives'], playStyles: ['fastDoubles'] } },
  { name: 'Beginner-friendly', answers: { level: 'beginner', priorities: ['comfort', 'easyPower'], hittingFeel: 'softComfortable' } },
  { name: 'Tension retention', answers: { priorities: ['tensionRetention'], restringReason: 'tensionLoss' } },
  { name: 'Sound / feedback preference', answers: { priorities: ['sound'], hittingFeel: 'hardCrisp' } },
  { name: 'Contradictory answers (comfort + hard attack)', answers: { priorities: ['comfort', 'hardAttack'], hittingFeel: 'hardCrisp' } },
  { name: 'No answers at all', answers: {} },
]

function fullRanking(answers: QuizAnswers): ScoredString[] {
  const profile = buildPreferenceProfile(answers)
  const specialistWeights = buildSpecialistWeights(answers)
  const budget = Object.values(specialistWeights).reduce((a, b) => a + b, 0)
  return localCatalog
    .map((s) => scoreString(s, profile, specialistWeights, budget, STRING_SPECIALIST_PROFILES))
    .sort((a, b) => b.matchPercent - a.matchPercent || a.string.id.localeCompare(b.string.id))
}

for (const scenario of SCENARIOS) {
  const rec = recommendStrings(scenario.answers, localCatalog, STRING_SPECIALIST_PROFILES)
  const ranking = fullRanking(scenario.answers)

  console.log(`\n=== ${scenario.name} ===`)
  console.log(`archetype: ${ARCHETYPES[rec.dominantArchetype].label}`)
  console.log('top 5:')
  for (const s of ranking.slice(0, 5)) {
    console.log(`  ${s.matchPercent}%  ${s.string.brand} ${s.string.name} (${s.string.id})  top dims: ${s.topDimensions.join(', ')}`)
  }
  console.log(`explanation: ${rec.explanations.best}`)

  const warnings: string[] = []
  if (ranking[0].matchPercent - ranking[1].matchPercent < 1) warnings.push('top 2 are within 1 point — near-tie, check tie-break is sensible')
  if (rec.best.matchPercent >= 98) warnings.push('best match percent is unusually high (>= 98) — check this scenario is genuinely unambiguous')
  if (!rec.crossBrandAlternative) warnings.push('no cross-brand alternative surfaced for this scenario')
  if (warnings.length > 0) {
    console.log(`⚠ warnings: ${warnings.join('; ')}`)
  }
}

console.log('\nDone. This report is for local tuning only — never exposed in the production UI.')
