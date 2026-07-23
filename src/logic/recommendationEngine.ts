// String recommendation engine — pure functions, no UI concerns.
// Builds a weighted preference profile from quiz answers, scores every
// string against it, and picks a practical best match / cross-brand
// alternative / optional specialist choice while respecting stock
// availability.
//
// Scoring blends two deliberately separate layers:
//   1. MANUFACTURER DATA — a weighted-dimension score from the factual
//      ratings in data/strings.ts (repulsion, durability, hittingSound,
//      shockAbsorption, control). Always present, always the floor.
//   2. SMASH LAB SPECIALIST KNOWLEDGE — a confidence- and relevance-scaled
//      score from data/stringSpecialistProfiles.ts. This is what lets a
//      string with modest manufacturer numbers (BG80) or an older, simple
//      string (BG65) win specific profiles it's genuinely suited to,
//      without the manufacturer numbers themselves ever being touched.
//      Strings with no specialist profile are scored on manufacturer data
//      alone — they are never penalized for lacking one.

import { strings as allStrings, type StringItem } from '../data/strings'
import {
  getSpecialistProfile,
  type StringSpecialistProfile,
  type SpecialistDimensionKey,
  type SpecialistDimensions,
  type Confidence,
} from '../data/stringSpecialistProfiles'
import { DIMENSIONS, ZERO_WEIGHTS, BASELINE_WEIGHT, WEIGHT_CONTRIBUTIONS, type Dimension, type DimensionWeights } from '../config/recommendationWeights'
import { SPECIALIST_WEIGHT_CONTRIBUTIONS, CONFIDENCE_TRUST, SPECIALIST_MAX_INFLUENCE, type SpecialistWeights } from '../config/specialistWeights'
import { quizQuestions } from '../data/quizQuestions'
import type { QuizAnswers } from './types'

export interface ScoredString {
  string: StringItem
  matchPercent: number
  /** Manufacturer-dimension strengths, for the hero badge chips. */
  topDimensions: Dimension[]
  /** Specialist-dimension strengths (empty if the string has no specialist profile, or nothing was relevant). */
  topSpecialistDims: SpecialistDimensionKey[]
  /** 0–1: how much the specialist layer actually shifted this string's score for this player. */
  specialistInfluence: number
}

export interface StringRecommendation {
  /** The objectively best-fitting string for this player, regardless of stock — availability is presentation, not a compatibility filter. */
  best: ScoredString
  /** Set only when `best` is unavailable: the best-scoring string a player can actually get right now. */
  bestAvailable?: ScoredString
  /** Best-scoring string from a different brand than `best`, if one is credibly close — chosen on fit alone, ignoring stock. */
  crossBrandAlternative?: ScoredString
  /** An optional, genuinely differentiated third option — never forced if nothing fits. Chosen on fit alone, ignoring stock. */
  specialistChoice?: ScoredString
  profile: DimensionWeights
  explanations: {
    best: string
    bestAvailable?: string
    crossBrandAlternative?: string
    specialistChoice?: string
  }
}

const DIMENSION_LABELS: Record<Dimension, string> = {
  repulsion: 'power and repulsion',
  durability: 'durability',
  hittingSound: 'a crisp hitting feel and sound',
  shockAbsorption: 'comfort and shock absorption',
  control: 'control',
}

const ALL_SPECIALIST_KEYS: SpecialistDimensionKey[] = [
  'hardHitterFit',
  'easyPower',
  'attackSmash',
  'fastDoubles',
  'flatDriveGame',
  'controlPrecision',
  'shuttleGripHold',
  'netTechnical',
  'comfort',
  'directness',
  'softness',
  'tensionRetention',
  'normalWearDurability',
  'mishitTolerance',
  'beginnerFriendliness',
  'value',
  'allRoundSuitability',
]

// ---------------------------------------------------------------------------
// Layer 1: manufacturer-data preference profile (unchanged in spirit from
// earlier versions, just generalized to handle multi-select answers).
// ---------------------------------------------------------------------------

function eachAnswer(answers: QuizAnswers, fn: (questionId: string, optionId: string) => void) {
  for (const [questionId, value] of Object.entries(answers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const optionId of value) {
        if (typeof optionId === 'string') fn(questionId, optionId)
      }
    } else if (typeof value === 'string') {
      fn(questionId, value)
    }
  }
}

