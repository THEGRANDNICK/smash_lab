// String recommendation engine — pure functions, no UI concerns.
// Builds a weighted preference profile from quiz answers, scores every
// string against it, and picks a practical best match / runner-up /
// "worth considering" alternative while respecting stock availability.
//
// Scoring happens in two layers, kept deliberately separate:
//   1. A weighted-dimension score from the FACTUAL manufacturer ratings
//      in data/strings.ts (repulsion, durability, hittingSound,
//      shockAbsorption, control) — this is the primary signal.
//   2. A small, capped "fit bonus" from data/stringRecommendationMeta.ts
//      (expert/contextual metadata), which can surface a string that's a
//      genuinely strong practical fit even if its raw ratings look modest
//      next to newer strings — without ever touching those raw ratings.

import { strings as allStrings, type StringItem, type StockLevel } from '../data/strings'
import { getRecommendationMeta, type PowerGenerationFit } from '../data/stringRecommendationMeta'
import { DIMENSIONS, ZERO_WEIGHTS, BASELINE_WEIGHT, WEIGHT_CONTRIBUTIONS, type Dimension, type DimensionWeights } from '../config/recommendationWeights'
import {
  POWER_GENERATION_FIT_BONUS,
  POWER_GENERATION_ANSWER_SCALE,
  FEEL_FIT_BONUS,
  MAX_FIT_BONUS,
  HITTING_FEEL_TO_STRING_FEEL,
  OWN_POWER_LEVEL_SCALE,
} from '../config/recommendationModifiers'
import type { QuizAnswers } from './types'

export interface ScoredString {
  string: StringItem
  matchPercent: number
  topDimensions: Dimension[]
  /** Points contributed by recommendation metadata (0 if the string has none, or none matched). */
  metaBonus: number
  metaMatchedPower: boolean
  metaMatchedFeel: boolean
}

export interface StringRecommendation {
  best: ScoredString
  runnerUp?: ScoredString
  thirdPick?: ScoredString
  /** Set when the objectively top-scoring string is unavailable and meaningfully better than `best`. */
  unavailableStandout?: ScoredString
  profile: DimensionWeights
  explanations: {
    best: string
    runnerUp?: string
    thirdPick?: string
  }
}

const DIMENSION_LABELS: Record<Dimension, string> = {
  repulsion: 'power and repulsion',
  durability: 'durability',
  hittingSound: 'a crisp hitting feel and sound',
  shockAbsorption: 'comfort and shock absorption',
  control: 'control',
}

const POWER_FIT_PHRASE: Record<PowerGenerationFit, string> = {
  ownPower: 'you generate plenty of your own power and prefer a harder, more direct feel',
  easyPower: "you'd like the string itself to help generate a bit more easy power",
  balanced: 'you want a comfortable middle ground between power and control',
}

const FEEL_PHRASE: Record<string, string> = {
  hard: 'a crisper, more direct feel',
  soft: 'a softer, more forgiving feel',
  medium: 'a balanced, all-round feel',
}

const AVAILABILITY_RANK_MULTIPLIER: Record<StockLevel, number> = {
  'in-stock': 1,
  'low-stock': 0.97,
  unavailable: 0.82,
}

/** Builds a normalized 0–1 weight profile from the player's answers. */
export function buildPreferenceProfile(answers: QuizAnswers): DimensionWeights {
  const raw: DimensionWeights = { ...ZERO_WEIGHTS }

  for (const dim of DIMENSIONS) raw[dim] += BASELINE_WEIGHT

  for (const [questionId, optionId] of Object.entries(answers)) {
    if (!optionId || typeof optionId !== 'string') continue
    const contributions = WEIGHT_CONTRIBUTIONS[questionId]?.[optionId]
    if (!contributions) continue
    for (const dim of DIMENSIONS) {
      const delta = contributions[dim]
      if (delta) raw[dim] = Math.max(0, raw[dim] + delta)
    }
  }

  const total = DIMENSIONS.reduce((sum, dim) => sum + raw[dim], 0) || 1
  const normalized: DimensionWeights = { ...ZERO_WEIGHTS }
  for (const dim of DIMENSIONS) normalized[dim] = raw[dim] / total
  return normalized
}

interface FitBonusResult {
  bonus: number
  matchedPower: boolean
  matchedFeel: boolean
}

