// Tunable tension recommendation config. Edit these numbers to change how
// the String Finder reasons about tension — no UI or engine code needed.

export interface TensionRange {
  min: number
  max: number
  /** Sensible starting point within the range before personalization. */
  target: number
}

/**
 * Base ranges in kg by self-reported level, before any personalization.
 * These reflect realistic starting points for normal adult club players —
 * guidance, not rigid buckets. Lower tensions (~9–9.5 kg) still surface
 * naturally for beginners, juniors, or anyone leaning hard into "easier
 * power" via GOAL_ADJUSTMENTS or POWER_GENERATION_TENSION_ADJUSTMENTS below;
 * a known current tension the player is happy with always takes priority
 * over these baselines (see recommendTension in tensionRecommendation.ts).
 */
export const LEVEL_BASE_RANGES: Record<string, TensionRange> = {
  beginner: { min: 8.5, max: 10.5, target: 9.5 },
  intermediate: { min: 9.5, max: 11.5, target: 10.5 },
  advanced: { min: 10.5, max: 12, target: 11 },
  tournament: { min: 11, max: 13, target: 12 },
}

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
export const ABSOLUTE_MAX_TENSION = 13.5

/** Safety margin (kg) kept below a user-provided racket max, unless they're already near it. */
export const RACKET_MAX_SAFETY_MARGIN = 0.5

/** Increment used to round all final recommendations to a practical stringing value. */
export const TENSION_ROUNDING_INCREMENT = 0.5

/** kg offered either side of the recommended tension in the "power vs control" comparison slider. */
export const COMPARISON_STEP = 0.5
