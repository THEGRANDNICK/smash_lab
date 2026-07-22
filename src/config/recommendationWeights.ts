// Tunable scoring config for the String Finder.
// Each answer nudges a "desired profile" across 5 dimensions that mirror
// the string database's ratings. Adjust these numbers any time to change
// how the quiz behaves — no UI or engine code needs to change.
//
// Dimensions are unbounded positive weights; they get normalized before
// scoring, so only the *relative* size of numbers matters.

export type Dimension = 'repulsion' | 'durability' | 'hittingSound' | 'shockAbsorption' | 'control'

export const DIMENSIONS: Dimension[] = ['repulsion', 'durability', 'hittingSound', 'shockAbsorption', 'control']

export type DimensionWeights = Record<Dimension, number>

export const ZERO_WEIGHTS: DimensionWeights = {
  repulsion: 0,
  durability: 0,
  hittingSound: 0,
  shockAbsorption: 0,
  control: 0,
}

/** A small baseline on every dimension so no string ever scores literally 0%. */
export const BASELINE_WEIGHT = 0.6

type Contribution = Partial<DimensionWeights>

/** questionId -> optionId -> weight deltas applied to the player's profile. */
export const WEIGHT_CONTRIBUTIONS: Record<string, Record<string, Contribution>> = {
  level: {
    beginner: { shockAbsorption: 1, control: 0.5 },
    intermediate: { control: 0.5, repulsion: 0.5 },
    advanced: { control: 1, hittingSound: 0.5 },
    tournament: { control: 1, hittingSound: 1 },
  },
  style: {
    aggressive: { repulsion: 3, hittingSound: 2, control: 1, durability: 1 },
    fastDoubles: { repulsion: 2, control: 2, hittingSound: 1, durability: 1 },
    control: { control: 3, repulsion: 1, hittingSound: 1, shockAbsorption: 1 },
    defensive: { control: 2, shockAbsorption: 2, durability: 1 },
    balanced: { repulsion: 1.5, control: 1.5, durability: 1.5, hittingSound: 1.5, shockAbsorption: 1.5 },
  },
  // Modest raw-dimension nudges only — the bulk of this answer's effect is
  // the contextual fit bonus in config/recommendationModifiers.ts, applied
  // via recommendation metadata rather than by inflating these weights.
  powerGeneration: {
    needsHelp: { repulsion: 1, shockAbsorption: 0.5 },
    balanced: {},
    ownPower: { control: 0.5, hittingSound: 0.5 },
  },
  priority: {
    repulsion: { repulsion: 4 },
    control: { control: 4 },
    durability: { durability: 4 },
    feel: { hittingSound: 4 },
    comfort: { shockAbsorption: 4 },
    balanced: { repulsion: 2, control: 2, durability: 2, hittingSound: 2, shockAbsorption: 2 },
  },
  durabilityImportance: {
    veryImportant: { durability: 4 },
    somewhat: { durability: 1.5 },
    performanceFirst: { repulsion: 1, control: 1 },
  },
  hittingFeel: {
    hardCrisp: { hittingSound: 3, repulsion: 1 },
    mediumBalanced: { hittingSound: 1, control: 1, shockAbsorption: 1 },
    softComfortable: { shockAbsorption: 3 },
    dontKnow: {},
  },
  frequency: {
    occasionally: { durability: 0.5 },
    oneTwoWeek: { durability: 1 },
    threePlusWeek: { durability: 2 },
  },
  breakStrings: {
    yes: { durability: 4 },
    sometimes: { durability: 2 },
    rarely: { repulsion: 0.5 },
  },
}
