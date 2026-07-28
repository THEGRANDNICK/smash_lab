// Phase 8 — UI-layer presentation built ONLY from data recommendationEngine.ts
// already produces (ScoredString, its natural-language explanation string,
// and the existing StringSpecialistProfile). This module adds no scoring, no
// weighting, and no ranking of its own — it only reshapes existing numbers
// and existing hand-written strengths/weaknesses text into a structured
// object the UI can render as a headline, a strengths list and a tradeoffs
// list. recommendationEngine.ts, tensionRecommendation.ts, and every file
// under src/config/ and src/data/ are untouched by Phase 8.
//
// Determinism: every function here is pure (same input -> same output,
// no randomness, no dates, no external state) — see
// scripts/testUiPresentation.ts for the regression tests that pin this down.

import type { ScoredString } from './recommendationEngine.js'
import type { StringSpecialistProfile, SpecialistDimensionKey } from '../data/stringSpecialistProfiles.js'
import type { Dimension } from '../config/recommendationWeights.js'
import type { StringItem } from '../data/strings.js'

export type RatingTier = 'Excellent' | 'Very Good' | 'Good' | 'Fair'

/** Buckets an existing 0–max rating into a display tier. Presentational only — never fed back into scoring or ranking. */
export function ratingTier(value: number, max = 11): RatingTier {
  const pct = max > 0 ? value / max : 0
  if (pct >= 0.85) return 'Excellent'
  if (pct >= 0.65) return 'Very Good'
  if (pct >= 0.45) return 'Good'
  return 'Fair'
}

interface DimensionCopy {
  label: string
  why: string
  tradeoff: string
}

/** Fixed, deterministic display copy per manufacturer dimension — text only, no numbers computed here. */
export const DIMENSION_DISPLAY: Record<Dimension, DimensionCopy> = {
  repulsion: {
    label: 'Repulsion',
    why: 'your answers strongly favored quick racket-head speed and fast shuttle acceleration',
    tradeoff: 'Higher repulsion usually reduces durability.',
  },
  control: {
    label: 'Control',
    why: 'your preferences emphasized precision and shot placement over raw power',
    tradeoff: 'Strings built for control usually generate a little less free power.',
  },
  durability: {
    label: 'Durability',
    why: 'your playing frequency and string-break history point toward a string that lasts',
    tradeoff: 'This string performs best with regular restringing, regardless of durability.',
  },
  hittingSound: {
    label: 'Hitting Sound',
    why: 'a crisp, satisfying hitting sound matters to you',
    tradeoff: 'A crisper sound is a feel preference — it has no real effect on performance.',
  },
  shockAbsorption: {
    label: 'Comfort',
    why: 'you prioritized comfort and shock absorption over a stiffer, more direct feel',
    tradeoff: 'Excellent feel and comfort can come with slightly reduced tension retention.',
  },
}

const SPECIALIST_DIMENSION_LABEL: Partial<Record<SpecialistDimensionKey, string>> = {
  hardHitterFit: 'Hard-Hitter Fit',
  easyPower: 'Easy Power',
  attackSmash: 'Attacking Smash',
  fastDoubles: 'Fast Doubles',
  flatDriveGame: 'Flat Drive Game',
  controlPrecision: 'Precision Control',
  shuttleGripHold: 'Shuttle Grip',
  netTechnical: 'Net & Technical Play',
  comfort: 'Comfort',
  directness: 'Directness',
  softness: 'Softness',
  tensionRetention: 'Tension Retention',
  normalWearDurability: 'Durability',
  mishitTolerance: 'Mishit Tolerance',
  beginnerFriendliness: 'Beginner Friendliness',
  value: 'Value',
  allRoundSuitability: 'All-Round Suitability',
}

function specialistLabel(key: SpecialistDimensionKey): string {
  return SPECIALIST_DIMENSION_LABEL[key] ?? key
}

export interface ExplanationBadge {
  key: string
  label: string
}

/** Up to 2 manufacturer-dimension badges + up to 2 specialist-dimension badges, in the same priority order the engine already picked them (topDimensions / topSpecialistDims), deduped by label. */
export function buildStrengthBadges(scored: ScoredString): ExplanationBadge[] {
  const badges: ExplanationBadge[] = []
  const seen = new Set<string>()

  for (const dim of scored.topDimensions) {
    const value = scored.string[dim]
    if (value == null) continue
    const label = `${ratingTier(value)} ${DIMENSION_DISPLAY[dim].label}`
    if (seen.has(label)) continue
    seen.add(label)
    badges.push({ key: `dim:${dim}`, label })
  }

  for (const key of scored.topSpecialistDims) {
    const label = specialistLabel(key)
    if (seen.has(label)) continue
    seen.add(label)
    badges.push({ key: `spec:${key}`, label })
  }

  return badges.slice(0, 4)
}

