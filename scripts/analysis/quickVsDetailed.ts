// How much does the 4-question quick quiz lose against the detailed quiz?
// Answer space: the 13,200 quick answer sets × own power (3) × play frequency (3) = 118,800,
// all weighted EQUALLY (this is not a model of how often real players pick each answer).
// Compared: best string, top-3 membership, and tension (mean of mains/crosses).
// Limitation: the detailed quiz is not an independent ground truth — both use the same engine.
import { recommendStrings } from '../../src/logic/recommendationEngine.js'
import { recommendTension } from '../../src/logic/tensionRecommendation.js'
import { pct, quickAnswerSpace } from './common.js'

let n = 0, same = 0, inTop3 = 0, sameKg = 0, within05 = 0
for (const quick of quickAnswerSpace())
  for (const powerGeneration of ['needsHelp', 'balanced', 'ownPower'])
    for (const frequency of ['occasionally', 'oneTwoWeek', 'threePlusWeek']) {
      const full = { ...quick, powerGeneration, frequency }
      const a = recommendStrings(full), b = recommendStrings(quick)
      n++
      if (a.best.string.id === b.best.string.id) same++
      if (a.topThree.some((s) => s.string.id === b.best.string.id)) inTop3++
      const ka = recommendTension(full, a.best.string).recommendedKg, kb = recommendTension(quick, b.best.string).recommendedKg
      if (ka === kb) sameKg++
      if (Math.abs(ka - kb) <= 0.5) within05++
    }
console.log(`answer sets: ${n}`)
console.log(`same best string: ${pct(same, n)} | quick pick in detailed top 3: ${pct(inTop3, n)}`)
console.log(`same tension: ${pct(sameKg, n)} | within 0.5 kg: ${pct(within05, n)}`)
