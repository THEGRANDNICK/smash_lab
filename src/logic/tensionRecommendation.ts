// Tension recommendation engine — separate from string selection so either
// can be tuned independently. Reasons like an experienced stringer: an
// existing tension the player is happy with outweighs generic level-based
// defaults, and nothing ever exceeds a stated racket maximum.

import {
  LEVEL_BASE_RANGES,
  BEGINNER_MAX_TENSION,
  GAUGE_TENSION_ADJUSTMENTS,
  MISHIT_TENSION_ADJUSTMENT,
  GOAL_ADJUSTMENTS,
  POWER_GENERATION_TENSION_ADJUSTMENTS,
  CURRENT_TENSION_FEEL_ADJUSTMENTS,
  UNSURE_BLEND_TOWARD_BASELINE,
  ABSOLUTE_MIN_TENSION,
  ABSOLUTE_MAX_TENSION,
  CROSS_OFFSET_KG,
  DEFAULT_RACKET_MAX_KG,
  TENSION_ROUNDING_INCREMENT,
  COMPARISON_STEP,
} from '../config/tensionRules.js'
import type { StringItem } from '../data/strings.js'
import type { QuizAnswers } from './types.js'

export interface TensionRecommendation {
  recommendedKg: number
  lowerKg: number
  /** null when one step firmer would exceed the racket's stated maximum — the UI then shows that option as unavailable. */
  higherKg: number | null
  /** Mains and crosses: the stated tension is their average (crosses CROSS_OFFSET_KG higher). */
  mainsKg: number
  crossKg: number
  wasCappedByRacketMax: boolean
  /** Capped by the typical Yonex maximum because the player didn't give their racket's. */
  cappedByTypicalRacketMax: boolean
  racketMaxKg?: number
  explanation: string
}

function round(kg: number): number {
  return Math.round(kg / TENSION_ROUNDING_INCREMENT) * TENSION_ROUNDING_INCREMENT
}

/** Rounds DOWN to the tension increment — used whenever a value must never end up above a racket maximum. */
function roundDown(kg: number): number {
  return Math.floor(kg / TENSION_ROUNDING_INCREMENT + 1e-9) * TENSION_ROUNDING_INCREMENT
}

/** The string's gauge for tension purposes; for hybrids the thinner side. */
function stringGauge(string: StringItem | undefined): number | undefined {
  if (!string) return undefined
  if (string.isHybrid) {
    const sides = [string.mainString?.gauge, string.crossString?.gauge].filter((g): g is number => typeof g === 'number')
    return sides.length ? Math.min(...sides) : undefined
  }
  return string.tension?.gauge
}

function clamp(kg: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, kg))
}