/** Builds a normalized 0–1 weight profile from the player's answers. */
export function buildPreferenceProfile(answers: QuizAnswers): DimensionWeights {
  const raw: DimensionWeights = { ...ZERO_WEIGHTS }
  for (const dim of DIMENSIONS) raw[dim] += BASELINE_WEIGHT

  eachAnswer(answers, (questionId, optionId) => {
    const contributions = WEIGHT_CONTRIBUTIONS[questionId]?.[optionId]
    if (!contributions) return
    for (const dim of DIMENSIONS) {
      const delta = contributions[dim]
      if (delta) raw[dim] = Math.max(0, raw[dim] + delta)
    }
  })

  const total = DIMENSIONS.reduce((sum, dim) => sum + raw[dim], 0) || 1
  const normalized: DimensionWeights = { ...ZERO_WEIGHTS }
  for (const dim of DIMENSIONS) normalized[dim] = raw[dim] / total
  return normalized
}

function scoreManufacturer(item: StringItem, profile: DimensionWeights): { percent: number; topDimensions: Dimension[] } {
  const available = DIMENSIONS.filter((dim) => item[dim] != null)
  const weightSum = available.reduce((sum, dim) => sum + profile[dim], 0) || 1

  let weightedRating = 0
  for (const dim of available) {
    weightedRating += (profile[dim] / weightSum) * (item[dim] as number)
  }

  const percent = Math.round((weightedRating / 11) * 100)
  const topDimensions = [...available].sort((a, b) => profile[b] * (item[b] as number) - profile[a] * (item[a] as number)).slice(0, 2)

  return { percent, topDimensions }
}

// ---------------------------------------------------------------------------
// Layer 2: Smash Lab specialist knowledge — a separate weight vector across
// the specialist dimensions, built the same way as the manufacturer one but
// with no baseline (a string with zero relevant specialist data for this
// player should fall back to pure manufacturer scoring, not get penalized).
// ---------------------------------------------------------------------------

type SpecialistWeightVector = Record<SpecialistDimensionKey, number>

export function buildSpecialistWeights(answers: QuizAnswers): SpecialistWeightVector {
  const raw = Object.fromEntries(ALL_SPECIALIST_KEYS.map((k) => [k, 0])) as SpecialistWeightVector

  eachAnswer(answers, (questionId, optionId) => {
    const contributions: SpecialistWeights | undefined = SPECIALIST_WEIGHT_CONTRIBUTIONS[questionId]?.[optionId]
    if (!contributions) return
    for (const key of ALL_SPECIALIST_KEYS) {
      const delta = contributions[key]
      if (delta) raw[key] += delta
    }
  })

  return raw
}

function dimensionConfidence(profile: StringSpecialistProfile, dim: SpecialistDimensionKey): Confidence {
  return profile.dimensionConfidence?.[dim] ?? profile.confidence
}

interface SpecialistScoreResult {
  percent: number
  /** How much of the player's total specialist-weight budget this string's known dims actually cover, 0–1. */
  relevance: number
  confidenceMultiplier: number
  topDims: SpecialistDimensionKey[]
}

function scoreSpecialist(item: StringItem, specialistWeights: SpecialistWeightVector, totalWeightBudget: number): SpecialistScoreResult | undefined {
  const profile = getSpecialistProfile(item.id)
  if (!profile) return undefined

  const availableDims = (Object.entries(profile.dimensions) as [SpecialistDimensionKey, number | undefined][]).filter(
    (entry): entry is [SpecialistDimensionKey, number] => entry[1] != null,
  )
  if (availableDims.length === 0) return undefined

  const weightSum = availableDims.reduce((sum, [key]) => sum + specialistWeights[key], 0)
  if (weightSum <= 0.0001) return undefined // player's answers don't touch anything this string has specialist data for

  let weightedValue = 0
  let trustWeighted = 0
  for (const [key, value] of availableDims) {
    const w = specialistWeights[key]
    weightedValue += w * value
    trustWeighted += w * CONFIDENCE_TRUST[dimensionConfidence(profile, key)]
  }

  const percent = (weightedValue / weightSum / 5) * 100
  const confidenceMultiplier = trustWeighted / weightSum
  const relevance = totalWeightBudget > 0 ? Math.min(1, weightSum / totalWeightBudget) : 0

  const topDims = [...availableDims].sort((a, b) => specialistWeights[b[0]] * b[1] - specialistWeights[a[0]] * a[1]).map(([key]) => key).slice(0, 2)

  return { percent, relevance, confidenceMultiplier, topDims }
}