/**
 * Computes the small, capped recommendation-metadata bonus for a string
 * given the player's answers. This never reads or changes the string's
 * manufacturer ratings — it only reflects the separate expert/contextual
 * metadata layer.
 */
function computeFitBonus(item: StringItem, answers: QuizAnswers): FitBonusResult {
  const meta = getRecommendationMeta(item.id)
  if (!meta) return { bonus: 0, matchedPower: false, matchedFeel: false }

  let bonus = 0
  let matchedPower = false
  let matchedFeel = false

  const powerGeneration = answers.powerGeneration
  if (powerGeneration && meta.powerGenerationFit?.includes(powerGeneration as PowerGenerationFit)) {
    let points = POWER_GENERATION_FIT_BONUS * (POWER_GENERATION_ANSWER_SCALE[powerGeneration] ?? 1)
    if (powerGeneration === 'ownPower') {
      points *= OWN_POWER_LEVEL_SCALE[answers.level ?? 'intermediate'] ?? 1
    }
    bonus += points
    matchedPower = true
  }

  const wantedFeel = HITTING_FEEL_TO_STRING_FEEL[answers.hittingFeel ?? '']
  if (wantedFeel && meta.feel === wantedFeel) {
    bonus += FEEL_FIT_BONUS
    matchedFeel = true
  }

  return { bonus: Math.min(bonus, MAX_FIT_BONUS), matchedPower, matchedFeel }
}

/** Scores a single string (0-100) against a weight profile and the player's answers. */
export function scoreString(item: StringItem, profile: DimensionWeights, answers: QuizAnswers): ScoredString {
  const available = DIMENSIONS.filter((dim) => item[dim] != null)
  const weightSum = available.reduce((sum, dim) => sum + profile[dim], 0) || 1

  let weightedRating = 0
  for (const dim of available) {
    const rating = item[dim] as number
    weightedRating += (profile[dim] / weightSum) * rating
  }

  const baseMatchPercent = Math.round((weightedRating / 11) * 100)
  const { bonus, matchedPower, matchedFeel } = computeFitBonus(item, answers)

  const topDimensions = [...available]
    .sort((a, b) => profile[b] * (item[b] as number) - profile[a] * (item[a] as number))
    .slice(0, 2)

  return {
    string: item,
    matchPercent: Math.min(99, Math.max(1, Math.round(baseMatchPercent + bonus))),
    topDimensions,
    metaBonus: bonus,
    metaMatchedPower: matchedPower,
    metaMatchedFeel: matchedFeel,
  }
}

function describeStrengths(scored: ScoredString): string {
  return scored.topDimensions.map((d) => DIMENSION_LABELS[d]).join(' and ')
}

function playerPriorityPhrase(profile: DimensionWeights): string {
  const sorted = [...DIMENSIONS].sort((a, b) => profile[b] - profile[a])
  return sorted.slice(0, 2).map((d) => DIMENSION_LABELS[d]).join(' and ')
}

/** Builds a sentence from recommendation metadata, but only for the parts that actually matched this player's answers. */
function metaFitSentence(scored: ScoredString, answers: QuizAnswers): string | undefined {
  if (!scored.metaMatchedPower && !scored.metaMatchedFeel) return undefined
  const meta = getRecommendationMeta(scored.string.id)
  if (!meta) return undefined

  const parts: string[] = []
  if (scored.metaMatchedPower && answers.powerGeneration) {
    parts.push(POWER_FIT_PHRASE[answers.powerGeneration as PowerGenerationFit])
  }
  if (scored.metaMatchedFeel && meta.feel) {
    parts.push(`you're after ${FEEL_PHRASE[meta.feel]}`)
  }
  if (parts.length === 0) return undefined

  let sentence = `It's a good match for how you hit, too: ${parts.join(' and ')}.`
  if (meta.expertNote) sentence += ` In practice, ${meta.expertNote}.`
  return sentence
}

