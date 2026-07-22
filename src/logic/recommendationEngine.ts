// String recommendation engine — pure functions, no UI concerns.
// Builds a weighted preference profile from quiz answers, scores every
// string against it, and picks a practical best match / runner-up /
// "worth considering" alternative while respecting stock availability.

import { strings as allStrings, type StringItem, type StockLevel } from '../data/strings'
import { DIMENSIONS, ZERO_WEIGHTS, BASELINE_WEIGHT, WEIGHT_CONTRIBUTIONS, type Dimension, type DimensionWeights } from '../config/recommendationWeights'
import type { QuizAnswers } from './types'

export interface ScoredString {
  string: StringItem
  matchPercent: number
  topDimensions: Dimension[]
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

/** Scores a single string (0-100) against a weight profile, ignoring unknown attributes. */
export function scoreString(item: StringItem, profile: DimensionWeights): ScoredString {
  const available = DIMENSIONS.filter((dim) => item[dim] != null)
  const weightSum = available.reduce((sum, dim) => sum + profile[dim], 0) || 1

  let weightedRating = 0
  for (const dim of available) {
    const rating = item[dim] as number
    weightedRating += (profile[dim] / weightSum) * rating
  }

  const matchPercent = Math.round((weightedRating / 11) * 100)

  const topDimensions = [...available]
    .sort((a, b) => profile[b] * (item[b] as number) - profile[a] * (item[a] as number))
    .slice(0, 2)

  return { string: item, matchPercent: Math.min(99, Math.max(1, matchPercent)), topDimensions }
}

function describeStrengths(scored: ScoredString): string {
  return scored.topDimensions.map((d) => DIMENSION_LABELS[d]).join(' and ')
}

function playerPriorityPhrase(profile: DimensionWeights): string {
  const sorted = [...DIMENSIONS].sort((a, b) => profile[b] - profile[a])
  return sorted.slice(0, 2).map((d) => DIMENSION_LABELS[d]).join(' and ')
}

function buildExplanation(scored: ScoredString, profile: DimensionWeights, isBest: boolean): string {
  const { string: s } = scored
  const priorities = playerPriorityPhrase(profile)
  const strengths = describeStrengths(scored)
  const topDimensionSet = new Set(scored.topDimensions)
  const weakestCandidates = DIMENSIONS.filter((d) => !topDimensionSet.has(d))
  const weakestDim = [...weakestCandidates].sort((a, b) => (s[a] ?? 11) - (s[b] ?? 11))[0]
  const weakestValue = weakestDim != null ? s[weakestDim] : undefined

  let text = isBest
    ? `You prioritized ${priorities}. ${s.name} scores strongly across both`
    : `If you'd rather lean into ${strengths}, ${s.name} is a great alternative`

  text += isBest ? `, with its best characteristics being ${strengths}.` : '.'

  if (weakestValue != null && weakestValue <= 7) {
    text += ` One trade-off: it's comparatively lighter on ${DIMENSION_LABELS[weakestDim]}, so keep that in mind if that matters to you.`
  }

  if (s.stock === 'unavailable') {
    text += ` Note: this string is currently unavailable, so treat it as a reference point rather than something to order today.`
  } else if (s.stock === 'low-stock') {
    text += ` Only a limited quantity is in stock right now, so grab it soon if you want it.`
  }

  return text
}

const CANDIDATE_MIN_POOL = 4

export function recommendStrings(answers: QuizAnswers, pool: StringItem[] = allStrings): StringRecommendation {
  const profile = buildPreferenceProfile(answers)
  const scored = pool.map((item) => scoreString(item, profile))

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

  const runnerUp = availableRanked.find((s) => s.string.id !== best.string.id)

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
      best: buildExplanation(best, profile, true) + (unavailableStandout ? ` (${unavailableStandout.string.name} scores marginally higher on paper but is currently unavailable.)` : ''),
      runnerUp: runnerUp ? buildExplanation(runnerUp, profile, false) : undefined,
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
