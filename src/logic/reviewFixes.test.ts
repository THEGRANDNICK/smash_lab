import { describe, it, expect } from 'vitest'
import { recommendTension } from './tensionRecommendation'
import { buildAlternativeReasons } from './recommendationExplanation'
import { strings } from '../data/strings'
import type { ScoredString } from './recommendationEngine'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'

const bg80 = strings.find((s) => s.id === 'yonex-bg80')!
const LBS = 0.4536

describe('tension never exceeds the racket maximum', () => {
  it('Arcsaber 11 Pro 4U (27 lbs): the firmer option is withheld instead of showing 12.5 kg', () => {
    const t = recommendTension(
      { level: 'advanced', racketGoal: 'precision', currentTensionKnown: 'yes', currentTensionValue: 26 * LBS, currentTensionFeel: 'aboutRight', maxTensionKnown: 'yes', maxTensionValue: 27 * LBS },
      bg80,
    )
    expect(t.recommendedKg).toBeLessThanOrEqual(27 * LBS)
    expect(t.higherKg).toBeNull()
  })

  it('every shown option stays within the maximum across a sweep of maxima and current tensions', () => {
    for (let max = 10; max <= 13.5; max += 0.05) {
      for (const current of [9, 10, 11, 11.5, 12, 12.5, 13]) {
        for (const feel of ['aboutRight', 'wantControl', 'wantPower', 'notSure']) {
          const t = recommendTension({ level: 'tournament', racketGoal: 'precision', currentTensionKnown: 'yes', currentTensionValue: current, currentTensionFeel: feel, maxTensionKnown: 'yes', maxTensionValue: max }, bg80)
          expect(t.recommendedKg).toBeLessThanOrEqual(max + 1e-9)
          if (t.higherKg != null) {
            expect(t.higherKg).toBeLessThanOrEqual(max + 1e-9)
            expect(t.higherKg).toBeGreaterThan(t.recommendedKg)
          }
        }
      }
    }
  })

  it('without a known maximum the firmer option is simply +0.5 kg', () => {
    const t = recommendTension({ level: 'advanced' }, bg80)
    expect(t.higherKg).toBe(t.recommendedKg + 0.5)
  })
})

describe('alternative reasons', () => {
  const scored = (id: string, stringCost: number): ScoredString => ({ string: { ...bg80, id, stringCost }, matchPercent: 80, topDimensions: [], topSpecialistDims: [], specialistInfluence: 0 })
  const profile = (dims: StringSpecialistProfile['dimensions']): StringSpecialistProfile => ({ experienceSource: 'personal', confidence: 'high', dimensions: dims })

  it('does not call a 25-cent difference "lower price"', () => {
    expect(buildAlternativeReasons(scored('a', 5.75), scored('b', 6), undefined, undefined)).not.toContain('Lower price than the Best Match.')
  })

  it('prefers hands-on comparisons over manufacturer ratings', () => {
    const reasons = buildAlternativeReasons(scored('a', 6), scored('b', 6), profile({ controlPrecision: 5 }), profile({ controlPrecision: 2.75 }))
    expect(reasons[0]).toBe('More precise control than the Best Match (hands-on).')
  })
})

describe('beginner suitability falls back to the gauge when nobody rated it', () => {
  it('thin strings stop winning beginner results just because their paper ratings are high', async () => {
    const { recommendStrings } = await import('./recommendationEngine')
    const combos = (a: string[], k: number): string[][] => (k === 0 ? [[]] : a.flatMap((x, i) => combos(a.slice(i + 1), k - 1).map((c) => [x, ...c])))
    const prios = [...combos(['easyPower', 'hardAttack', 'fastDrives', 'directPrecision', 'durability', 'comfort', 'sound'], 1), ...combos(['easyPower', 'hardAttack', 'fastDrives', 'directPrecision', 'durability', 'comfort', 'sound'], 2)]
    let thin = 0
    let n = 0
    for (const priorities of prios) {
      for (const hittingFeel of ['hardCrisp', 'mediumBalanced', 'softComfortable', 'dontKnow']) {
        const best = recommendStrings({ level: 'beginner', playStyles: ['balanced'], powerGeneration: 'needsHelp', priorities, hittingFeel }).best.string
        n++
        if ((best.tension?.gauge ?? 1) <= 0.63 || best.isHybrid) thin++
      }
    }
    // Before the gauge fallback, Exbolt 63 (0.63) and AeroBite (0.61 crosses) together took about a third of beginner results.
    expect(thin / n).toBeLessThan(0.25)
  })
})
