// Phase 12 — named player-intent archetypes used to (a) pick the dominant
// priority signal out of a player's already-computed weight vectors, purely
// for explanation language and calibration test organization, and (b) give
// scripts/testCalibration.ts and scripts/calibrationReport.ts a shared
// vocabulary for "did the engine behave sensibly for a max-durability
// player" style assertions.
//
// Archetypes never hard-code a winning string id and never add their own
// scoring term. The actual specialization mechanism (the concentration/
// contradiction adjustment in logic/recommendationEngine.ts's
// scoreManufacturer()) reads directly from the player's computed
// DimensionWeights and works the same way regardless of which archetype (if
// any) is detected here — an archetype is a label placed on an outcome the
// weight vector already produces, not a second scoring path.

import { DIMENSIONS, type Dimension, type DimensionWeights } from './recommendationWeights.js'
import type { SpecialistDimensionKey } from '../data/stringSpecialistProfiles.js'
import type { QuizAnswers } from '../logic/types.js'

export type ArchetypeId =
  | 'maxDurability'
  | 'maxRepulsion'
  | 'hardDirectAttack'
  | 'easyPower'
  | 'fastDoublesDrives'
  | 'comfortArmFriendly'
  | 'netPrecisionControl'
  | 'balancedAllRound'
  | 'hittingSoundFeedback'
  | 'tensionRetention'
  | 'beginnerFriendly'

export interface Archetype {
  id: ArchetypeId
  label: string
  /** Manufacturer dimensions (config/recommendationWeights.ts) this archetype cares about most. */
  primaryDimensions: Dimension[]
  secondaryDimensions: Dimension[]
  /** Specialist dimensions (data/stringSpecialistProfiles.ts) this archetype cares about most. */
  primarySpecialistDims: SpecialistDimensionKey[]
  /** One deterministic sentence connecting the player's priorities to how scoring was shaped — prepended to the Best Match explanation only (see buildExplanation in recommendationEngine.ts), never repeated across alternatives. */
  priorityStatement: string
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  maxDurability: {
    id: 'maxDurability',
    label: 'Maximum Durability',
    primaryDimensions: ['durability'],
    secondaryDimensions: ['control'],
    primarySpecialistDims: ['normalWearDurability', 'mishitTolerance', 'value'],
    priorityStatement:
      'You prioritised durability above everything else, so thicker, longer-lasting strings were weighted more heavily than strings that are merely well-rounded on average.',
  },
  maxRepulsion: {
    id: 'maxRepulsion',
    label: 'Maximum Repulsion',
    primaryDimensions: ['repulsion'],
    secondaryDimensions: ['hittingSound'],
    primarySpecialistDims: ['easyPower', 'fastDoubles', 'flatDriveGame'],
    priorityStatement:
      'You prioritised raw repulsion and power over control or durability, so livelier, more lightly-built strings were weighted more heavily.',
  },
  hardDirectAttack: {
    id: 'hardDirectAttack',
    label: 'Hard-Hitting Attacking Control',
    primaryDimensions: ['control', 'repulsion'],
    secondaryDimensions: ['hittingSound'],
    primarySpecialistDims: ['hardHitterFit', 'attackSmash', 'directness'],
    priorityStatement:
      'You selected power, control and a hard, direct response together, which strongly favours crisp attacking strings over soft, forgiving ones.',
  },
  easyPower: {
    id: 'easyPower',
    label: 'Easy Power',
    primaryDimensions: ['repulsion', 'shockAbsorption'],
    secondaryDimensions: [],
    primarySpecialistDims: ['easyPower', 'beginnerFriendliness'],
    priorityStatement:
      'You wanted easier power with less effort from your own swing, so forgiving, lively strings were weighted more heavily than strings built for players who already generate their own pace.',
  },
  fastDoublesDrives: {
    id: 'fastDoublesDrives',
    label: 'Fast Doubles & Drives',
    primaryDimensions: ['repulsion', 'control'],
    secondaryDimensions: ['hittingSound'],
    primarySpecialistDims: ['fastDoubles', 'flatDriveGame'],
    priorityStatement:
      'You prioritised quick reflex speed for doubles and drives, so fast-responding strings were weighted more heavily than pure power or pure durability strings.',
  },
  comfortArmFriendly: {
    id: 'comfortArmFriendly',
    label: 'Comfort & Arm-Friendliness',
    primaryDimensions: ['shockAbsorption'],
    secondaryDimensions: ['control'],
    primarySpecialistDims: ['comfort', 'softness', 'mishitTolerance'],
    priorityStatement:
      'You preferred comfort and a forgiving feel, so softer strings were weighted more heavily and very hard, direct string beds received a penalty.',
  },
  netPrecisionControl: {
    id: 'netPrecisionControl',
    label: 'Net Precision & Control',
    primaryDimensions: ['control'],
    secondaryDimensions: ['shockAbsorption'],
    primarySpecialistDims: ['controlPrecision', 'netTechnical', 'shuttleGripHold'],
    priorityStatement:
      'You prioritised precision and touch over raw power, so control-focused strings were weighted more heavily than strings that just generate more general power.',
  },
  balancedAllRound: {
    id: 'balancedAllRound',
    label: 'Balanced All-Round',
    primaryDimensions: ['repulsion', 'control', 'durability'],
    secondaryDimensions: ['shockAbsorption', 'hittingSound'],
    primarySpecialistDims: ['allRoundSuitability'],
    priorityStatement: 'Your answers were fairly balanced across priorities, so no single dimension was weighted much more heavily than the others.',
  },
  hittingSoundFeedback: {
    id: 'hittingSoundFeedback',
    label: 'Hitting Sound & Feedback',
    primaryDimensions: ['hittingSound'],
    secondaryDimensions: ['repulsion'],
    primarySpecialistDims: ['directness'],
    priorityStatement: 'You valued a crisp hitting sound and feedback, so strings with a sharper, more connected feel were weighted more heavily.',
  },
  tensionRetention: {
    id: 'tensionRetention',
    label: 'Tension Retention',
    primaryDimensions: ['durability'],
    secondaryDimensions: ['control'],
    primarySpecialistDims: ['tensionRetention'],
    priorityStatement:
      'You prioritised keeping a lively feel for longer between restrings, so strings known for holding their tension were weighted more heavily.',
  },
  beginnerFriendly: {
    id: 'beginnerFriendly',
    label: 'Beginner-Friendly',
    primaryDimensions: ['shockAbsorption', 'control'],
    secondaryDimensions: [],
    primarySpecialistDims: ['beginnerFriendliness', 'mishitTolerance'],
    priorityStatement: "You're still building your game, so forgiving, easy-to-play strings were weighted more heavily than narrow performance specialists.",
  },
}

