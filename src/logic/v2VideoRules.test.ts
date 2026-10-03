// Smash Lab v2 — the string/tension guidance from Badminton Insight's "What Badminton String &
// Tension Should You Use?" (Aug 2026), pinned as tests so it can't silently drift.
import { describe, it, expect } from 'vitest'
import { recommendTension } from './tensionRecommendation'
import { recommendStrings, applyBeginnerGaugeGuardrail, BEGINNER_MIN_GAUGE } from './recommendationEngine'
import { strings } from '../data/strings'
import { SORT_OPTIONS } from './sortStrings'
import { LEVEL_BASE_RANGES } from '../config/tensionRules'

const LB = 0.45359237
const byId = (id: string) => strings.find((s) => s.id === id)!
const bg80 = byId('yonex-bg80') // 0.68 mm
const exbolt63 = byId('yonex-exbolt-63') // 0.63 mm
const bg65 = byId('yonex-bg65') // 0.70 mm

describe('tension ranges by level follow the video', () => {
  it('beginner at most 24 lb, intermediate 24–27 lb, advanced from 27 lb', () => {
    expect(LEVEL_BASE_RANGES.beginner.max).toBe(11) // the video: "maximum 24 lb, also stated as 11 kg"
    expect(LEVEL_BASE_RANGES.intermediate.min).toBeCloseTo(24 * LB, 1)
    expect(LEVEL_BASE_RANGES.intermediate.max).toBeCloseTo(27 * LB, 1)
    expect(LEVEL_BASE_RANGES.advanced.min).toBeCloseTo(27 * LB, 1)
  })

  it('a beginner never gets more than 24 lb unless they already play a higher, known tension', () => {
    for (const goal of ['easyPower', 'balancedGoal', 'precision']) {
      for (const power of ['needsHelp', 'balanced', 'ownPower']) {
        expect(recommendTension({ level: 'beginner', racketGoal: goal, powerGeneration: power }, bg65).recommendedKg).toBeLessThanOrEqual(11)
      }
    }
    const known = recommendTension({ level: 'beginner', currentTensionKnown: 'yes', currentTensionValue: 11.5, currentTensionFeel: 'aboutRight' }, bg65)
    expect(known.recommendedKg).toBeGreaterThan(11)
  })
})

describe('thinner strings and mishits → lower tension', () => {
  it('a thin string gets less tension than a thick one, all else equal', () => {
    const answers = { level: 'advanced' }
    expect(recommendTension(answers, exbolt63).recommendedKg).toBeLessThan(recommendTension(answers, bg65).recommendedKg)
  })
  it('frequent mishit breakage lowers the tension', () => {
    const base = { level: 'intermediate', priorities: ['durability'] }
    expect(recommendTension({ ...base, restringReason: 'mishitBreakage' }, bg80).recommendedKg).toBeLessThan(recommendTension({ ...base, restringReason: 'wearFraying' }, bg80).recommendedKg)
  })
})

describe('beginners get around 0.70 mm', () => {
  it('thin strings move down the ranking for beginners only', () => {
    const scored = { string: exbolt63, matchPercent: 90, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 }
    expect(applyBeginnerGaugeGuardrail(scored, { level: 'beginner' }).matchPercent).toBeLessThan(90)
    expect(applyBeginnerGaugeGuardrail(scored, { level: 'advanced' }).matchPercent).toBe(90)
    const thick = { ...scored, string: bg65 }
    expect(applyBeginnerGaugeGuardrail(thick, { level: 'beginner' }).matchPercent).toBe(90)
  })
  it('a typical beginner is recommended a string of at least 0.68 mm', () => {
    const best = recommendStrings({ level: 'beginner', playStyles: ['balanced'], powerGeneration: 'needsHelp', priorities: ['easyPower'], hittingFeel: 'dontKnow' }).best.string
    expect(best.tension?.gauge ?? 0.7).toBeGreaterThanOrEqual(BEGINNER_MIN_GAUGE)
  })
})

describe('no prices on the public site', () => {
  it('there is no sort by price', () => {
    expect(SORT_OPTIONS.map((o) => o.id)).not.toContain('priceAsc')
    expect(SORT_OPTIONS.map((o) => o.id)).not.toContain('priceDesc')
  })
})