/** The single most relevant "why" sentence for the top manufacturer dimension — the same fact the engine's own explanation text is built from, just isolated as its own headline sub-line. */
export function buildSummarySentence(scored: ScoredString): string | undefined {
  const top = scored.topDimensions[0]
  if (!top) return undefined
  return `${capitalize(DIMENSION_DISPLAY[top].why)}.`
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

/** Determines the weakest manufacturer dimension NOT already called out as a strength — same "what's the trade-off" question buildExplanation() answers internally, recomputed here from the same public StringItem fields (not a new scoring rule, just a presentational pick of which existing number to mention). */
function weakestNonTopDimension(item: StringItem, topDimensions: readonly Dimension[]): Dimension | undefined {
  const top = new Set(topDimensions)
  const candidates = (Object.keys(DIMENSION_DISPLAY) as Dimension[]).filter((d) => !top.has(d) && item[d] != null)
  if (candidates.length === 0) return undefined
  return candidates.sort((a, b) => (item[a] as number) - (item[b] as number))[0]
}

/** Real, hand-written weaknesses (existing data) always come first; only falls back to a generic dimension trade-off sentence when the string has no specialist profile / no weaknesses recorded. Capped at 2. */
export function buildTradeoffs(scored: ScoredString, specialistProfile: StringSpecialistProfile | undefined): string[] {
  const tradeoffs: string[] = []

  if (specialistProfile?.weaknesses?.length) {
    for (const w of specialistProfile.weaknesses) {
      tradeoffs.push(w.endsWith('.') ? w : `${w}.`)
      if (tradeoffs.length >= 2) return tradeoffs
    }
  }

  const weakest = weakestNonTopDimension(scored.string, scored.topDimensions)
  if (weakest != null && tradeoffs.length < 2) {
    tradeoffs.push(DIMENSION_DISPLAY[weakest].tradeoff)
  }

  return tradeoffs.slice(0, 2)
}

/** Buckets existing specialist dimension numbers into a rough player-level fit line — never used anywhere near scoring, purely descriptive copy. Undefined when the string has no specialist profile at all. */
export function buildPlayerLevelFit(profile: StringSpecialistProfile | undefined): string | undefined {
  if (!profile) return undefined
  const d = profile.dimensions
  if (d.beginnerFriendliness != null && d.beginnerFriendliness >= 4) return 'Great for Beginners'
  if (d.hardHitterFit != null && d.hardHitterFit >= 4.5) return 'Best for Advanced, Attacking Players'
  if (d.allRoundSuitability != null && d.allRoundSuitability >= 4) return 'Suitable for All-Round Players'
  if (d.beginnerFriendliness != null || d.hardHitterFit != null || d.allRoundSuitability != null || d.controlPrecision != null) {
    return 'Suitable for Intermediate Players'
  }
  return undefined
}

export interface StructuredExplanation {
  /** e.g. "Excellent Repulsion" */
  headline: string
  /** e.g. "Excellent Control", set only when a genuine second top dimension exists. */
  headlineSecondary?: string
  /** The engine's own natural-language explanation, verbatim — guarantees this module only ever *explains* existing logic. */
  paragraph: string
  playerLevelFit?: string
  strengths: string[]
  tradeoffs: string[]
  badges: ExplanationBadge[]
}

/**
 * Builds the structured explanation for one scored string. `paragraph` must
 * be the matching string already produced by recommendStrings()'s own
 * `explanations` object — this function never generates new prose about WHY
 * a string was chosen, only reformats the engine's own output plus existing
 * specialist-profile text into headline/strengths/tradeoffs/badges.
 */
export function buildStructuredExplanation(
  scored: ScoredString,
  paragraph: string,
  specialistProfile: StringSpecialistProfile | undefined,
): StructuredExplanation {
  const [firstDim, secondDim] = scored.topDimensions
  const headline = firstDim != null && scored.string[firstDim] != null ? `${ratingTier(scored.string[firstDim] as number)} ${DIMENSION_DISPLAY[firstDim].label}` : 'Solid All-Round Fit'
  const headlineSecondary =
    secondDim != null && scored.string[secondDim] != null ? `${ratingTier(scored.string[secondDim] as number)} ${DIMENSION_DISPLAY[secondDim].label}` : undefined

  const strengths: string[] = []
  if (specialistProfile?.strengths?.length) {
    strengths.push(...specialistProfile.strengths.slice(0, 3))
  } else {
    for (const dim of scored.topDimensions) {
      const value = scored.string[dim]
      if (value == null) continue
      strengths.push(`${ratingTier(value)} ${DIMENSION_DISPLAY[dim].label.toLowerCase()} (${value}/11).`)
    }
  }

  return {
    headline,
    headlineSecondary,
    paragraph,
    playerLevelFit: buildPlayerLevelFit(specialistProfile),
    strengths: strengths.slice(0, 3),
    tradeoffs: buildTradeoffs(scored, specialistProfile),
    badges: buildStrengthBadges(scored),
  }
}

// ---------------------------------------------------------------------------
// Alternatives — "why choose this instead" bullets, derived purely by
// comparing two ScoredStrings' existing fields against each other. Ranking
// itself is never touched: this only decorates the alternative the engine
// already picked with reasons a player might prefer it.
// ---------------------------------------------------------------------------

const RATING_DIFFERENCE_THRESHOLD = 0.5

function specialistTopLabel(dim: SpecialistDimensionKey | undefined): string | undefined {
  if (!dim) return undefined
  if (dim === 'hardHitterFit' || dim === 'attackSmash') return 'Better suited to advanced, attacking players.'
  if (dim === 'beginnerFriendliness') return 'More forgiving for newer players.'
  if (dim === 'easyPower') return 'Generates easier power with less effort from you.'
  if (dim === 'value') return 'Better performance-per-cost value.'
  if (dim === 'netTechnical') return 'Better for technical net play and touch shots.'
  if (dim === 'tensionRetention') return 'Holds its tension and playability longer.'
  return undefined
}

/**
 * Deterministic, capped-at-3 list of concrete reasons `alternative` might be
 * chosen over `baseline` (typically the Best Match) — built only from
 * fields both ScoredStrings already carry (manufacturer ratings, specialist
 * feel/top-dimensions, stringCost, stock). Never changes which string is
 * `alternative` or `baseline`, and never affects matchPercent or ranking.
 */
export function buildAlternativeReasons(
  alternative: ScoredString,
  baseline: ScoredString,
  alternativeProfile: StringSpecialistProfile | undefined,
  baselineProfile: StringSpecialistProfile | undefined,
): string[] {
  const reasons: string[] = []
  const a = alternative.string
  const b = baseline.string

  if (a.durability != null && b.durability != null && a.durability - b.durability >= RATING_DIFFERENCE_THRESHOLD) {
    reasons.push('Higher durability than the Best Match.')
  }
  if (a.repulsion != null && b.repulsion != null && a.repulsion - b.repulsion >= RATING_DIFFERENCE_THRESHOLD) {
    reasons.push('More power and repulsion than the Best Match.')
  }
  if (a.control != null && b.control != null && a.control - b.control >= RATING_DIFFERENCE_THRESHOLD) {
    reasons.push('More precise control than the Best Match.')
  }
  if (a.shockAbsorption != null && b.shockAbsorption != null && a.shockAbsorption - b.shockAbsorption >= RATING_DIFFERENCE_THRESHOLD) {
    reasons.push('More comfortable, softer impact than the Best Match.')
  }

  if (alternativeProfile?.feel === 'soft' && baselineProfile?.feel && baselineProfile.feel !== 'soft') {
    reasons.push('Slightly softer, more forgiving feel than the Best Match.')
  } else if (alternativeProfile?.feel === 'hard' && baselineProfile?.feel && baselineProfile.feel !== 'hard') {
    reasons.push('More direct, connected feedback than the Best Match.')
  }

  const specialistReason = specialistTopLabel(alternative.topSpecialistDims[0])
  if (specialistReason) reasons.push(specialistReason)

  if (a.stringCost != null && b.stringCost != null && a.stringCost < b.stringCost) {
    reasons.push('Lower price than the Best Match.')
  }

  if (a.stock === 'in-stock' && b.stock !== 'in-stock') {
    reasons.push('Currently in stock, unlike the Best Match.')
  }

  // Dedupe while preserving order, then cap.
  const seen = new Set<string>()
  const deduped = reasons.filter((r) => (seen.has(r) ? false : (seen.add(r), true)))
  return deduped.slice(0, 3)
}
