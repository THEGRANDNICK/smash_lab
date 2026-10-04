// How should a hands-on property nobody has rated be treated? Compares the three modes of
// recommendationEngine (see the note above setUnratedHandsOnMode) over all 13,200 quick answer sets.
// Reported: how often strings with NO hands-on ratings (and with fewer than 5) end up as the best
// pick, the most frequent winners, and two reference players.
// Limitation: shows each rule's consequences, not which one is right for real players.
import { recommendStrings, setUnratedHandsOnMode, type UnratedHandsOnMode } from '../../src/logic/recommendationEngine.js'
import { STRING_SPECIALIST_PROFILES } from '../../src/data/stringSpecialistProfiles.js'
import type { QuizAnswers } from '../../src/logic/types.js'
import { pct, quickAnswerSpace } from './common.js'

const space = quickAnswerSpace()
const ratings = (id: string) => Object.keys(STRING_SPECIALIST_PROFILES[id]?.dimensions ?? {}).length
const attacker: QuizAnswers = { level: 'advanced', playStyles: ['aggressive'], priorities: ['hardAttack', 'directPrecision'], hittingFeel: 'hardCrisp', powerGeneration: 'ownPower' }
const beginner: QuizAnswers = { level: 'beginner', priorities: ['easyPower', 'comfort'], hittingFeel: 'dontKnow' }
for (const mode of ['midpoint', 'estimate', 'estimateWithCoverage'] as UnratedHandsOnMode[]) {
  setUnratedHandsOnMode(mode)
  const wins: Record<string, number> = {}
  let none = 0, few = 0
  for (const a of space) {
    const id = recommendStrings(a).best.string.id
    wins[id] = (wins[id] ?? 0) + 1
    if (ratings(id) === 0) none++
    if (ratings(id) < 5) few++
  }
  const top3 = (a: QuizAnswers) => recommendStrings(a).topThree.map((s) => s.string.name).join(' / ')
  console.log(`${mode}: wins by unrated strings ${pct(none, space.length)} · by strings with <5 ratings ${pct(few, space.length)}`)
  console.log(`   winners: ${Object.entries(wins).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${pct(v, space.length)}`).join(', ')}`)
  console.log(`   attacker: ${top3(attacker)} | beginner: ${top3(beginner)}`)
}
setUnratedHandsOnMode('midpoint')
