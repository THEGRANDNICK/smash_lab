// Admin-only specialist-profile CRUD (Phase 6). This is the ONLY place the
// specialist admin UI touches Supabase — components never call
// getSupabaseClient() directly. Every call runs through the caller's normal
// authenticated Supabase session (same shared client as
// adminInventoryService.ts / catalogAdminService.ts); there is no
// service-role key anywhere in this file. RLS is the only thing that
// decides whether a write actually succeeds.
//
// Validation reuses specialistProfileService.ts's row-shape rules
// (VALID_CONFIDENCE etc. are re-derived from the same source types) so an
// admin can never save something the public read-path would then reject.
//
// The list is built from every catalog string LEFT-JOINed (client-side, via
// two plain queries merged in memory — simpler and just as type-safe as a
// PostgREST embedded join here) with its specialist profile, if any —
// most strings legitimately have none, which is normal, not an error.

import { getSupabaseClient } from '../lib/supabase.js'
import type { Database } from '../types/database.js'
import type { SpecialistFeel, ExperienceSource, Confidence, SpecialistDimensionKey } from '../data/stringSpecialistProfiles.js'

type SpecialistRow = Database['public']['Tables']['specialist_profiles']['Row']
/** Upsert payload shape (string_id supplied separately by the caller) — deliberately based on Insert, not Update, since experience_source/confidence are NOT NULL columns with no default and every upsert here is expected to supply them (validateSpecialistInput always sets both). */
export type SpecialistUpsertFields = Omit<Database['public']['Tables']['specialist_profiles']['Insert'], 'string_id'>

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const FEEL_OPTIONS: SpecialistFeel[] = ['hard', 'medium', 'soft']
export const EXPERIENCE_SOURCE_OPTIONS: ExperienceSource[] = ['personal', 'club', 'stringing-observation', 'manufacturer', 'community', 'mixed']
export const CONFIDENCE_OPTIONS: Confidence[] = ['very-high', 'high', 'medium', 'low', 'unknown']

/** All 17 specialist dimensions, in the order shown in the editor's "Dimensions" section. Scored 1–5 per data/stringSpecialistProfiles.ts's own documentation — sparse by design, leave blank rather than guess. */
export const DIMENSION_OPTIONS: { key: SpecialistDimensionKey; label: string }[] = [
  { key: 'hardHitterFit', label: 'Hard hitter fit' },
  { key: 'easyPower', label: 'Easy power' },
  { key: 'attackSmash', label: 'Attack / smash' },
  { key: 'fastDoubles', label: 'Fast doubles' },
  { key: 'flatDriveGame', label: 'Flat drive game' },
  { key: 'controlPrecision', label: 'Control precision' },
  { key: 'shuttleGripHold', label: 'Shuttle grip / hold' },
  { key: 'netTechnical', label: 'Net / technical' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'directness', label: 'Directness' },
  { key: 'softness', label: 'Softness' },
  { key: 'tensionRetention', label: 'Tension retention' },
  { key: 'normalWearDurability', label: 'Normal wear durability' },
  { key: 'mishitTolerance', label: 'Mishit tolerance' },
  { key: 'beginnerFriendliness', label: 'Beginner friendliness' },
  { key: 'value', label: 'Value' },
  { key: 'allRoundSuitability', label: 'All-round suitability' },
]
const DIMENSION_MIN = 1
const DIMENSION_MAX = 5

/** One row in the specialist admin list — catalog identity plus whatever profile exists (null if none). */
export interface AdminSpecialistRow {
  stringId: string
  brand: string
  name: string
  hasProfile: boolean
  feel: SpecialistFeel | null
  experienceSource: ExperienceSource | null
  confidence: Confidence | null
  reviewer: string | null
  subjectiveNotes: string | null
  strengths: string[] | null
  weaknesses: string[] | null
  specialistTags: string[] | null
  personalTensionMinKg: number | null
  personalTensionMaxKg: number | null
  dimensions: Partial<Record<SpecialistDimensionKey, number>>
  updatedAt: string | null
}