export function recommendTension(answers: QuizAnswers, string?: StringItem): TensionRecommendation {
  const level = answers.level ?? 'intermediate'
  const baseRange = LEVEL_BASE_RANGES[level] ?? LEVEL_BASE_RANGES.intermediate
  const goalAdjustment = GOAL_ADJUSTMENTS[answers.racketGoal ?? 'balancedGoal'] ?? 0

  const levelBasedTarget = baseRange.target + goalAdjustment

  let target: number
  let reasoning: string

  const knowsCurrent = answers.currentTensionKnown === 'yes' && typeof answers.currentTensionValue === 'number'

  if (knowsCurrent) {
    const current = answers.currentTensionValue as number
    const feel = answers.currentTensionFeel ?? 'notSure'

    if (feel === 'notSure') {
      target = current + (levelBasedTarget - current) * UNSURE_BLEND_TOWARD_BASELINE
      reasoning = `You currently play at ${current} kg and weren't sure how it feels, so we've nudged only slightly toward the typical range for your level.`
    } else {
      const adjustment = CURRENT_TENSION_FEEL_ADJUSTMENTS[feel] ?? 0
      target = current + adjustment
      if (feel === 'aboutRight') {
        reasoning = `Since ${current} kg already feels right to you, we're keeping you close to it rather than changing things for the sake of it.`
      } else if (feel === 'wantPower') {
        reasoning = `Starting from your current ${current} kg, we've eased off slightly to give you more forgiveness and easier power.`
      } else {
        reasoning = `Starting from your current ${current} kg, we've nudged it up slightly for a more direct, controlled feel.`
      }
    }
  } else {
    target = levelBasedTarget
    reasoning = `Based on typical ranges for a ${levelLabel(level)} player and your preference for ${goalLabel(answers.racketGoal)}, ${round(
      target,
    )} kg is a sensible starting point.`
  }

  // Small nudge for self-reported power generation — modest by design, see
  // config/tensionRules.ts. Hard hitters who generate their own power can
  // often handle a touch more directness; players wanting help generating
  // power get a touch more forgiveness. Never a big swing on its own.
  const powerAdjustment = POWER_GENERATION_TENSION_ADJUSTMENTS[answers.powerGeneration ?? 'balanced'] ?? 0
  if (powerAdjustment !== 0) {
    target += powerAdjustment
    reasoning +=
      answers.powerGeneration === 'ownPower'
        ? ' Since you generate plenty of power yourself, we nudged it up slightly for a more direct feel.'
        : ' Since you could use some help generating power, we nudged it down slightly for extra forgiveness.'
  }

  // Thinner strings a little lower (durability), thick strings unchanged — see GAUGE_TENSION_ADJUSTMENTS.
  const gauge = stringGauge(string)
  const gaugeRule = gauge == null ? undefined : GAUGE_TENSION_ADJUSTMENTS.find((rule) => gauge <= rule.maxGauge)
  if (gaugeRule && gaugeRule.adjustKg !== 0) {
    const before = target
    target += gaugeRule.adjustKg
    // Only say so when it actually changes the (rounded) number you'll see.
    if (round(target) !== round(before)) reasoning += ` ${string!.name} is a thin string (${gauge} mm), so we went a little lower to help it last.`
  }

  // Strings breaking from mishits: lower tension forgives off-centre hits.
  if (answers.restringReason === 'mishitBreakage') {
    const before = target
    target += MISHIT_TENSION_ADJUSTMENT
    if (round(target) !== round(before)) reasoning += ' Because your strings often break from mishits, we went a little lower — it forgives off-centre hits.'
  }

  // The level's maximum is a real limit. The one exception: you already play a known tension, you're
  // happy with it, AND you've checked your racket's maximum — then we don't push you below it.
  const levelMax = Math.min(LEVEL_BASE_RANGES[level]?.max ?? ABSOLUTE_MAX_TENSION, level === 'beginner' ? BEGINNER_MAX_TENSION : Infinity)
  const keepsProvenTension =
    answers.currentTensionKnown === 'yes' &&
    typeof answers.currentTensionValue === 'number' &&
    answers.currentTensionFeel === 'aboutRight' &&
    answers.maxTensionKnown === 'yes' &&
    typeof answers.maxTensionValue === 'number'
  if (!keepsProvenTension && target > levelMax) {
    target = levelMax
    reasoning += ` We kept it within the usual maximum for your level (${levelMax} kg).`
  }

  target = clamp(target, ABSOLUTE_MIN_TENSION, ABSOLUTE_MAX_TENSION)

  if (string?.tension?.recommendedMin != null) target = Math.max(target, string.tension.recommendedMin)
  if (string?.tension?.recommendedMax != null) target = Math.min(target, string.tension.recommendedMax)

  let wasCappedByRacketMax = false
  let cappedByTypicalRacketMax = false
  const racketMaxKg = answers.maxTensionKnown === 'yes' ? answers.maxTensionValue : undefined
  // The crosses are strung CROSS_OFFSET_KG above the stated tension and must stay within the
  // racket's maximum. Unknown maximum → what most Yonex rackets allow (DEFAULT_RACKET_MAX_KG).
  const effectiveMaxKg = typeof racketMaxKg === 'number' ? racketMaxKg : DEFAULT_RACKET_MAX_KG
  const statedCap = effectiveMaxKg - CROSS_OFFSET_KG
  if (target > statedCap) {
    target = statedCap
    if (typeof racketMaxKg === 'number') wasCappedByRacketMax = true
    else cappedByTypicalRacketMax = true
  }

  let recommendedKg = round(target)
  // Rounding must never push the crosses above the maximum (e.g. a 12.25 kg cap would round up to 12.5).
  if (recommendedKg > statedCap) {
    recommendedKg = roundDown(statedCap)
    if (typeof racketMaxKg === 'number') wasCappedByRacketMax = true
    else cappedByTypicalRacketMax = true
  }

  // The "firmer" comparison option obeys the same limit.
  let higherKg: number | null = round(recommendedKg + COMPARISON_STEP)
  if (higherKg > statedCap) {
    const firmestAllowed = roundDown(statedCap)
    higherKg = firmestAllowed > recommendedKg ? firmestAllowed : null
  }

  if (wasCappedByRacketMax) {
    reasoning += ` We've kept this within your racket's maximum of ${racketMaxKg} kg — the crosses are strung ${CROSS_OFFSET_KG} kg higher than this.`
  } else if (cappedByTypicalRacketMax) {
    reasoning += ` Most Yonex rackets allow up to ${DEFAULT_RACKET_MAX_KG} kg, and the crosses are strung ${CROSS_OFFSET_KG} kg higher, so we stopped at ${roundDown(statedCap)} kg. If your racket allows more, add its maximum.`
  }

  return {
    recommendedKg,
    lowerKg: round(recommendedKg - COMPARISON_STEP),
    higherKg,
    mainsKg: recommendedKg - CROSS_OFFSET_KG,
    crossKg: recommendedKg + CROSS_OFFSET_KG,
    wasCappedByRacketMax,
    cappedByTypicalRacketMax,
    racketMaxKg,
    explanation: reasoning,
  }
}

function levelLabel(level: string): string {
  switch (level) {
    case 'beginner':
      return 'beginner/recreational'
    case 'intermediate':
      return 'intermediate club'
    case 'advanced':
      return 'advanced club/league'
    case 'tournament':
      return 'tournament-level competitive'
    default:
      return 'club'
  }
}

function goalLabel(goal?: string): string {
  switch (goal) {
    case 'easyPower':
      return 'easier power and a forgiving sweet spot'
    case 'precision':
      return 'more precision and direct feedback'
    default:
      return 'a balance of power and control'
  }
}