/** Below this weight-vector standard deviation, the player's priorities are treated as genuinely balanced rather than forced into whichever single archetype happens to score highest. Tuned against scripts/calibrationReport.ts's scenario set. */
const BALANCED_SPREAD_THRESHOLD = 0.05

function weightSpread(profile: DimensionWeights): number {
  const values = DIMENSIONS.map((d) => profile[d])
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Picks the archetype whose declared dimensions best match the player's
 * OWN already-computed weight vectors — used only for explanation copy and
 * calibration test labeling, never fed back into scoring. `specialistWeights`
 * is a plain lookup (not the branded SpecialistWeightVector type) so this
 * module doesn't need to import recommendationEngine.ts and create a cycle.
 */
export function detectDominantArchetype(
  profile: DimensionWeights,
  specialistWeights: Partial<Record<SpecialistDimensionKey, number>>,
  answers: QuizAnswers,
): ArchetypeId {
  if (weightSpread(profile) < BALANCED_SPREAD_THRESHOLD) return 'balancedAllRound'

  let best: ArchetypeId = 'balancedAllRound'
  let bestScore = -Infinity
  for (const archetype of Object.values(ARCHETYPES)) {
    if (archetype.id === 'balancedAllRound') continue
    let score = 0
    for (const d of archetype.primaryDimensions) score += profile[d] * 2
    for (const d of archetype.secondaryDimensions) score += profile[d]
    for (const k of archetype.primarySpecialistDims) score += (specialistWeights[k] ?? 0) * 0.15
    if (score > bestScore) {
      bestScore = score
      best = archetype.id
    }
  }

  // Small, explicit tiebreaker from the player's own literal selection (not
  // invented data): a self-declared beginner whose comfort/control emphasis
  // is close to the detected winner is shown the beginner framing instead,
  // since "comfort-focused" and "beginner-friendly" produce near-identical
  // weight vectors but very different explanation language.
  if (answers.level === 'beginner' && best !== 'beginnerFriendly') {
    const beginnerScore = profile.shockAbsorption * 2 + profile.control + (specialistWeights.beginnerFriendliness ?? 0) * 0.15
    if (beginnerScore >= bestScore - 0.05) best = 'beginnerFriendly'
  }

  return best
}