function mergeRow(catalogRow: { id: string; brand: string; name: string }, profile: SpecialistRow | undefined): AdminSpecialistRow {
  return {
    stringId: catalogRow.id,
    brand: catalogRow.brand,
    name: catalogRow.name,
    hasProfile: profile != null,
    feel: profile?.feel ?? null,
    experienceSource: profile?.experience_source ?? null,
    confidence: profile?.confidence ?? null,
    reviewer: profile?.reviewer ?? null,
    subjectiveNotes: profile?.subjective_notes ?? null,
    strengths: profile?.strengths ?? null,
    weaknesses: profile?.weaknesses ?? null,
    specialistTags: profile?.specialist_tags ?? null,
    personalTensionMinKg: profile?.personal_tension_min_kg ?? null,
    personalTensionMaxKg: profile?.personal_tension_max_kg ?? null,
    dimensions: profile?.dimensions ?? {},
    updatedAt: profile?.updated_at ?? null,
  }
}

/** Fetches every catalog string alongside its specialist profile (if any), sorted by brand then name. */
export async function fetchAdminSpecialistList(): Promise<AdminResult<AdminSpecialistRow[]>> {
  try {
    const client = getSupabaseClient()
    const [catalogResult, profilesResult] = await Promise.all([client.from('strings').select('id, brand, name'), client.from('specialist_profiles').select('*')])

    if (catalogResult.error) return { ok: false, error: catalogResult.error.message }
    if (profilesResult.error) return { ok: false, error: profilesResult.error.message }

    const profilesById = new Map((profilesResult.data ?? []).map((p) => [p.string_id, p]))
    const rows = (catalogResult.data ?? []).map((c) => mergeRow(c, profilesById.get(c.id)))
    rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
    return { ok: true, data: rows }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Form input + validation
// ---------------------------------------------------------------------------

export interface SpecialistFormInput {
  feel: string
  experienceSource: string
  confidence: string
  reviewer: string
  subjectiveNotes: string
  strengths: string
  weaknesses: string
  specialistTags: string
  personalTensionMinKg: string
  personalTensionMaxKg: string
  /** One raw text value per dimension key — blank means "not scored", matching the sparse-by-design dimensions model. */
  dimensions: Partial<Record<SpecialistDimensionKey, string>>
}

export function emptySpecialistFormInput(): SpecialistFormInput {
  return {
    feel: '',
    experienceSource: '',
    confidence: '',
    reviewer: '',
    subjectiveNotes: '',
    strengths: '',
    weaknesses: '',
    specialistTags: '',
    personalTensionMinKg: '',
    personalTensionMaxKg: '',
    dimensions: {},
  }
}

export function specialistFormInputFromRow(row: AdminSpecialistRow): SpecialistFormInput {
  const dimensions: Partial<Record<SpecialistDimensionKey, string>> = {}
  for (const { key } of DIMENSION_OPTIONS) {
    const v = row.dimensions[key]
    if (v != null) dimensions[key] = String(v)
  }
  return {
    feel: row.feel ?? '',
    experienceSource: row.experienceSource ?? '',
    confidence: row.confidence ?? '',
    reviewer: row.reviewer ?? '',
    subjectiveNotes: row.subjectiveNotes ?? '',
    strengths: row.strengths && row.strengths.length > 0 ? row.strengths.join('\n') : '',
    weaknesses: row.weaknesses && row.weaknesses.length > 0 ? row.weaknesses.join('\n') : '',
    specialistTags: row.specialistTags && row.specialistTags.length > 0 ? row.specialistTags.join(', ') : '',
    personalTensionMinKg: row.personalTensionMinKg != null ? String(row.personalTensionMinKg) : '',
    personalTensionMaxKg: row.personalTensionMaxKg != null ? String(row.personalTensionMaxKg) : '',
    dimensions,
  }
}

export type SpecialistFormErrors = Partial<Record<Exclude<keyof SpecialistFormInput, 'dimensions'>, string>> & {
  dimensions?: Partial<Record<SpecialistDimensionKey, string>>
}

export type SpecialistValidationResult = { ok: true; update: SpecialistUpsertFields } | { ok: false; errors: SpecialistFormErrors }

function parseLines(raw: string): string[] | null {
  const items = raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return items.length > 0 ? items : null
}

function parseTags(raw: string): string[] | null {
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return items.length > 0 ? items : null
}

/** Validates a specialist profile form input into a typed upsert payload. Required: experienceSource, confidence (the only two non-optional fields on the type). Trims every text field; blank optional fields become null/undefined, never empty strings or arrays. */
export function validateSpecialistInput(input: SpecialistFormInput): SpecialistValidationResult {
  const errors: SpecialistFormErrors = {}

  if (!EXPERIENCE_SOURCE_OPTIONS.includes(input.experienceSource as ExperienceSource)) {
    errors.experienceSource = 'Choose a source.'
  }
  if (!CONFIDENCE_OPTIONS.includes(input.confidence as Confidence)) {
    errors.confidence = 'Choose a confidence level.'
  }
  if (input.feel !== '' && !FEEL_OPTIONS.includes(input.feel as SpecialistFeel)) {
    errors.feel = 'Choose a valid feel, or leave blank.'
  }

  let minKg: number | null = null
  let maxKg: number | null = null
  const minTrimmed = input.personalTensionMinKg.trim()
  const maxTrimmed = input.personalTensionMaxKg.trim()
  if (minTrimmed !== '' || maxTrimmed !== '') {
    if (minTrimmed === '' || maxTrimmed === '') {
      errors.personalTensionMinKg = 'Set both a min and max, or leave both blank.'
      errors.personalTensionMaxKg = 'Set both a min and max, or leave both blank.'
    } else {
      const min = Number(minTrimmed)
      const max = Number(maxTrimmed)
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        errors.personalTensionMinKg = 'Tension range must be numbers.'
      } else if (min > max) {
        errors.personalTensionMaxKg = 'Max must be greater than or equal to the min.'
      } else {
        minKg = min
        maxKg = max
      }
    }
  }

  const dimensionErrors: Partial<Record<SpecialistDimensionKey, string>> = {}
  const dimensions: Partial<Record<SpecialistDimensionKey, number>> = {}
  for (const { key, label } of DIMENSION_OPTIONS) {
    const raw = (input.dimensions[key] ?? '').trim()
    if (raw === '') continue
    const num = Number(raw)
    if (!Number.isFinite(num)) {
      dimensionErrors[key] = `${label} must be a number.`
    } else if (num < DIMENSION_MIN || num > DIMENSION_MAX) {
      dimensionErrors[key] = `${label} must be between ${DIMENSION_MIN} and ${DIMENSION_MAX}.`
    } else {
      dimensions[key] = num
    }
  }
  if (Object.keys(dimensionErrors).length > 0) errors.dimensions = dimensionErrors

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const update: SpecialistUpsertFields = {
    experience_source: input.experienceSource as ExperienceSource,
    confidence: input.confidence as Confidence,
    feel: input.feel === '' ? null : (input.feel as SpecialistFeel),
    reviewer: input.reviewer.trim() === '' ? null : input.reviewer.trim(),
    subjective_notes: input.subjectiveNotes.trim() === '' ? null : input.subjectiveNotes.trim(),
    strengths: parseLines(input.strengths),
    weaknesses: parseLines(input.weaknesses),
    specialist_tags: parseTags(input.specialistTags),
    personal_tension_min_kg: minKg,
    personal_tension_max_kg: maxKg,
    dimensions,
  }

  return { ok: true, update }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates or updates a string's specialist profile in one call (string_id is the table's primary key, so this is a genuine upsert). Per-dimension confidence overrides (dimension_confidence) are not yet exposed in this editor — only the profile-level `confidence` is — and are left untouched here. */
export async function upsertSpecialistProfile(stringId: string, update: SpecialistUpsertFields): Promise<AdminResult<void>> {
  try {
    const { error } = await getSupabaseClient()
      .from('specialist_profiles')
      .upsert({ string_id: stringId, ...update }, { onConflict: 'string_id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Removes a string's specialist profile entirely (reverting it to manufacturer-data-only scoring on the public site). Does not touch the catalog or inventory rows. */
export async function deleteSpecialistProfile(stringId: string): Promise<AdminResult<void>> {
  try {
    const { error } = await getSupabaseClient().from('specialist_profiles').delete().eq('string_id', stringId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
