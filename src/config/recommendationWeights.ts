// Tunable scoring config for the String Finder — the MANUFACTURER-DATA
// half of the engine. Each answer nudges a "desired profile" across the 5
// dimensions that mirror the string database's official ratings. Adjust
// these numbers any time to change how the quiz behaves — no UI or engine
// code needs to change.
//
// The much larger effect of most of these same answers is the SEPARATE
// specialist-knowledge layer in config/specialistWeights.ts, which is what
// actually differentiates strings whose manufacturer numbers look similar
// (or, in BG80's case, modest) — see logic/recommendationEngine.ts for how
// the two layers are blended.
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

/**
 * questionId -> optionId -> weight deltas applied to the player's profile.
 * `playStyles` and `priorities` are multi-select answers (arrays); the
 * engine applies each selected option's contribution in turn.
 */
export const WEIGHT_CONTRIBUTIONS: Record<string, Record<string, Contribution>> = {
  level: {
    beginner: { shockAbsorption: 1, control: 0.5 },
    intermediate: { control: 0.5, repulsion: 0.5 },
    advanced: { control: 1, hittingSound: 0.5 },
    tournament: { control: 1, hittingSound: 1 },
  },
  playStyles: {
    aggressive: { repulsion: 3, hittingSound: 2, control: 1, durability: 1 },
    fastDoubles: { repulsion: 2, control: 2, hittingSound: 1, durability: 1 },
    control: { control: 3, repulsion: 1, hittingSound: 1, shockAbsorption: 1 },
    defensive: { control: 2, shockAbsorption: 2, durability: 1 },
    balanced: { repulsion: 1.5, control: 1.5, durability: 1.5, hittingSound: 1.5, shockAbsorption: 1.5 },
  },
  powerGeneration: {
    needsHelp: { repulsion: 1, shockAbsorption: 0.5 },
    balanced: {},
    ownPower: { control: 0.5, hittingSound: 0.5 },
  },
  // NOTE: directPrecision / shuttleGrip / netTechnical are deliberately
  // modest here — they're three DIFFERENT flavors of "control" that many
  // strings' single manufacturer control number can't distinguish (several
  // strings all max out at control:10). Differentiating between them is
  // the specialist layer's job (config/specialistWeights.ts); the
  // manufacturer layer only needs a light general nudge.
  priorities: {
    easyPower: { repulsion: 4 },
    hardAttack: { repulsion: 1.5, control: 1 },
    fastDrives: { repulsion: 1.5, control: 1 },
    directPrecision: { control: 1.5 },
    shuttleGrip: { control: 1 },
    netTechnical: { control: 1, shockAbsorption: 0.5 },
    durability: { durability: 4 },
    comfort: { shockAbsorption: 4 },
    tensionRetention: { durability: 1, control: 0.5 },
    sound: { hittingSound: 4 },
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
  restringReason: {
    mishitBreakage: { durability: 2 },
    wearFraying: { durability: 2 },
    tensionLoss: { durability: 1 },
    rarelyBreak: {},
    notSure: {},
  },
}
