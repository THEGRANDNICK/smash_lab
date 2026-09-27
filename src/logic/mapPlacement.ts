// Map placement — the quick way to profile a string.
//
// Instead of typing up to 17 separate 1–5 dimension scores, the stringer
// drops the string onto the same feel map players see (Maximum Hold <->
// Quick Repulsion, Soft <-> Hard) and answers two small durability
// questions. Every specialist dimension that can honestly be read off
// those three inputs is derived here.
//
// Rules:
//   - An explicitly typed dimension ALWAYS wins over a derived one. The
//     placement only fills blanks, so existing hand-tuned profiles
//     (BG80, Nanogy 99, …) behave exactly as before.
//   - Derived dimensions are marked with a confidence one step below the
//     profile's own (never above 'medium'), so the engine trusts a
//     hand-typed value more than a map-derived one.
//   - tensionRetention and value are deliberately NOT derived — nothing
//     on the map says anything about them.

import type { Confidence, SpecialistDimensionKey, SpecialistDimensions, StringSpecialistProfile } from '../data/stringSpecialistProfiles.js'

export type MishitBehaviour = 'robust' | 'normal' | 'sensitive'

export interface MapPlacement {
  /** 0 = Maximum Hold, 1 = Quick Repulsion — same scale as the public String Map. */
  holdRepulsion: number
  /** 0 = Soft Feel, 1 = Hard Feel — same scale as the public String Map. */
  softHard: number
  /** Everyday wear durability, 1 (fragile) – 5 (bomb-proof). Optional. */
  durability?: number
  /** How it copes with bad off-centre hits. Optional. */
  mishit?: MishitBehaviour
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Plotted strings rarely sit at the very edge of the map, so a straight
 * linear mapping would squash every derived score into ~2–4. This mild
 * contrast stretch lets a clearly hard/lively placement actually reach
 * 4.5–5, like a hand-typed profile would.
 */
const CONTRAST = 1.4
const stretch = (t: number) => clamp01(0.5 + (t - 0.5) * CONTRAST)

/** 0–1 -> 1–5, rounded to a quarter point so the admin sees tidy numbers. */
const toScore = (t: number) => Math.round((1 + 4 * stretch(t)) * 4) / 4

const MISHIT_SCORE: Record<MishitBehaviour, number> = { robust: 5, normal: 3, sensitive: 1.5 }

export function isValidPlacement(p: unknown): p is MapPlacement {
  if (p == null || typeof p !== 'object') return false
  const m = p as Record<string, unknown>
  const inUnit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  if (!inUnit(m.holdRepulsion) || !inUnit(m.softHard)) return false
  if (m.durability != null && (typeof m.durability !== 'number' || m.durability < 1 || m.durability > 5)) return false
  if (m.mishit != null && !['robust', 'normal', 'sensitive'].includes(m.mishit as string)) return false
  return true
}

/** Every dimension the map can speak to, derived from one placement. */
export function deriveDimensions(p: MapPlacement): SpecialistDimensions {
  const x = clamp01(p.holdRepulsion) // lively
  const y = clamp01(p.softHard) // hard
  const hold = 1 - x
  const soft = 1 - y

  const dims: SpecialistDimensions = {
    easyPower: toScore(0.6 * x + 0.4 * soft),
    hardHitterFit: toScore(0.65 * y + 0.35 * hold),
    attackSmash: toScore(0.5 * x + 0.5 * y),
    fastDoubles: toScore(0.75 * x + 0.25 * y),
    flatDriveGame: toScore(0.7 * x + 0.3 * y),
    controlPrecision: toScore(0.6 * hold + 0.4 * y),
    shuttleGripHold: toScore(hold),
    netTechnical: toScore(0.75 * hold + 0.25 * soft),
    comfort: toScore(soft),
    softness: toScore(soft),
    directness: toScore(y),
    // Distance from the centre of the map: close to the middle = all-rounder.
    allRoundSuitability: toScore(1 - Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2.2)),
  }

  if (p.durability != null) dims.normalWearDurability = p.durability
  const mishitScore = p.mishit ? MISHIT_SCORE[p.mishit] : p.durability
  if (mishitScore != null) dims.mishitTolerance = mishitScore

  // Forgiving = softer feel + survives mishits.
  const mishitUnit = mishitScore != null ? (mishitScore - 1) / 4 : 0.5
  dims.beginnerFriendliness = toScore(0.5 * soft + 0.5 * mishitUnit)

  return dims
}

const CONFIDENCE_ORDER: Confidence[] = ['unknown', 'low', 'medium', 'high', 'very-high']

/** One step below the profile's confidence, capped at 'medium'. */
export function derivedConfidence(profileConfidence: Confidence): Confidence {
  const i = CONFIDENCE_ORDER.indexOf(profileConfidence)
  return CONFIDENCE_ORDER[Math.max(0, Math.min(i - 1, CONFIDENCE_ORDER.indexOf('medium')))]
}

/**
 * Returns the profile with map-derived dimensions filled in wherever the
 * stringer left a blank. Profiles without a placement come back untouched.
 */
export function applyMapPlacement(profile: StringSpecialistProfile): StringSpecialistProfile {
  if (!profile.mapPlacement) return profile
  const derived = deriveDimensions(profile.mapPlacement)
  const dimensions: SpecialistDimensions = { ...profile.dimensions }
  const dimensionConfidence = { ...(profile.dimensionConfidence ?? {}) }
  const conf = derivedConfidence(profile.confidence)

  for (const [key, value] of Object.entries(derived) as [SpecialistDimensionKey, number][]) {
    if (dimensions[key] != null) continue // hand-typed value wins
    dimensions[key] = value
    if (dimensionConfidence[key] == null) dimensionConfidence[key] = conf
  }
  return { ...profile, dimensions, dimensionConfidence }
}

export function applyMapPlacementToAll(profiles: Record<string, StringSpecialistProfile>): Record<string, StringSpecialistProfile> {
  return Object.fromEntries(Object.entries(profiles).map(([id, p]) => [id, applyMapPlacement(p)]))
}