function buildExplanation(scored: ScoredString, profile: DimensionWeights, answers: QuizAnswers, isBest: boolean): string {
  const { string: s } = scored
  const priorities = playerPriorityPhrase(profile)
  const strengths = describeStrengths(scored)
  const topDimensionSet = new Set(scored.topDimensions)
  const weakestCandidates = DIMENSIONS.filter((d) => !topDimensionSet.has(d))
  const weakestDim = [...weakestCandidates].sort((a, b) => (s[a] ?? 11) - (s[b] ?? 11))[0]
  const weakestValue = weakestDim != null ? s[weakestDim] : undefined

  let text = isBest
    ? `You're looking for ${priorities}. ${s.name} is a strong fit because it delivers on ${strengths}.`
    : `${s.name} is worth considering if you'd rather lean into ${strengths}.`

  if (weakestValue != null && weakestValue <= 7) {
    text += ` The trade-off is ${DIMENSION_LABELS[weakestDim]} — still perfectly usable, just not this string's strongest suit.`
  }

  const metaSentence = metaFitSentence(scored, answers)
  if (metaSentence) text += ` ${metaSentence}`

  if (s.stock === 'unavailable') {
    text += ` Note: this string is currently unavailable, so treat it as a reference point rather than something to order today.`
  } else if (s.stock === 'low-stock') {
    text += ` Only a limited quantity is in stock right now, so grab it soon if you want it.`
  }

  return text
}

const CANDIDATE_MIN_POOL = 4
/** How much lower-scoring a candidate can be and still be offered as a "meaningful alternative" rather than a near-duplicate of the best pick. */
const ALTERNATIVE_WINDOW = 12

export function recommendStrings(answers: QuizAnswers, pool: StringItem[] = allStrings): StringRecommendation {
  const profile = buildPreferenceProfile(answers)
  const scored = pool.map((item) => scoreString(item, profile, answers))

  const byPerformance = [...scored].sort((a, b) => b.matchPercent - a.matchPercent)
  const byPractical = [...scored].sort(
    (a, b) => b.matchPercent * AVAILABILITY_RANK_MULTIPLIER[b.string.stock] - a.matchPercent * AVAILABILITY_RANK_MULTIPLIER[a.string.stock],
  )

  const availableRanked = byPractical.filter((s) => s.string.stock !== 'unavailable')
  const best = availableRanked[0] ?? byPerformance[0]

  const topOverall = byPerformance[0]
  const unavailableStandout =
    topOverall.string.stock === 'unavailable' && topOverall.matchPercent - best.matchPercent >= 3 && topOverall.string.id !== best.string.id
      ? topOverall
      : undefined

  // Prefer a runner-up that represents a genuinely different trade-off (a
  // different primary strength) over a near-duplicate of the best pick,
  // as long as it's still close enough in score to be a plausible choice.
  const otherCandidates = availableRanked.filter((s) => s.string.id !== best.string.id)
  const bestPrimaryDimension = best.topDimensions[0]
  const differentiatedRunnerUp = otherCandidates.find(
    (s) => s.topDimensions[0] !== bestPrimaryDimension && best.matchPercent - s.matchPercent <= ALTERNATIVE_WINDOW,
  )
  const runnerUp = differentiatedRunnerUp ?? otherCandidates[0]

  let thirdPick: ScoredString | undefined
  if (availableRanked.length >= CANDIDATE_MIN_POOL - 1) {
    const usedIds = new Set([best.string.id, runnerUp?.string.id])
    const differentCategory = availableRanked.find(
      (s) => !usedIds.has(s.string.id) && s.string.category !== best.string.category && s.string.category !== runnerUp?.string.category,
    )
    const bestValue = availableRanked
      .filter((s) => !usedIds.has(s.string.id) && s.string.stringCost != null)
      .sort((a, b) => (a.string.stringCost ?? Infinity) - (b.string.stringCost ?? Infinity))[0]

    const candidate = differentCategory ?? bestValue
    if (candidate && best.matchPercent - candidate.matchPercent <= 20) {
      thirdPick = candidate
    }
  }

  return {
    best,
    runnerUp,
    thirdPick,
    unavailableStandout,
    profile,
    explanations: {
      best: buildExplanation(best, profile, answers, true),
      runnerUp: runnerUp ? buildExplanation(runnerUp, profile, answers, false) : undefined,
      thirdPick: thirdPick
        ? `Worth considering if you want a change of pace: ${thirdPick.string.name} leans into ${describeStrengths(thirdPick)}${
            thirdPick.string.stringCost != null && best.string.stringCost != null && thirdPick.string.stringCost < best.string.stringCost
              ? ' at a friendlier price'
              : ''
          }.`
        : undefined,
    },
  }
}
