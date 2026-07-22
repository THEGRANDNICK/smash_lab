// Tunable scoring modifiers layered on top of the primary weighted-dimension
// match score. These translate the recommendation metadata in
// data/stringRecommendationMeta.ts into small, capped score nudges — never
// large enough to override a string's fundamental fit, just enough to
// surface genuinely well-suited strings whose manufacturer ratings alone
// wouldn't make them stand out (e.g. an older, modestly-rated string that's
// still a strong practical fit for a specific kind of player).

import type { StringFeel } from '../data/stringRecommendationMeta'

/** Points added when the player's self-reported power generation matches a string's powerGenerationFit (before the answer-specific scale below is applied). */
export const POWER_GENERATION_FIT_BONUS = 24

/**
 * Scales the power-generation bonus by which answer was given. "Balanced"
 * is the neutral middle option most players pick by default, so it's
 * deliberately dampened — otherwise it would saturate scores for every
 * string tagged as suiting balanced players and erase differentiation.
 * "needsHelp" and "ownPower" are deliberate, informative signals and get
 * the full bonus (further scaled for "ownPower" by level, below).
 */
export const POWER_GENERATION_ANSWER_SCALE: Record<string, number> = {
  needsHelp: 1,
  balanced: 0.3,
  ownPower: 1,
}

/** Points added when the player's stated stringbed feel preference matches a string's characterized feel. */
export const FEEL_FIT_BONUS = 5

/** Hard ceiling on the combined bonus, so metadata can meaningfully reorder close contenders but never fully substitute for the primary weighted-dimension score. */
export const MAX_FIT_BONUS = 28

/**
 * Maps the "hittingFeel" quiz answer to the stringbed-feel vocabulary used
 * in recommendation metadata. "Not sure" intentionally maps to nothing so
 * it doesn't influence scoring.
 */
export const HITTING_FEEL_TO_STRING_FEEL: Record<string, StringFeel | undefined> = {
  hardCrisp: 'hard',
  mediumBalanced: 'medium',
  softComfortable: 'soft',
  dontKnow: undefined,
}

/**
 * Scales the "generates plenty of own power" bonus by self-reported level.
 * A beginner who nonetheless claims to hit hard still gets some credit, but
 * not the full bonus — power-oriented performance strings shouldn't become
 * the default beginner recommendation just because of one answer.
 */
export const OWN_POWER_LEVEL_SCALE: Record<string, number> = {
  beginner: 0.5,
  intermediate: 1,
  advanced: 1,
  tournament: 1,
}
