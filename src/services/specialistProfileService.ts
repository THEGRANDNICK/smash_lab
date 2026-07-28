// Phase 6: the ONLY place that queries Supabase for specialist profile
// (public.specialist_profiles) data. Components never call Supabase
// directly — they consume the plain Record<string, StringSpecialistProfile>
// this module (via hooks/useSpecialistProfiles.ts) produces, and the
// recommendation engine takes that map as a parameter (see
// logic/recommendationEngine.ts) — it never knows whether it came from
// Supabase or the local fallback file.
//
// Unlike the catalog (services/catalogService.ts), specialist profiles are
// deliberately SPARSE by design — most strings legitimately have no
// profile at all, and that's normal, not corruption. So there is no
// "completeness" gate here: any structurally valid live fetch is used
// as-is (even if its coverage differs from the local file), while a
// fetch that fails outright (network/config/error) falls back entirely
// to the local file. This mirrors Phase 2's inventory fallback pattern
// more than Phase 4's stricter catalog completeness pattern, because a
// missing profile is expected here, not a sign something is broken.

import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile, type SpecialistFeel, type ExperienceSource, type Confidence, type SpecialistDimensionKey } from '../data/stringSpecialistProfiles.js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import type { Database } from '../types/database.js'

type SpecialistProfileRow = Database['public']['Tables']['specialist_profiles']['Row']

export type SpecialistSource = 'live' | 'fallback'

export interface SpecialistFetchStatus {
  at: string
  source: SpecialistSource
  acceptedCount: number
  rejectedCount: number
  rejectedReasons: string[]
  fallbackReason?: string
}

export interface SpecialistFetchResult {
  profiles: Record<string, StringSpecialistProfile>
  status: SpecialistFetchStatus
}

let lastFetchStatus: SpecialistFetchStatus | null = null

/** For the /debug/supabase page — reports the outcome of the most recent fetchSpecialistProfilesFromSupabase() call, if any has run yet this session. */
export function getLastSpecialistFetchStatus(): SpecialistFetchStatus | null {
  return lastFetchStatus
}

/** The complete local specialist profile set — used as the fallback whenever Supabase is unreachable or not configured. Never mutated. */
export function getLocalFallbackSpecialistProfiles(): Record<string, StringSpecialistProfile> {
  return STRING_SPECIALIST_PROFILES
}

const VALID_FEEL: readonly SpecialistFeel[] = ['hard', 'medium', 'soft']
const VALID_EXPERIENCE_SOURCE: readonly ExperienceSource[] = ['personal', 'club', 'stringing-observation', 'manufacturer', 'community', 'mixed']
const VALID_CONFIDENCE: readonly Confidence[] = ['very-high', 'high', 'medium', 'low', 'unknown']
const DIMENSION_KEYS: readonly SpecialistDimensionKey[] = [
  'hardHitterFit',
  'easyPower',
  'attackSmash',
  'fastDoubles',
  'flatDriveGame',
  'controlPrecision',
  'shuttleGripHold',
  'netTechnical',
  'comfort',
  'directness',
  'softness',
  'tensionRetention',
  'normalWearDurability',
  'mishitTolerance',
  'beginnerFriendliness',
  'value',
  'allRoundSuitability',
]
/** Dimensions are documented (see data/stringSpecialistProfiles.ts) as "scored 1–5". */
const DIMENSION_MIN = 1
const DIMENSION_MAX = 5

export type SpecialistRowValidation = { ok: true; stringId: string; profile: StringSpecialistProfile } | { ok: false; reason: string }

