// Phase 14 refinement — pure position derivation for the String Map
// visualization. Never a hardcoded per-string {x, y} — every position is
// computed from real data fields already in data/strings.ts /
// data/stringSpecialistProfiles.ts, so a new string automatically gets a
// sensible, honest position with no manual placement step.
//
// Two axes:
//   Horizontal — Maximum Hold (0) <-> Quick Repulsion (1). Anchored on the
//     manufacturer `repulsion` rating (0-11, the same scale used
//     identically across every brand), since "quick repulsion" is
//     literally what that rating measures — no invented concept. In
//     calibrated mode, a specialist's `shuttleGripHold` assessment (a more
//     specific, hands-on read of hold/grip character) nudges the position
//     by a capped, documented amount — it never overrides the
//     manufacturer number outright, since control/hold and repulsion are
//     related but distinct, not interchangeable (a common mistake this
//     deliberately avoids: `control` is never treated as a direct proxy
//     for hold).
//   Vertical — Soft Feel (0) <-> Hard Feel (1). No single existing field
//     measures this directly, so it's derived from the most specific
//     signal available, in order: the specialist `softness`/`directness`
//     dimensions (explicit, hands-on assessments of this exact axis —
//     averaged when both are present), then `comfort` (a closely related
//     specialist dimension omitted from earlier versions of this
//     derivation, which caused strings with real comfort data but no
//     `softness`/`feel` entry — e.g. Nanogy 99 — to fall through to a
//     much less informative signal and land near the middle instead of
//     clearly soft), then the specialist's coarser `feel` label, then the
//     manufacturer `shockAbsorption` rating as a last-resort proxy (more
//     shock absorbed tends to read as a softer string, though it is not
//     the same property as string stiffness), and only a documented
//     neutral midpoint when nothing at all is known — never a guessed
//     number presented as real.
//
// Hybrid strings (StringItem.isHybrid) need no special handling here: like
// the recommendation engine, this module scores the hybrid as a whole
// from its own top-level repulsion/shockAbsorption fields — those already
// represent the combined construction, exactly like any other string.

import type { StringItem } from '../data/strings.js'
import type { SpecialistFeel, StringSpecialistProfile } from '../data/stringSpecialistProfiles.js'

/** Matches catalogService.ts's RATING_MIN/RATING_MAX — the shared 0-11 manufacturer rating scale. */
export const MANUFACTURER_RATING_MAX = 11
/** SpecialistDimensions are scored 1-5 (see stringSpecialistProfiles.ts). */
export const SPECIALIST_DIMENSION_MIN = 1
export const SPECIALIST_DIMENSION_MAX = 5

/** Capped influence a specialist's shuttleGripHold assessment can have on the horizontal position — a nudge, never a replacement for the manufacturer repulsion number. */
const SHUTTLE_GRIP_HOLD_INFLUENCE = 0.3

export type SoftHardSource = 'specialist-softness-directness' | 'specialist-comfort' | 'specialist-feel' | 'manufacturer-shock-absorption' | 'unknown'
export type HoldRepulsionSource = 'manufacturer-repulsion' | 'manufacturer-repulsion-specialist-hold-blend'

export interface StringMapPosition {
  /** 0 = Maximum Hold, 1 = Quick Repulsion. */
  holdRepulsion: number
  /** 0 = Soft Feel, 1 = Hard Feel. */
  softHard: number
  /** Which signal actually produced softHard — exposed for tests and for an honest "why is this string here" tooltip, never hidden from the UI. */
  softHardSource: SoftHardSource
  /** Which signal(s) produced holdRepulsion. */
  holdRepulsionSource: HoldRepulsionSource
}

