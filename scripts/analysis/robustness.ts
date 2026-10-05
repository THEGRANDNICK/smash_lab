// How sensitive is the ranking to the hands-on ratings of ONE person?
// Method: every rated hands-on value is shifted by uniform noise in [-amount, +amount], rounded to
// the nearest 0.5 and clamped to 1–5; unrated (missing) dimensions stay missing. 8 runs per amount
// (seed 7), on every 6th quick answer set (2,200 sets). Reported: how often the best string changes,
// whether the new one was already in the original top 3, and the change rate by the original lead
// of #1 over #2 (in model points).
// Limitation: random noise tests STABILITY, not systematic bias (e.g. one rater preferring one string)
// and says nothing about whether any recommendation is right for real players.
import { recommendStrings } from '../../src/logic/recommendationEngine.js'
import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile } from '../../src/data/stringSpecialistProfiles.js'
import { pct, quickAnswerSpace, seededRandom } from './common.js'

const SEED = 7, RUNS = 8
const sample = quickAnswerSpace().filter((_, i) => i % 6 === 0)
const base = sample.map((a) => {
  const r = recommendStrings(a, undefined, STRING_SPECIALIST_PROFILES)
  return { best: r.best.string.id, lead: r.ranked[0].matchPercent - r.ranked[1].matchPercent, top3: r.topThree.map((s) => s.string.id) }
})
const bucket = (lead: number) => (lead <= 2 ? '0–2' : lead <= 5 ? '3–5' : '6+')
console.log(`answer sets: ${sample.length} | runs per amount: ${RUNS} | seed: ${SEED}`)
console.log(`share of answer sets by lead: ${['0–2', '3–5', '6+'].map((b) => `${b}: ${pct(base.filter((x) => bucket(x.lead) === b).length, base.length)}`).join(' | ')}`)
for (const amount of [0.5, 1]) {
  const rnd = seededRandom(SEED)
  let n = 0, flips = 0, inTop3 = 0
  const by: Record<string, [number, number]> = { '0–2': [0, 0], '3–5': [0, 0], '6+': [0, 0] }
  for (let run = 0; run < RUNS; run++) {
    const noisy: Record<string, StringSpecialistProfile> = {}
    for (const [id, p] of Object.entries(STRING_SPECIALIST_PROFILES) as [string, StringSpecialistProfile][]) {
      const dims: Record<string, number> = {}
      for (const [k, v] of Object.entries(p.dimensions)) if (typeof v === 'number') dims[k] = Math.min(5, Math.max(1, Math.round((v + (rnd() * 2 - 1) * amount) * 2) / 2))
      noisy[id] = { ...p, dimensions: dims }
    }
    sample.forEach((a, i) => {
      const best = recommendStrings(a, undefined, noisy).best.string.id
      const flipped = best !== base[i].best
      n++
      if (flipped) flips++
      if (base[i].top3.includes(best)) inTop3++
      const b = by[bucket(base[i].lead)]
      b[0] += flipped ? 1 : 0
      b[1]++
    })
  }
  console.log(`±${amount}: best changes ${pct(flips, n)} | new best already in original top 3 ${pct(inTop3, n)} | change rate by lead: ${Object.entries(by).map(([k, [f, c]]) => `${k}: ${pct(f, c)}`).join(' | ')}`)
}
