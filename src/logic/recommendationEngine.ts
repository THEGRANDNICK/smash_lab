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

import { strings as allStrings, type StringItem } from '../data/strings.js'
import {
  STRING_SPECIALIST_PROFILES,
  type StringSpecialistProfile,
  type SpecialistDimensionKey,
  type SpecialistDimensions,
  type Confidence,
} from '../data/stringSpecialistProfiles.js'
import { DIMENSIONS, ZERO_WEIGHTS, BASELINE_WEIGHT, WEIGHT_CONTRIBUTIONS, type Dimension, type DimensionWeights } from '../config/recommendationWeights.js'
import { SPECIALIST_WEIGHT_CONTRIBUTIONS, CONFIDENCE_TRUST, SPECIALIST_MAX_INFLUENCE, type SpecialistWeights } from '../config/specialistWeights.js'
import { ARCHETYPES, detectDominantArchetype, type ArchetypeId } from '../config/archetypes.js'
import { quizQuestions } from '../data/quizQuestions.js'
import type { QuizAnswers } from './types.js'

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
  /**
   * Phase 14 podium refinement — the top 3 candidates by matchPercent
   * alone, in the exact order already computed for `best`/ranking (never a
   * second sort, never a different tie-break). `topThree[0]` is always the
   * same object as `best`. Purely additive: exposes data the engine
   * already computed internally, changes no scoring or ranking.
   */
  topThree: ScoredString[]
  /** Every candidate, best first, in exactly the order used for topThree — lets the results page show any string the player picks (e.g. from the answer tree) with its real match against THEIR answers. Additive only; changes no scoring. */
  ranked: ScoredString[]
  profile: DimensionWeights
  /** The player-intent archetype (config/archetypes.ts) that best matches their own computed weight vector — display/explanation label only, never a second scoring path. */
  dominantArchetype: ArchetypeId
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

// ---------------------------------------------------------------------------
// Phase 12 calibration — pool-relative statistics feeding both the
// specialization mechanism and the cross-brand shrinkage below. Computed
// once per recommendStrings() call from whichever pool was actually passed
// in (the static catalog, or a live Supabase-merged one), never from a fixed
// snapshot — so behavior always reflects the real candidate set.
// ---------------------------------------------------------------------------

interface DimensionPoolStats {
  mean: number
  /** max - min across the pool, floored at 1 so a dimension with zero spread never divides by zero. */
  range: number
}

type PoolStats = Record<Dimension, DimensionPoolStats>