const FEEL_TO_HARD_RATIO: Record<SpecialistFeel, number> = {
  soft: 0.15,
  medium: 0.5,
  hard: 0.85,
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Maps a 1-5 specialist dimension where a HIGHER value means SOFTER (e.g. softness) to the 0(soft)-1(hard) softHard scale. */
function softnessDimensionToSoftHard(value: number): number {
  return clamp01(1 - (value - SPECIALIST_DIMENSION_MIN) / (SPECIALIST_DIMENSION_MAX - SPECIALIST_DIMENSION_MIN))
}

/** Maps a 1-5 specialist dimension where a HIGHER value means HARDER/more direct (directness) to the 0(soft)-1(hard) softHard scale. */
function directnessDimensionToSoftHard(value: number): number {
  return clamp01((value - SPECIALIST_DIMENSION_MIN) / (SPECIALIST_DIMENSION_MAX - SPECIALIST_DIMENSION_MIN))
}

function computeSoftHard(specialistProfile: StringSpecialistProfile | undefined, item: StringItem, useSpecialistData: boolean): { softHard: number; source: SoftHardSource } {
  if (useSpecialistData && specialistProfile) {
    const { softness, directness, comfort } = specialistProfile.dimensions

    // Tier 1: explicit, hands-on assessments of this exact axis. Averaged
    // when both are recorded, used alone when only one is.
    const explicitReadings: number[] = []
    if (softness != null) explicitReadings.push(softnessDimensionToSoftHard(softness))
    if (directness != null) explicitReadings.push(directnessDimensionToSoftHard(directness))
    if (explicitReadings.length > 0) {
      const softHard = explicitReadings.reduce((a, b) => a + b, 0) / explicitReadings.length
      return { softHard, source: 'specialist-softness-directness' }
    }

    // Tier 2: comfort is a closely related (not identical) specialist
    // dimension — real, specific, hands-on data that should be preferred
    // over the coarser feel label below.
    if (comfort != null) {
      return { softHard: softnessDimensionToSoftHard(comfort), source: 'specialist-comfort' }
    }

    // Tier 3: the coarse 3-bucket feel label — still a direct specialist
    // judgment, just lower resolution than the dimensions above.
    if (specialistProfile.feel != null) {
      return { softHard: FEEL_TO_HARD_RATIO[specialistProfile.feel], source: 'specialist-feel' }
    }
  }

  // Tier 4: manufacturer shockAbsorption as a last-resort proxy — real,
  // objective data, but an indirect measurement of a different (related)
  // property than string stiffness/hardness itself.
  if (item.shockAbsorption != null) {
    return { softHard: clamp01(1 - item.shockAbsorption / MANUFACTURER_RATING_MAX), source: 'manufacturer-shock-absorption' }
  }

  // Tier 5: nothing known at all — a documented neutral midpoint, never a guess presented as real.
  return { softHard: 0.5, source: 'unknown' }
}

function computeHoldRepulsion(specialistProfile: StringSpecialistProfile | undefined, item: StringItem, useSpecialistData: boolean): { holdRepulsion: number; source: HoldRepulsionSource } {
  const manufacturerHoldRepulsion = clamp01(item.repulsion / MANUFACTURER_RATING_MAX)

  const shuttleGripHold = useSpecialistData ? specialistProfile?.dimensions.shuttleGripHold : undefined
  if (shuttleGripHold == null) {
    return { holdRepulsion: manufacturerHoldRepulsion, source: 'manufacturer-repulsion' }
  }

  // Higher shuttleGripHold = more grip/hold = further toward the "Maximum Hold" end (lower holdRepulsion).
  const specialistHoldReading = 1 - (shuttleGripHold - SPECIALIST_DIMENSION_MIN) / (SPECIALIST_DIMENSION_MAX - SPECIALIST_DIMENSION_MIN)
  const blended = clamp01(manufacturerHoldRepulsion * (1 - SHUTTLE_GRIP_HOLD_INFLUENCE) + specialistHoldReading * SHUTTLE_GRIP_HOLD_INFLUENCE)
  return { holdRepulsion: blended, source: 'manufacturer-repulsion-specialist-hold-blend' }
}

/**
 * Computes one string's String Map position. `useSpecialistData` mirrors
 * the quiz's manufacturer-only vs. manufacturer+specialist toggle (and, in
 * the general catalogue map, its own Manufacturer/Calibrated toggle) —
 * when false, only manufacturer fields are ever consulted, exactly like
 * recommendStrings() with an empty specialist-profile map.
 */
export function computeStringMapPosition(item: StringItem, specialistProfile: StringSpecialistProfile | undefined, useSpecialistData: boolean): StringMapPosition {
  const { softHard, source: softHardSource } = computeSoftHard(specialistProfile, item, useSpecialistData)
  const { holdRepulsion, source: holdRepulsionSource } = computeHoldRepulsion(specialistProfile, item, useSpecialistData)
  return { holdRepulsion, softHard, softHardSource, holdRepulsionSource }
}
