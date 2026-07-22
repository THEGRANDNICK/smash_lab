// Tension recommendation engine — separate from string selection so either
// can be tuned independently. Reasons like an experienced stringer: an
// existing tension the player is happy with outweighs generic level-based
// defaults, and nothing ever exceeds a stated racket maximum.

import {
  LEVEL_BASE_RANGES,
  GOAL_ADJUSTMENTS,
  POWER_GENERATION_TENSION_ADJUSTMENTS,
  CURRENT_TENSION_FEEL_ADJUSTMENTS,
  UNSURE_BLEND_TOWARD_BASELINE,
  ABSOLUTE_MIN_TENSION,
  ABSOLUTE_MAX_TENSION,
  RACKET_MAX_SAFETY_MARGIN,
  TENSION_ROUNDING_INCREMENT,
  COMPARISON_STEP,
} from '../config/tensionRules'
import type { StringItem } from '../data/strings'
import type { QuizAnswers } from './types'

export interface TensionRecommendation {
  recommendedKg: number
  lowerKg: number
  higherKg: number
  wasCappedByRacketMax: boolean
  racketMaxKg?: number
  explanation: string
}

function round(kg: number): number {
  return Math.round(kg / TENSION_ROUNDING_INCREMENT) * TENSION_ROUNDING_INCREMENT
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

  // Small, string-specific nudge (thinner/livelier strings can hold a hair more usable tension).
  if (string?.tension?.tensionAdjustment) {
    target += string.tension.tensionAdjustment
    reasoning += ` ${string.name}'s construction allows a small additional adjustment.`
  }

  target = clamp(target, ABSOLUTE_MIN_TENSION, ABSOLUTE_MAX_TENSION)

  if (string?.tension?.recommendedMin != null) target = Math.max(target, string.tension.recommendedMin)
  if (string?.tension?.recommendedMax != null) target = Math.min(target, string.tension.recommendedMax)

  let wasCappedByRacketMax = false
  const racketMaxKg = answers.maxTensionKnown === 'yes' ? answers.maxTensionValue : undefined

  if (typeof racketMaxKg === 'number') {
    const alreadyNearMax = knowsCurrent && (answers.currentTensionValue as number) >= racketMaxKg - RACKET_MAX_SAFETY_MARGIN
    const cap = alreadyNearMax ? racketMaxKg : racketMaxKg - RACKET_MAX_SAFETY_MARGIN
    if (target > cap) {
      target = cap
      wasCappedByRacketMax = true
    }
  }

  const recommendedKg = round(target)

  if (wasCappedByRacketMax) {
    reasoning += ` We've kept this within your racket's maximum recommended tension of ${racketMaxKg} kg, with a safety margin.`
  }

  return {
    recommendedKg,
    lowerKg: round(recommendedKg - COMPARISON_STEP),
    higherKg: round(recommendedKg + COMPARISON_STEP),
    wasCappedByRacketMax,
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