/** Scores a single string by blending manufacturer data with Smash Lab specialist knowledge. */
export function scoreString(item: StringItem, profile: DimensionWeights, specialistWeights: SpecialistWeightVector, specialistBudget: number): ScoredString {
  const manufacturer = scoreManufacturer(item, profile)
  const specialist = scoreSpecialist(item, specialistWeights, specialistBudget)

  let finalPercent = manufacturer.percent
  let influence = 0
  let topSpecialistDims: SpecialistDimensionKey[] = []

  if (specialist) {
    influence = SPECIALIST_MAX_INFLUENCE * specialist.confidenceMultiplier * specialist.relevance
    finalPercent = manufacturer.percent * (1 - influence) + specialist.percent * influence
    topSpecialistDims = specialist.topDims
  }

  return {
    string: item,
    matchPercent: Math.min(99, Math.max(1, Math.round(finalPercent))),
    topDimensions: manufacturer.topDimensions,
    topSpecialistDims,
    specialistInfluence: influence,
  }
}

// ---------------------------------------------------------------------------
// Natural-language explanations. Strings with a specialist profile lean on
// its own (already natural) strengths/weaknesses text; strings without one
// fall back to describing the manufacturer dimensions.
// ---------------------------------------------------------------------------

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s
}

function describeManufacturerStrengths(scored: ScoredString): string {
  return scored.topDimensions.map((d) => DIMENSION_LABELS[d]).join(' and ')
}

/** Builds a natural phrase from the player's actual selections (not from derived weights) — e.g. "hard-hitting attack and direct precision". */
function playerAskPhrase(answers: QuizAnswers): string {
  const parts: string[] = []
  const priorityLabels = optionLabels('priorities', answers.priorities)
  const styleLabels = optionLabels('playStyles', answers.playStyles)
  parts.push(...priorityLabels.slice(0, 2))
  if (parts.length < 2) parts.push(...styleLabels.slice(0, 2 - parts.length))
  if (parts.length === 0) return 'a well-rounded setup'
  return parts.map((p) => p.toLowerCase()).join(' and ')
}

function optionLabels(questionId: string, selected: string[] | undefined): string[] {
  if (!selected || selected.length === 0) return []
  const question = quizQuestions.find((q) => q.id === questionId)
  if (!question) return []
  return selected.map((id) => question.options.find((o) => o.id === id)?.label).filter((l): l is string => !!l)
}

function availabilityNote(item: StringItem): string {
  if (item.stock === 'unavailable') return ` It isn't in stock right now, but it can be ordered in specifically if you'd like to go with it.`
  if (item.stock === 'low-stock') return ` Only a limited quantity is in stock right now, so grab it soon if you want it.`
  return ''
}

type ExplanationRole = 'best' | 'bestAvailable' | 'crossBrand' | 'specialist'

function buildExplanation(scored: ScoredString, answers: QuizAnswers, role: ExplanationRole): string {
  const { string: s } = scored
  const profile = getSpecialistProfile(s.id)

  const leadIn =
    role === 'best'
      ? `You're looking for ${playerAskPhrase(answers)}.`
      : role === 'bestAvailable'
        ? `Of what's actually in stock right now,`
        : role === 'crossBrand'
          ? `${s.brand} isn't the same brand as our top pick, but`
          : `As a specialist alternative worth knowing about,`

  if (profile && (profile.strengths?.length || profile.subjectiveNotes)) {
    const [first, second] = profile.strengths ?? []
    let text = `${leadIn} ${s.name} `
    text +=
      role === 'best'
        ? 'is a strong fit'
        : role === 'bestAvailable'
          ? 'is the best fit you can get today'
          : role === 'crossBrand'
            ? 'is the strongest cross-brand alternative'
            : 'is worth considering'
    if (first) {
      text += `: ${lowerFirst(first)}`
      if (second) text += `, and ${lowerFirst(second)}`
      text += '.'
    } else {
      text += '.'
    }
    if (profile.weaknesses?.[0]) {
      text += ` Trade-off: ${lowerFirst(profile.weaknesses[0])}.`
    }
    text += availabilityNote(s)
    return text
  }

  // No specialist profile (or nothing usable in it) — fall back to manufacturer-dimension phrasing.
  const strengths = describeManufacturerStrengths(scored)
  let text =
    role === 'best'
      ? `${leadIn} ${s.name} is a strong fit because it delivers on ${strengths}.`
      : role === 'bestAvailable'
        ? `${leadIn} ${s.name} is the best fit you can get today, leaning into ${strengths}.`
        : role === 'crossBrand'
          ? `${leadIn} ${s.name} is the strongest cross-brand alternative, leaning into ${strengths}.`
          : `${leadIn} ${s.name} leans into ${strengths}.`

  const topSet = new Set(scored.topDimensions)
  const weakestDim = [...DIMENSIONS].filter((d) => !topSet.has(d)).sort((a, b) => (s[a] ?? 11) - (s[b] ?? 11))[0]
  const weakestValue = weakestDim != null ? s[weakestDim] : undefined
  if (weakestValue != null && weakestValue <= 7) {
    text += ` The trade-off is ${DIMENSION_LABELS[weakestDim]} — still perfectly usable, just not this string's strongest suit.`
  }
  text += availabilityNote(s)
  return text
}

