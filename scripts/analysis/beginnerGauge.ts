// How often does a beginner's best string end up thinner than 0.68 mm? (the guardrail's effect)
// Answer space: all quick answer sets with level = beginner, plus own power (3) = 9,900 sets.
// Limitation: shows the rule works as built — not that thicker strings are better for beginners.
import { recommendStrings } from '../../src/logic/recommendationEngine.js'
import { pct, quickAnswerSpace } from './common.js'

let n = 0, thin = 0
const wins: Record<string, number> = {}
for (const quick of quickAnswerSpace().filter((a) => a.level === 'beginner'))
  for (const powerGeneration of ['needsHelp', 'balanced', 'ownPower']) {
    const s = recommendStrings({ ...quick, powerGeneration }).best.string
    const g = s.isHybrid ? Math.min(s.mainString?.gauge ?? 9, s.crossString?.gauge ?? 9) : s.tension?.gauge
    n++
    if (g != null && g < 0.68) thin++
    wins[s.id] = (wins[s.id] ?? 0) + 1
  }
console.log(`beginner answer sets: ${n} | best string thinner than 0.68 mm: ${pct(thin, n)}`)
console.log('most frequent:', Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${pct(v, n)}`).join(', '))
