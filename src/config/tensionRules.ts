// Tunable tension recommendation config. Edit these numbers to change how
// the String Finder reasons about tension — no UI or engine code needed.

export interface TensionRange {
  min: number
  max: number
  /** Sensible starting point within the range before personalization. */
  target: number
}

/**
 * Base ranges in kg by self-reported level, before any personalization (Smash Lab v2).
 *
 * Beginners follow Badminton Insight's video (Aug 2026): at most 24 lb, stated there as 11 kg.
 * Club players follow the stringer's own practice instead of the video's 24–27+ lb: 11.5 kg,
 * at most 12 kg — because the crosses are strung 1 kg above the mains (see CROSS_OFFSET_KG), and
 * at 12 kg the crosses already sit at the 12.5 kg most Yonex rackets allow.
 * A known current tension the player is happy with always takes priority over these baselines
 * (see recommendTension in tensionRecommendation.ts).
 */
export const LEVEL_BASE_RANGES: Record<string, TensionRange> = {
  beginner: { min: 9, max: 11, target: 10 },
  intermediate: { min: 10.5, max: 12, target: 11.5 },
  advanced: { min: 11, max: 12, target: 11.5 },
  // Tournament players follow the video: "27 lb and upwards" (≈12.25 kg); the presenters string at
  // 30 lb (Greg, VBS-66 Nano ≈13.6 kg) and 29 lb (Jenny, VBS-68 ≈13.15 kg) — 11:25 in the video.
  // Only reachable with a CHECKED racket maximum: without it the crosses stop at the assumed 12.5 kg.
  tournament: { min: 12.25, max: 13.6, target: 12.7 },
}

/**
 * The stated tension is the average: mains are strung CROSS_OFFSET_KG below it, crosses the same
 * amount above (e.g. 12 kg → mains 11.5 kg, crosses 12.5 kg). The crosses must never exceed the
 * racket's maximum.
 */
export const CROSS_OFFSET_KG = 0.5

/** Maximum assumed when the player doesn't know theirs: what most Yonex rackets allow. */
export const DEFAULT_RACKET_MAX_KG = 12.5

/** Beginners: never above 24 lb — the video states this as 11 kg — unless they already play a known, higher tension. */
export const BEGINNER_MAX_TENSION = 11

/**
 * Thinner strings → a little LESS tension, to offset their lower durability while keeping their
 * liveliness (same source). Replaces the old per-string adjustments, which did the opposite.
 * Checked top-down: the first row whose maxGauge the string's gauge doesn't exceed applies.
 * Hybrids use their thinner side (that's the one that breaks).
 */
export const GAUGE_TENSION_ADJUSTMENTS: { maxGauge: number; adjustKg: number }[] = [
  { maxGauge: 0.63, adjustKg: -0.5 },
  { maxGauge: 0.66, adjustKg: -0.25 },
  { maxGauge: Infinity, adjustKg: 0 },
]

/** Frequent mishit breakage → lower tension (and better timing) — the video recommends both. */
export const MISHIT_TENSION_ADJUSTMENT = -0.5

/** Nudge (kg) applied based on what the player wants from their racket. */
export const GOAL_ADJUSTMENTS: Record<string, number> = {
  easyPower: -0.5,
  balancedGoal: 0,
  precision: 0.5,
}

/**
 * Small additional nudge (kg) based on self-reported power generation —
 * deliberately modest so it never causes a large jump on its own, even
 * stacked with GOAL_ADJUSTMENTS or the current-tension-feel adjustment.
 */
export const POWER_GENERATION_TENSION_ADJUSTMENTS: Record<string, number> = {
  needsHelp: -0.25,
  balanced: 0,
  ownPower: 0.25,
}

/**
 * When the player already knows their current tension, it becomes the
 * strongest reference point. These are the nudges (kg) applied on top of
 * their current tension based on how it currently feels — deliberately
 * small so we never suggest a drastic jump from a setup they're used to.
 */
export const CURRENT_TENSION_FEEL_ADJUSTMENTS: Record<string, number> = {
  wantPower: -0.5,
  aboutRight: 0,
  wantControl: 0.5,
  notSure: 0, // handled specially: blend toward the level-based target instead
}

/** How strongly we blend toward the level-based target when the player isn't sure how their tension feels. */
export const UNSURE_BLEND_TOWARD_BASELINE = 0.3

/** Absolute sane floor/ceiling regardless of any other input. */
export const ABSOLUTE_MIN_TENSION = 7
export const ABSOLUTE_MAX_TENSION = 14

/** Safety margin (kg) kept below a user-provided racket max, unless they're already near it. */
export const RACKET_MAX_SAFETY_MARGIN = 0.5

/** Increment used to round all final recommendations to a practical stringing value. */
export const TENSION_ROUNDING_INCREMENT = 0.5

/** kg offered either side of the recommended tension in the "power vs control" comparison slider. */
export const COMPARISON_STEP = 0.5
