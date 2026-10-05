// Smash Lab v2 — the string/tension guidance from Badminton Insight's "What Badminton String &
// Tension Should You Use?" (Aug 2026), pinned as tests so it can't silently drift.
import { describe, it, expect } from 'vitest'
import { recommendTension } from './tensionRecommendation'
import { recommendStrings, applyBeginnerGaugeGuardrail, BEGINNER_MIN_GAUGE } from './recommendationEngine'
import { strings } from '../data/strings'
import { SORT_OPTIONS } from './sortStrings'
import { LEVEL_BASE_RANGES } from '../config/tensionRules'

const byId = (id: string) => strings.find((s) => s.id === id)!
const bg80 = byId('yonex-bg80') // 0.68 mm
const exbolt63 = byId('yonex-exbolt-63') // 0.63 mm
const bg65 = byId('yonex-bg65') // 0.70 mm

describe('tension ranges: beginners per the video, club players per the stringer', () => {
  it('beginners at most 24 lb (stated as 11 kg in the video)', () => {
    expect(LEVEL_BASE_RANGES.beginner.max).toBe(11)
  })
  it('club players: 11.5 kg, at most 12 kg', () => {
    expect(LEVEL_BASE_RANGES.intermediate.target).toBe(11.5)
    expect(LEVEL_BASE_RANGES.intermediate.max).toBe(12)
    expect(LEVEL_BASE_RANGES.advanced.max).toBe(12)
  })

  it('a beginner never gets more than 11 kg unless they already play a higher, known tension', () => {
    for (const goal of ['easyPower', 'balancedGoal', 'precision']) {
      for (const power of ['needsHelp', 'balanced', 'ownPower']) {
        expect(recommendTension({ level: 'beginner', racketGoal: goal, powerGeneration: power }, bg65).recommendedKg).toBeLessThanOrEqual(11)
      }
    }
    // the one exception: a known tension you're happy with AND a checked racket maximum
    const proven = recommendTension({ level: 'beginner', currentTensionKnown: 'yes', currentTensionValue: 11.5, currentTensionFeel: 'aboutRight', maxTensionKnown: 'yes', maxTensionValue: 13 }, bg65)
    expect(proven.recommendedKg).toBeGreaterThan(11)
    // not happy with it, or racket max unchecked → the level limit applies
    expect(recommendTension({ level: 'beginner', currentTensionKnown: 'yes', currentTensionValue: 12, currentTensionFeel: 'wantControl', maxTensionKnown: 'yes', maxTensionValue: 14 }, bg65).recommendedKg).toBeLessThanOrEqual(11)
    expect(recommendTension({ level: 'beginner', currentTensionKnown: 'yes', currentTensionValue: 11.5, currentTensionFeel: 'aboutRight' }, bg65).recommendedKg).toBeLessThanOrEqual(11)
  })
})

describe('level limits are real limits (review findings, Oct 2026)', () => {
  it('a club player with a precision goal, own power and a 14 kg racket still stays at 12 kg', () => {
    expect(recommendTension({ level: 'intermediate', racketGoal: 'precision', powerGeneration: 'ownPower', maxTensionKnown: 'yes', maxTensionValue: 14 }, bg80).recommendedKg).toBeLessThanOrEqual(12)
  })
  it('an adjustment is only explained when it changes the number you see', () => {
    const t = recommendTension({ level: 'intermediate' }, byId('yonex-exbolt-65'))
    if (t.recommendedKg === recommendTension({ level: 'intermediate' }, bg65).recommendedKg) expect(t.explanation).not.toMatch(/thin string/)
  })
})

describe('tournament players follow the video (Greg 30 lb, Jenny 29 lb)', () => {
  it('with a racket rated for it, a tournament player can reach the presenters’ range', () => {
    const t = recommendTension({ level: 'tournament', racketGoal: 'precision', powerGeneration: 'ownPower', maxTensionKnown: 'yes', maxTensionValue: 14.5 }, bg80)
    expect(t.recommendedKg).toBeGreaterThanOrEqual(12.5)
    expect(t.recommendedKg).toBeLessThanOrEqual(13.6)
  })
  it('without a checked racket maximum it still stops at 12 kg (crosses ≤ 12.5 kg)', () => {
    expect(recommendTension({ level: 'tournament', racketGoal: 'precision', powerGeneration: 'ownPower' }, bg80).crossKg).toBeLessThanOrEqual(12.5)
  })
})

describe('mains, crosses and the racket maximum', () => {
  it('crosses are 1 kg above the mains; the stated tension is their average', () => {
    const t = recommendTension({ level: 'intermediate' }, bg80)
    expect(t.crossKg - t.mainsKg).toBe(1)
    expect((t.crossKg + t.mainsKg) / 2).toBe(t.recommendedKg)
  })
  it('without a known racket max, nothing above 12 kg — the crosses would pass the 12.5 kg most Yonex rackets allow', () => {
    for (const level of ['beginner', 'intermediate', 'advanced', 'tournament']) {
      for (const goal of ['easyPower', 'balancedGoal', 'precision']) {
        const t = recommendTension({ level, racketGoal: goal, powerGeneration: 'ownPower' }, bg80)
        expect(t.recommendedKg).toBeLessThanOrEqual(12)
        expect(t.crossKg).toBeLessThanOrEqual(12.5)
        expect(t.higherKg ?? 0).toBeLessThanOrEqual(12)
      }
    }
  })
  it('a racket rated higher allows more; the crosses still never pass its maximum', () => {
    const t = recommendTension({ level: 'tournament', racketGoal: 'precision', powerGeneration: 'ownPower', maxTensionKnown: 'yes', maxTensionValue: 13.5 }, bg80)
    expect(t.recommendedKg).toBeGreaterThan(12)
    expect(t.crossKg).toBeLessThanOrEqual(13.5)
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