/** Maps + validates a single public.specialist_profiles row. Never throws. Sparse dimension/tag/text fields stay sparse — nothing is defaulted to a misleading value. */
export function mapSpecialistProfileRow(row: SpecialistProfileRow): SpecialistRowValidation {
  const stringId = row.string_id?.trim()
  if (!stringId) return { ok: false, reason: 'empty or missing string_id' }

  if (!VALID_EXPERIENCE_SOURCE.includes(row.experience_source)) {
    return { ok: false, reason: `${stringId}: invalid experience_source "${String(row.experience_source)}"` }
  }
  if (!VALID_CONFIDENCE.includes(row.confidence)) {
    return { ok: false, reason: `${stringId}: invalid confidence "${String(row.confidence)}"` }
  }
  if (row.feel != null && !VALID_FEEL.includes(row.feel)) {
    return { ok: false, reason: `${stringId}: invalid feel "${String(row.feel)}"` }
  }

  const dims = row.dimensions ?? {}
  if (typeof dims !== 'object') return { ok: false, reason: `${stringId}: dimensions must be an object` }
  for (const key of DIMENSION_KEYS) {
    const v = dims[key]
    if (v == null) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < DIMENSION_MIN || v > DIMENSION_MAX) {
      return { ok: false, reason: `${stringId}: dimensions.${key} must be a number between ${DIMENSION_MIN} and ${DIMENSION_MAX}` }
    }
  }

  const dimensionConfidence = row.dimension_confidence ?? undefined
  if (dimensionConfidence != null) {
    if (typeof dimensionConfidence !== 'object') return { ok: false, reason: `${stringId}: dimension_confidence must be an object` }
    for (const [key, value] of Object.entries(dimensionConfidence)) {
      if (value != null && !VALID_CONFIDENCE.includes(value)) {
        return { ok: false, reason: `${stringId}: dimension_confidence.${key} has an invalid confidence value "${String(value)}"` }
      }
    }
  }

  let personalTensionKg: { min: number; max: number } | undefined
  if (row.personal_tension_min_kg != null || row.personal_tension_max_kg != null) {
    const min = row.personal_tension_min_kg
    const max = row.personal_tension_max_kg
    if (min == null || max == null) {
      return { ok: false, reason: `${stringId}: personal_tension_min_kg and personal_tension_max_kg must both be set together` }
    }
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max)) {
      return { ok: false, reason: `${stringId}: personal tension range must be numbers` }
    }
    if (min > max) return { ok: false, reason: `${stringId}: personal_tension_min_kg (${min}) exceeds personal_tension_max_kg (${max})` }
    personalTensionKg = { min, max }
  }

  for (const [field, value] of [
    ['strengths', row.strengths],
    ['weaknesses', row.weaknesses],
    ['specialist_tags', row.specialist_tags],
  ] as const) {
    if (value != null && (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))) {
      return { ok: false, reason: `${stringId}: ${field} must be an array of strings` }
    }
  }

  if (row.subjective_notes != null && typeof row.subjective_notes !== 'string') {
    return { ok: false, reason: `${stringId}: subjective_notes must be a string` }
  }
  if (row.reviewer != null && typeof row.reviewer !== 'string') {
    return { ok: false, reason: `${stringId}: reviewer must be a string` }
  }

  const profile: StringSpecialistProfile = {
    experienceSource: row.experience_source,
    confidence: row.confidence,
    dimensions: dims,
    ...(row.feel != null ? { feel: row.feel } : {}),
    ...(personalTensionKg ? { personalTensionKg } : {}),
    ...(dimensionConfidence ? { dimensionConfidence } : {}),
    ...(row.strengths && row.strengths.length > 0 ? { strengths: row.strengths } : {}),
    ...(row.weaknesses && row.weaknesses.length > 0 ? { weaknesses: row.weaknesses } : {}),
    ...(row.specialist_tags && row.specialist_tags.length > 0 ? { specialistTags: row.specialist_tags } : {}),
    ...(row.subjective_notes ? { subjectiveNotes: row.subjective_notes } : {}),
    ...(row.reviewer ? { reviewer: row.reviewer } : {}),
  }

  return { ok: true, stringId, profile }
}

function fallbackResult(reason: string | undefined, rejectedCount = 0, rejectedReasons: string[] = []): SpecialistFetchResult {
  const status: SpecialistFetchStatus = {
    at: new Date().toISOString(),
    source: 'fallback',
    acceptedCount: 0,
    rejectedCount,
    rejectedReasons,
    fallbackReason: reason,
  }
  lastFetchStatus = status
  return { profiles: getLocalFallbackSpecialistProfiles(), status }
}

/**
 * Fetches specialist profiles from Supabase. Never throws and never
 * surfaces a user-facing error. Unlike the catalog, a live fetch that
 * succeeds is used AS-IS even if its coverage differs from the local
 * file — sparse coverage is expected, not a sign of corruption. Only a
 * fetch that fails outright (unreachable, misconfigured, or a query
 * error) falls back to the complete local file. Individual invalid rows
 * are skipped and logged rather than failing the whole fetch.
 */
export async function fetchSpecialistProfilesFromSupabase(): Promise<SpecialistFetchResult> {
  if (!isSupabaseConfigured) {
    return fallbackResult('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).')
  }

  let rows: SpecialistProfileRow[]
  try {
    const { data, error } = await getSupabaseClient().from('specialist_profiles').select('*')
    if (error) {
      console.warn('[specialistProfileService] Supabase specialist profile fetch failed, using local fallback:', error.message)
      return fallbackResult(error.message)
    }
    rows = data ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[specialistProfileService] Supabase specialist profile fetch threw, using local fallback:', message)
    return fallbackResult(message)
  }

  const profiles: Record<string, StringSpecialistProfile> = {}
  const rejectedReasons: string[] = []

  for (const row of rows) {
    const result = mapSpecialistProfileRow(row)
    if (result.ok) profiles[result.stringId] = result.profile
    else rejectedReasons.push(result.reason)
  }

  if (rejectedReasons.length > 0) {
    console.warn(`[specialistProfileService] ${rejectedReasons.length} specialist profile row(s) rejected:`, rejectedReasons)
  }

  const status: SpecialistFetchStatus = {
    at: new Date().toISOString(),
    source: 'live',
    acceptedCount: Object.keys(profiles).length,
    rejectedCount: rejectedReasons.length,
    rejectedReasons,
  }
  lastFetchStatus = status
  return { profiles, status }
}