// ---------------------------------------------------------------------------
// Selection: best / cross-brand alternative / specialist choice.
// ---------------------------------------------------------------------------

const CANDIDATE_MIN_POOL = 4
/** How much lower-scoring a candidate can be and still be offered as a credible alternative rather than a forced, uncompetitive pick. */
const CROSS_BRAND_WINDOW = 16
const SPECIALIST_CHOICE_WINDOW = 18

export function recommendStrings(answers: QuizAnswers, pool: StringItem[] = allStrings): StringRecommendation {
  const profile = buildPreferenceProfile(answers)
  const specialistWeights = buildSpecialistWeights(answers)
  const specialistBudget = ALL_SPECIALIST_KEYS.reduce((sum, k) => sum + specialistWeights[k], 0)

  const scored = pool.map((item) => scoreString(item, profile, specialistWeights, specialistBudget))

  // Ranked purely on how well each string fits this player — stock never
  // enters scoring or eligibility. We can order in strings we don't
  // currently hold, so the objectively best-fitting string should always
  // be able to win, be the cross-brand pick, or be the specialist choice.
  const byPerformance = [...scored].sort((a, b) => b.matchPercent - a.matchPercent || a.string.id.localeCompare(b.string.id))

  const best = byPerformance[0]

  // Availability is surfaced separately, never as a filter: if the best
  // match happens to be unavailable, show what's actually orderable today
  // as an additional, clearly-labeled option — not a replacement.
  const bestAvailable = best.string.stock === 'unavailable' ? byPerformance.find((s) => s.string.stock !== 'unavailable') : undefined

  // Cross-brand alternative: best-scoring string from a different brand,
  // chosen on fit alone (ignoring stock), only surfaced if it's still
  // credibly close — never forced.
  const crossBrandCandidates = byPerformance.filter((s) => s.string.id !== best.string.id && s.string.brand !== best.string.brand)
  const crossBrandAlternative = crossBrandCandidates.find((s) => best.matchPercent - s.matchPercent <= CROSS_BRAND_WINDOW)

  // Specialist choice: a genuinely differentiated third option, identified
  // by its specialist-dimension identity differing from both picks above.
  // Falls back to the old differentiated-category/best-value heuristic when
  // specialist data doesn't clearly differentiate anything (e.g. a small
  // synthetic test pool with little specialist coverage). Chosen on fit
  // alone — stock never filters it out.
  let specialistChoice: ScoredString | undefined
  if (byPerformance.length >= CANDIDATE_MIN_POOL - 1) {
    const usedIds = new Set([best.string.id, crossBrandAlternative?.string.id])
    const bestTop = best.topSpecialistDims[0]
    const crossTop = crossBrandAlternative?.topSpecialistDims[0]
    const remaining = byPerformance.filter((s) => !usedIds.has(s.string.id))

    const differentiatedSpecialist = remaining.find(
      (s) => s.topSpecialistDims.length > 0 && s.topSpecialistDims[0] !== bestTop && s.topSpecialistDims[0] !== crossTop && best.matchPercent - s.matchPercent <= SPECIALIST_CHOICE_WINDOW,
    )

    if (differentiatedSpecialist) {
      specialistChoice = differentiatedSpecialist
    } else {
      const differentCategory = remaining.find((s) => s.string.category !== best.string.category && s.string.category !== crossBrandAlternative?.string.category)
      const bestValue = remaining.filter((s) => s.string.stringCost != null).sort((a, b) => (a.string.stringCost ?? Infinity) - (b.string.stringCost ?? Infinity))[0]
      const candidate = differentCategory ?? bestValue
      if (candidate && best.matchPercent - candidate.matchPercent <= 20) specialistChoice = candidate
    }
  }

  return {
    best,
    bestAvailable,
    crossBrandAlternative,
    specialistChoice,
    profile,
    explanations: {
      best: buildExplanation(best, answers, 'best'),
      bestAvailable: bestAvailable ? buildExplanation(bestAvailable, answers, 'bestAvailable') : undefined,
      crossBrandAlternative: crossBrandAlternative ? buildExplanation(crossBrandAlternative, answers, 'crossBrand') : undefined,
      specialistChoice: specialistChoice ? buildExplanation(specialistChoice, answers, 'specialist') : undefined,
    },
  }
}

// Re-exported for components that need the raw specialist dimension list (e.g. the Specialist Profile panel).
export type { SpecialistDimensions }
