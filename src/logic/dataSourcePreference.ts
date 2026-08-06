// Phase 14 — the quiz's manufacturer-only vs. manufacturer+specialist
// setting. A display/input-selection choice only; recommendationEngine.ts
// itself is never modified (per the brief) — this module's only job is
// resolving which specialist-profile object recommendStrings() and
// RecommendationResult receive: the real map (untouched, default) or {}
// for a manufacturer-only run. recommendStrings() already produces
// manufacturer-only scoring given an empty map — see
// scripts/testCalibration.ts's own "Missing specialist-profile data"
// suite, which this module deliberately reuses rather than duplicates.

import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles.js'

export type DataSource = 'manufacturer-only' | 'manufacturer-specialist'

/** "Manufacturer + Specialist calibration" is the app's recommended, default mode. */
export const DEFAULT_DATA_SOURCE: DataSource = 'manufacturer-specialist'

/** The one-line note shown near the recommendation podium/String Map explaining which data the ranking/positions are based on — exact wording from the Phase 14 refinement brief. */
export const DATA_SOURCE_NOTE: Record<DataSource, string> = {
  'manufacturer-only': 'Based on manufacturer data.',
  'manufacturer-specialist': 'Calibrated with Smash Lab specialist data.',
}

/**
 * Resolves which specialist-profile object to pass into
 * recommendStrings()/RecommendationResult/StringMap: `{}` (never `undefined`)
 * for manufacturer-only, so every caller's own "specialistProfiles ? ... :
 * getSpecialistProfile(...)" fallback pattern is bypassed rather than
 * silently reverting to the default local lookup. Passes `specialistProfiles`
 * through unchanged for the manufacturer+specialist mode — including
 * `undefined`, which every caller already treats as "use the default".
 */
export function resolveSpecialistProfiles(
  dataSource: DataSource,
  specialistProfiles: Record<string, StringSpecialistProfile> | undefined,
): Record<string, StringSpecialistProfile> | undefined {
  return dataSource === 'manufacturer-only' ? {} : specialistProfiles
}
