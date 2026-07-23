// Tunable config for the SPECIALIST half of the recommendation engine.
// Maps quiz answers to the specialist dimensions in
// data/stringSpecialistProfiles.ts, and controls how much weight the
// specialist layer carries relative to the manufacturer-data layer in
// config/recommendationWeights.ts.
//
// This is the mechanism that stops newer, uniformly-high-rated strings
// (the Exbolt family) from crowding out every recommendation just because
// their official numbers are strong across the board: a string's
// specialist profile can meaningfully outweigh a manufacturer-data
// advantage when the player's answers actually match what that string is
// specialist-known for — see logic/recommendationEngine.ts for the blend.

import type { SpecialistDimensionKey } from '../data/stringSpecialistProfiles'
import type { Confidence } from '../data/stringSpecialistProfiles'

export type SpecialistWeights = Partial<Record<SpecialistDimensionKey, number>>

/** questionId -> optionId -> specialist-dimension deltas. Multi-select answers apply once per selected option. */
export const SPECIALIST_WEIGHT_CONTRIBUTIONS: Record<string, Record<string, SpecialistWeights>> = {
  playStyles: {
    aggressive: { attackSmash: 3, hardHitterFit: 2 },
    fastDoubles: { fastDoubles: 3, flatDriveGame: 2 },
    control: { controlPrecision: 1.5, netTechnical: 1.5, shuttleGripHold: 1.5 },
    defensive: { comfort: 2, mishitTolerance: 1 },
    balanced: { allRoundSuitability: 3 },
  },
  powerGeneration: {
    needsHelp: { easyPower: 3 },
    balanced: { allRoundSuitability: 1 },
    ownPower: { hardHitterFit: 3, directness: 1 },
  },
  priorities: {
    easyPower: { easyPower: 4 },
    hardAttack: { attackSmash: 3, hardHitterFit: 3 },
    fastDrives: { fastDoubles: 3, flatDriveGame: 2 },
    directPrecision: { controlPrecision: 4, directness: 2 },
    shuttleGrip: { shuttleGripHold: 4 },
    netTechnical: { netTechnical: 4 },
    durability: { normalWearDurability: 3, value: 1 },
    comfort: { comfort: 3, softness: 2 },
    tensionRetention: { tensionRetention: 4 },
    sound: { directness: 2 },
  },
  hittingFeel: {
    hardCrisp: { directness: 3, hardHitterFit: 1 },
    mediumBalanced: { allRoundSuitability: 1 },
    softComfortable: { comfort: 3, softness: 3 },
    dontKnow: {},
  },
  /** Only asked when "durability" is one of the player's selected priorities. */
  restringReason: {
    mishitBreakage: { mishitTolerance: 4 },
    wearFraying: { normalWearDurability: 3 },
    tensionLoss: { tensionRetention: 4 },
    rarelyBreak: {},
    notSure: {},
  },
}

/**
 * How much trust to place in a string's specialist score based on its
 * profile-level confidence. 1 = fully trusted, lower values pull the
 * specialist layer's influence toward zero (falling back to manufacturer
 * data) for shakier evidence.
 */
export const CONFIDENCE_TRUST: Record<Confidence, number> = {
  'very-high': 1,
  high: 0.85,
  medium: 0.65,
  low: 0.4,
  unknown: 0.15,
}

/**
 * Hard ceiling on how much of the final score the specialist layer can
 * ever contribute, even at full confidence and full relevance. Deliberately
 * substantial (not a token nudge) — manufacturer data still sets the floor
 * and the specialist layer only engages where the player's answers
 * actually touch dimensions the string has known specialist scores for.
 */
export const SPECIALIST_MAX_INFLUENCE = 0.65