function computePoolStats(pool: readonly StringItem[]): PoolStats {
  const stats = {} as PoolStats
  for (const dim of DIMENSIONS) {
    const values = pool.map((s) => s[dim]).filter((v): v is number => v != null)
    if (values.length === 0) {
      stats[dim] = { mean: 0, range: 1 }
      continue
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    stats[dim] = { mean, range: Math.max(Math.max(...values) - Math.min(...values), 1) }
  }
  return stats
}

const DEFAULT_POOL_STATS = computePoolStats(allStrings)

/**
 * Part 5 — cross-brand rating calibration. Different brands rate their own
 * strings on their own scale; nothing in this codebase (or realistically
 * available) proves a "7/11" from one brand means the same thing as a
 * "7/11" from another (see README's cross-brand caveat). Rather than invent
 * a false precision correction, a string with NO independent specialist
 * profile (i.e. no hands-on corroboration of its manufacturer numbers) has
 * its raw ratings shrunk a small, fixed, documented amount toward the pool
 * mean before scoring — conservative, testable, and reversible by deleting
 * this one constant. A string WITH a specialist profile keeps its raw
 * manufacturer numbers at full trust, since that profile is an independent
 * check on how the string actually plays.
 */
const CROSS_BRAND_SHRINKAGE = 0.15

/**
 * Part 3 — specialization over high average. `emphasis` is how much MORE
 * (or less) weight a dimension received than a neutral, unprioritized
 * share of the player's profile — i.e. how strongly the player's own
 * answers actually singled that dimension out. Multiplying emphasis by how
 * this string performs on that same dimension RELATIVE TO THE POOL (not
 * against a fixed number, and never against a specific string) rewards
 * genuine specialization on the dimensions the player emphasized, and
 * mildly penalizes a string that's unusually strong on a dimension the
 * player did NOT emphasize (e.g. very soft when the player wants a hard,
 * direct feel) — the same mechanism produces both the reward and the
 * contradiction penalty, so there is no separate hard-coded penalty table.
 */
const CONCENTRATION_STRENGTH = 1.8

function scoreManufacturer(
  item: StringItem,
  profile: DimensionWeights,
  poolStats: PoolStats,
  hasSpecialistProfile: boolean,
): { percent: number; topDimensions: Dimension[] } {
  const available = DIMENSIONS.filter((dim) => item[dim] != null)
  const weightSum = available.reduce((sum, dim) => sum + profile[dim], 0) || 1
  const neutralShare = 1 / available.length

  let weightedRating = 0
  let concentration = 0
  for (const dim of available) {
    const w = profile[dim] / weightSum
    const rawValue = item[dim] as number
    const value = hasSpecialistProfile ? rawValue : rawValue + (poolStats[dim].mean - rawValue) * CROSS_BRAND_SHRINKAGE

    weightedRating += w * value

    const emphasis = w - neutralShare
    const relativePosition = (value - poolStats[dim].mean) / poolStats[dim].range
    concentration += emphasis * relativePosition
  }

  const combined = Math.min(11, Math.max(0, weightedRating + concentration * CONCENTRATION_STRENGTH))
  const percent = Math.round((combined / 11) * 100)
  const topDimensions = [...available].sort((a, b) => profile[b] * (item[b] as number) - profile[a] * (item[a] as number)).slice(0, 2)

  return { percent, topDimensions }
}

/**
 * Part 7 — match-percentage calibration. A flat/near-uniform weight vector
 * (no answers, or answers that pull in opposite directions and largely
 * cancel out) signals low confidence in what the player actually wants; a
 * peaked vector (clear, consistent priorities) signals high confidence.
 * This scales the ceiling every candidate's matchPercent is clamped to, so
 * an ambiguous quiz can no longer produce an overconfident-looking top
 * result, without changing anything about a clear, peaked quiz.
 */
const CONFIDENCE_CEILING_RANGE = 12
const TYPICAL_WEIGHT_SPREAD = 0.35

function profileConfidence(profile: DimensionWeights): number {
  const values = DIMENSIONS.map((d) => profile[d])
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.min(1, Math.sqrt(variance) / TYPICAL_WEIGHT_SPREAD)
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

/**
 * Objective fallback for beginnerFriendliness when nobody has rated it: the
 * gauge. Common rule of thumb in the community — 0.70 mm and thicker suits
 * beginners, 0.68 mm and thinner is for developing/advanced players. For a
 * hybrid, the THINNER side counts (thin crosses are what break). Without it,
 * every unrated string defaulted to a neutral 3 and thin, high-spec strings
 * (Exbolt 63, AeroBite) won a third of all beginner results.
 */
const GAUGE_BEGINNER_CONFIDENCE: Confidence = 'medium'
function gaugeBeginnerFriendliness(item: StringItem): number | undefined {
  const gauge = item.isHybrid
    ? Math.min(item.mainString?.gauge ?? Infinity, item.crossString?.gauge ?? Infinity)
    : item.tension?.gauge
  if (gauge == null || !Number.isFinite(gauge)) return undefined
  const t = (gauge - 0.61) / (0.7 - 0.61)
  return Math.round(Math.min(4, Math.max(1.5, 1.5 + t * 2.5)) * 4) / 4
}

/*
 * Missing hands-on knowledge (v2, review Oct 2026). Three ways were measured
 * (scripts/analysis/unratedHandling.ts):
 *   - 'midpoint' (DEFAULT): an unrated property counts as a cautious 3/5 with low trust;
 *   - 'estimate': estimated from the manufacturer counterpart (mapped relatively) or the rated average;
 *   - 'estimateWithCoverage': the estimate, plus the hands-on layer only decides as much as is rated.
 * Hands-on ratings systematically correct the (inflated) packet ratings DOWNWARDS, so the less an
 * unrated property is held back, the more often strings nobody has tested win: 0.3% of all results
 * with 'midpoint', 11.5% with 'estimate', 28.9% with 'estimateWithCoverage'. A hands-on guide
 * should recommend what it can vouch for, so unverified strings are ranked cautiously — and the
 * result page says so when a pick rests on little hands-on data.
 */
export type UnratedHandsOnMode = 'midpoint' | 'estimate' | 'estimateWithCoverage'
let unratedHandsOn: UnratedHandsOnMode = 'midpoint'
/** For the analysis scripts only — the site always uses the default. */
export function setUnratedHandsOnMode(mode: UnratedHandsOnMode): void {
  unratedHandsOn = mode
}
const ESTIMATE_CONFIDENCE: Confidence = 'low'
const SCALE_MIDPOINT = 3
/** Hands-on properties with a direct manufacturer counterpart. */
const MANUFACTURER_COUNTERPART: Partial<Record<SpecialistDimensionKey, Dimension>> = {
  easyPower: 'repulsion',
  controlPrecision: 'control',
  normalWearDurability: 'durability',
  comfort: 'shockAbsorption',
}

interface RatedStats {
  mean: number
  range: number
}
const ratedStatsCache = new WeakMap<Record<string, StringSpecialistProfile>, Partial<Record<SpecialistDimensionKey, RatedStats>>>()
function ratedStats(profiles: Record<string, StringSpecialistProfile>, key: SpecialistDimensionKey): RatedStats | undefined {
  let all = ratedStatsCache.get(profiles)
  if (!all) {
    all = {}
    for (const k of ALL_SPECIALIST_KEYS) {
      const vals = Object.values(profiles).map((p) => p.dimensions[k]).filter((v): v is number => typeof v === 'number')
      if (vals.length) all[k] = { mean: vals.reduce((x, y) => x + y, 0) / vals.length, range: Math.max(...vals) - Math.min(...vals) }
    }
    ratedStatsCache.set(profiles, all)
  }
  return all[key]
}

/**
 * Best estimate for an unrated hands-on property (see the note above). Manufacturer ratings are
 * inflated (mostly 8–11 of 11), so they are mapped RELATIVELY: a string that sits X% of the
 * catalog's spread above the catalog average on the packet gets an estimate X% of the hands-on
 * spread above the hands-on average — never the raw packet number squeezed onto 1–5.
 */
export function estimateUnratedDimension(
  item: StringItem,
  key: SpecialistDimensionKey,
  profiles: Record<string, StringSpecialistProfile>,
  poolStats: PoolStats = DEFAULT_POOL_STATS,
): number {
  if (unratedHandsOn === 'midpoint') return SCALE_MIDPOINT
  const rated = ratedStats(profiles, key)
  if (!rated) return SCALE_MIDPOINT
  const makerDim = MANUFACTURER_COUNTERPART[key]
  const maker = makerDim ? item[makerDim] : null
  if (makerDim && typeof maker === 'number') {
    const relative = (maker - poolStats[makerDim].mean) / poolStats[makerDim].range
    return Math.min(5, Math.max(1, rated.mean + relative * rated.range))
  }
  return rated.mean
}

function scoreSpecialist(
  item: StringItem,
  specialistWeights: SpecialistWeightVector,
  totalWeightBudget: number,
  specialistProfiles: Record<string, StringSpecialistProfile>,
  poolStats: PoolStats = DEFAULT_POOL_STATS,
): SpecialistScoreResult | undefined {
  if (totalWeightBudget <= 0.0001) return undefined
  // Manufacturer-only mode (empty profile map): no specialist layer at all.
  if (Object.keys(specialistProfiles).length === 0) return undefined
  const profile = specialistProfiles[item.id]

  let weightedValue = 0
  let trustWeighted = 0
  let coveredWeight = 0
  const known: [SpecialistDimensionKey, number][] = []
  for (const key of ALL_SPECIALIST_KEYS) {
    const w = specialistWeights[key]
    if (w <= 0) continue
    const v = profile?.dimensions[key]
    const gaugeFallback = key === 'beginnerFriendliness' && v == null ? gaugeBeginnerFriendliness(item) : undefined
    if (v != null && profile) {
      weightedValue += w * v
      trustWeighted += w * CONFIDENCE_TRUST[dimensionConfidence(profile, key)]
      coveredWeight += w
      known.push([key, v])
    } else if (gaugeFallback != null) {
      weightedValue += w * gaugeFallback
      trustWeighted += w * CONFIDENCE_TRUST[GAUGE_BEGINNER_CONFIDENCE]
      coveredWeight += w
    } else {
      // Not rated: estimated from what we know (manufacturer counterpart or rated average), low trust.
      weightedValue += w * estimateUnratedDimension(item, key, specialistProfiles, poolStats)
      trustWeighted += w * CONFIDENCE_TRUST[ESTIMATE_CONFIDENCE]
    }
  }

  const percent = (weightedValue / totalWeightBudget / 5) * 100
  const confidenceMultiplier = trustWeighted / totalWeightBudget
  const topDims = known.sort((a, b) => specialistWeights[b[0]] * b[1] - specialistWeights[a[0]] * a[1]).map(([k]) => k).slice(0, 2)

  // With coverage: the hands-on layer may only decide as much as is actually rated (no ratings at
  // all → manufacturer data only). Otherwise every string is judged on everything asked for.
  const relevance = unratedHandsOn === 'estimateWithCoverage' ? coveredWeight / totalWeightBudget : 1
  return { percent, relevance, confidenceMultiplier, topDims }
}

/**
 * Beginners: strings thinner than 0.68 mm move down the ranking (Smash Lab v2).
 * Source: Badminton Insight (Aug 2026) — beginners around 0.70 mm for durability and forgiveness;
 * 0.68 mm and thinner for high-intermediate/advanced players. A soft guardrail, not a filter: a
 * beginner who really wants a thin string still sees it, just not as the default pick.
 */
export const BEGINNER_MIN_GAUGE = 0.68
export const BEGINNER_THIN_STRING_FACTOR = 0.85

function gaugeOf(item: StringItem): number | undefined {
  if (item.isHybrid) {
    const sides = [item.mainString?.gauge, item.crossString?.gauge].filter((g): g is number => typeof g === 'number')
    return sides.length ? Math.min(...sides) : undefined
  }
  return item.tension?.gauge
}

export function applyBeginnerGaugeGuardrail(scored: ScoredString, answers: QuizAnswers): ScoredString {
  if (answers.level !== 'beginner') return scored
  const gauge = gaugeOf(scored.string)
  if (gauge == null || gauge >= BEGINNER_MIN_GAUGE) return scored
  return { ...scored, matchPercent: Math.round(scored.matchPercent * BEGINNER_THIN_STRING_FACTOR) }
}

/** Scores a single string by blending manufacturer data with Smash Lab specialist knowledge. `specialistProfiles` defaults to the local data file — pass the live, Supabase-merged map from useSpecialistProfiles() to source it from there instead; the scoring math itself never changes. */
export function scoreString(
  item: StringItem,
  profile: DimensionWeights,
  specialistWeights: SpecialistWeightVector,
  specialistBudget: number,
  specialistProfiles: Record<string, StringSpecialistProfile> = STRING_SPECIALIST_PROFILES,
  poolStats: PoolStats = DEFAULT_POOL_STATS,
): ScoredString {
  const hasSpecialistProfile = specialistProfiles[item.id] != null
  const manufacturer = scoreManufacturer(item, profile, poolStats, hasSpecialistProfile)
  const specialist = scoreSpecialist(item, specialistWeights, specialistBudget, specialistProfiles, poolStats)

  let finalPercent = manufacturer.percent
  let influence = 0
  let topSpecialistDims: SpecialistDimensionKey[] = []

  if (specialist) {
    influence = SPECIALIST_MAX_INFLUENCE * specialist.confidenceMultiplier * specialist.relevance
    finalPercent = manufacturer.percent * (1 - influence) + specialist.percent * influence
    topSpecialistDims = specialist.topDims
  }

  const ceiling = Math.round(99 - (1 - profileConfidence(profile)) * CONFIDENCE_CEILING_RANGE)

  return {
    string: item,
    matchPercent: Math.min(ceiling, Math.max(1, Math.round(finalPercent))),
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

/**
 * Part 8 — connects the player's priorities to the dominant archetype
 * detected from their own weight vector. Only prepended for the `best`
 * role: repeating the same priority sentence on every alternative card
 * would be exactly the "generic repeated paragraph" the phase spec warns
 * against, and the alternatives already get their own differentiated
 * reasons (see buildAlternativeReasons in recommendationExplanation.ts).
 */
function archetypePriorityPrefix(role: ExplanationRole, archetypeId: ArchetypeId | undefined): string {
  if (role !== 'best' || !archetypeId) return ''
  return `${ARCHETYPES[archetypeId].priorityStatement} `
}

function buildExplanation(
  scored: ScoredString,
  answers: QuizAnswers,
  role: ExplanationRole,
  specialistProfiles: Record<string, StringSpecialistProfile>,
  archetypeId?: ArchetypeId,
): string {
  const { string: s } = scored
  const profile = specialistProfiles[s.id]
  const priorityPrefix = archetypePriorityPrefix(role, archetypeId)

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
    return priorityPrefix + text
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
  return priorityPrefix + text
}

// ---------------------------------------------------------------------------
// Selection: best / cross-brand alternative / specialist choice.
// ---------------------------------------------------------------------------

const CANDIDATE_MIN_POOL = 4
/** How much lower-scoring a candidate can be and still be offered as a credible alternative rather than a forced, uncompetitive pick. */
const CROSS_BRAND_WINDOW = 16
const SPECIALIST_CHOICE_WINDOW = 18

/**
 * `specialistProfiles` defaults to the local data file (byte-identical to
 * pre-Phase-6 behavior for any caller that doesn't pass it) — pass the
 * live, Supabase-merged map from useSpecialistProfiles() to source
 * specialist knowledge from there instead. The engine itself never knows
 * or cares where either `pool` or `specialistProfiles` came from — see
 * services/catalogService.ts and services/specialistProfileService.ts for
 * that.
 */
export function recommendStrings(
  answers: QuizAnswers,
  pool: StringItem[] = allStrings,
  specialistProfiles: Record<string, StringSpecialistProfile> = STRING_SPECIALIST_PROFILES,
): StringRecommendation {
  const profile = buildPreferenceProfile(answers)
  const specialistWeights = buildSpecialistWeights(answers)
  const specialistBudget = ALL_SPECIALIST_KEYS.reduce((sum, k) => sum + specialistWeights[k], 0)
  const poolStats = computePoolStats(pool)
  const dominantArchetype = detectDominantArchetype(profile, specialistWeights, answers)

  const scored = pool.map((item) => applyBeginnerGaugeGuardrail(scoreString(item, profile, specialistWeights, specialistBudget, specialistProfiles, poolStats), answers))

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
    topThree: byPerformance.slice(0, 3),
    ranked: byPerformance,
    profile,
    dominantArchetype,
    explanations: {
      best: buildExplanation(best, answers, 'best', specialistProfiles, dominantArchetype),
      bestAvailable: bestAvailable ? buildExplanation(bestAvailable, answers, 'bestAvailable', specialistProfiles) : undefined,
      crossBrandAlternative: crossBrandAlternative ? buildExplanation(crossBrandAlternative, answers, 'crossBrand', specialistProfiles) : undefined,
      specialistChoice: specialistChoice ? buildExplanation(specialistChoice, answers, 'specialist', specialistProfiles) : undefined,
    },
  }
}

// Re-exported for components that need the raw specialist dimension list (e.g. the Specialist Profile panel).
export type { SpecialistDimensions }
