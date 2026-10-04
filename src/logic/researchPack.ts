// Validation and merge planning for the external specialist research pack
// (smash_lab_specialist_research_*.zip → specialist_profiles.json).
//
// The pack's own rules, which this importer enforces:
// - Match on exact string id only; unknown ids are shown, never created.
// - Absent values mean UNKNOWN — never filled with a default.
// - Never silently overwrite hands-on values: by default only empty fields are filled, and the
//   owner explicitly ticks anything else.
// - Keep the community provenance: which fields came from which dataset is stored with the row.
// Pure functions only, so all of this is unit-testable.

import type { Confidence, ExperienceSource, SpecialistDimensionKey, SpecialistFeel } from '../data/stringSpecialistProfiles'

export const SPECIALIST_KEYS: SpecialistDimensionKey[] = [
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

const CONFIDENCES: Confidence[] = ['very-high', 'high', 'medium', 'low', 'unknown']
const SOURCES: ExperienceSource[] = ['personal', 'club', 'stringing-observation', 'manufacturer', 'community', 'mixed']
const FEELS: SpecialistFeel[] = ['hard', 'medium', 'soft']
const ALLOWED_FIELDS = new Set(['experienceSource', 'confidence', 'reviewer', 'dimensions', 'dimensionConfidence', 'strengths', 'weaknesses', 'specialistTags', 'subjectiveNotes', 'feel'])

export interface ResearchProfile {
  experienceSource: ExperienceSource
  confidence: Confidence
  reviewer?: string
  feel?: SpecialistFeel
  dimensions: Partial<Record<SpecialistDimensionKey, number>>
  dimensionConfidence: Partial<Record<SpecialistDimensionKey, Confidence>>
  strengths: string[]
  weaknesses: string[]
  specialistTags: string[]
  subjectiveNotes?: string
}

export interface ResearchPack {
  datasetId: string
  scoreMeaning?: string
  profiles: Record<string, ResearchProfile>
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export function parseResearchPack(raw: unknown): ParseResult<ResearchPack> {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['specialist_profiles.json is not a JSON object.'] }
  const r = raw as Record<string, unknown>
  if (typeof r.schemaVersion !== 'string' || !r.schemaVersion.startsWith('1.')) errors.push(`Unsupported schemaVersion "${String(r.schemaVersion)}" — this importer reads version 1.x.`)
  if (typeof r.datasetId !== 'string' || r.datasetId.trim() === '') errors.push('Missing datasetId.')
  if (!r.profiles || typeof r.profiles !== 'object' || Array.isArray(r.profiles)) errors.push('"profiles" must be an object keyed by string id.')
  if (errors.length) return { ok: false, errors }

  const profiles: Record<string, ResearchProfile> = {}
  for (const [id, value] of Object.entries(r.profiles as Record<string, unknown>)) {
    const p = value as Record<string, unknown>
    const where = (f: string) => `${id}.${f}`
    for (const key of Object.keys(p)) if (!ALLOWED_FIELDS.has(key)) errors.push(`${where(key)}: unknown field.`)
    if (!SOURCES.includes(p.experienceSource as ExperienceSource)) errors.push(`${where('experienceSource')}: invalid value "${String(p.experienceSource)}".`)
    if (!CONFIDENCES.includes(p.confidence as Confidence)) errors.push(`${where('confidence')}: invalid value "${String(p.confidence)}".`)
    if (p.feel != null && !FEELS.includes(p.feel as SpecialistFeel)) errors.push(`${where('feel')}: invalid value "${String(p.feel)}".`)
    for (const f of ['strengths', 'weaknesses', 'specialistTags'] as const) if (p[f] != null && !isStringArray(p[f])) errors.push(`${where(f)}: must be a list of texts.`)
    for (const f of ['reviewer', 'subjectiveNotes'] as const) if (p[f] != null && typeof p[f] !== 'string') errors.push(`${where(f)}: must be text.`)

    const dimensions: ResearchProfile['dimensions'] = {}
    const dims = (p.dimensions ?? {}) as Record<string, unknown>
    if (typeof dims !== 'object' || Array.isArray(dims)) errors.push(`${where('dimensions')}: must be an object.`)
    for (const [key, v] of Object.entries(dims)) {
      if (!SPECIALIST_KEYS.includes(key as SpecialistDimensionKey)) errors.push(`${where('dimensions')}.${key}: unknown dimension.`)
      // Numbers only — numeric strings, NaN and out-of-range values are rejected, never coerced.
      else if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 5) errors.push(`${where('dimensions')}.${key}: must be a number from 1 to 5 (got ${JSON.stringify(v)}).`)
      else dimensions[key as SpecialistDimensionKey] = v
    }
    const dimensionConfidence: ResearchProfile['dimensionConfidence'] = {}
    for (const [key, v] of Object.entries((p.dimensionConfidence ?? {}) as Record<string, unknown>)) {
      if (!SPECIALIST_KEYS.includes(key as SpecialistDimensionKey)) errors.push(`${where('dimensionConfidence')}.${key}: unknown dimension.`)
      else if (!CONFIDENCES.includes(v as Confidence)) errors.push(`${where('dimensionConfidence')}.${key}: invalid confidence "${String(v)}".`)
      else dimensionConfidence[key as SpecialistDimensionKey] = v as Confidence
    }

    profiles[id] = {
      experienceSource: p.experienceSource as ExperienceSource,
      confidence: p.confidence as Confidence,
      reviewer: typeof p.reviewer === 'string' ? p.reviewer : undefined,
      feel: FEELS.includes(p.feel as SpecialistFeel) ? (p.feel as SpecialistFeel) : undefined,
      dimensions,
      dimensionConfidence,
      strengths: isStringArray(p.strengths) ? p.strengths : [],
      weaknesses: isStringArray(p.weaknesses) ? p.weaknesses : [],
      specialistTags: isStringArray(p.specialistTags) ? p.specialistTags : [],
      subjectiveNotes: typeof p.subjectiveNotes === 'string' ? p.subjectiveNotes : undefined,
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { datasetId: String(r.datasetId), scoreMeaning: typeof r.scoreMeaning === 'string' ? r.scoreMeaning : undefined, profiles } }
}

/** The current database state of one profile — only what the merge needs. */
/** The owner's own values that a "replace" import overwrote — kept so they can be restored. */
export interface ReplacedValues {
  dimensions?: Partial<Record<SpecialistDimensionKey, number>>
  feel?: SpecialistFeel | null
}

/** fillGaps (default): only empty values are filled. replace: research values win everywhere (the owner's are backed up). */
export type MergeMode = 'fillGaps' | 'replace'

export interface ExistingProfile {
  experienceSource: ExperienceSource
  confidence: Confidence
  feel: SpecialistFeel | null
  dimensions: Partial<Record<SpecialistDimensionKey, number>>
  dimensionConfidence: Partial<Record<SpecialistDimensionKey, Confidence>>
  strengths: string[]
  weaknesses: string[]
  specialistTags: string[]
  researchImport: { datasetId: string; fields: string[]; replaced?: ReplacedValues } | null
}

export interface DimensionChoice {
  key: SpecialistDimensionKey
  current?: number
  proposed: number
  proposedConfidence?: Confidence
  /** Default: take only when the current value is empty. */
  take: boolean
}

export interface ProfilePlan {
  stringId: string
  known: boolean
  /** No profile in the database yet — the whole research profile is created (as "community"). */
  isNew: boolean
  dimensions: DimensionChoice[]
  feel: { current: SpecialistFeel | null; proposed?: SpecialistFeel; take: boolean }
  /** Add the research strengths/weaknesses/tags to the existing lists (never replace). */
  addTexts: boolean
}

export function planResearchMerge(pack: ResearchPack, catalogIds: Set<string>, existing: Record<string, ExistingProfile>, mode: MergeMode = 'fillGaps'): ProfilePlan[] {
  return Object.entries(pack.profiles)
    .map(([stringId, proposed]) => {
      const current = existing[stringId]
      const isNew = current == null
      const dimensions: DimensionChoice[] = SPECIALIST_KEYS.filter((k) => proposed.dimensions[k] != null).map((key) => {
        const cur = current?.dimensions[key]
        return { key, current: cur, proposed: proposed.dimensions[key]!, proposedConfidence: proposed.dimensionConfidence[key], take: mode === 'replace' || cur == null }
      })
      return {
        stringId,
        known: catalogIds.has(stringId),
        isNew,
        dimensions,
        feel: { current: current?.feel ?? null, proposed: proposed.feel, take: proposed.feel != null && (mode === 'replace' || (current?.feel ?? null) == null) },
        addTexts: isNew,
      }
    })
    .sort((a, b) => a.stringId.localeCompare(b.stringId))
}

/** Fields an import of this plan would actually write (empty → nothing to do for this string). */
export function takenFields(plan: ProfilePlan): string[] {
  const fields = plan.dimensions.filter((d) => d.take).map((d) => `dimensions.${d.key}`)
  if (plan.feel.take && plan.feel.proposed) fields.push('feel')
  if (plan.addTexts) fields.push('texts')
  return fields
}

const mergeList = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))]

/**
 * The row to write for one string. Existing profiles keep their own experience source,
 * confidence, reviewer, notes and map placement; only ticked values change. Re-importing the same
 * dataset with the same choices produces the same row (idempotent).
 */
export function buildProfileRow(plan: ProfilePlan, pack: ResearchPack, existing: ExistingProfile | undefined, importedAt: string): Record<string, unknown> | null {
  const fields = takenFields(plan)
  if (fields.length === 0 || !plan.known) return null
  const proposed = pack.profiles[plan.stringId]

  const dimensions = { ...(existing?.dimensions ?? {}) }
  const dimensionConfidence = { ...(existing?.dimensionConfidence ?? {}) }
  for (const d of plan.dimensions.filter((x) => x.take)) {
    dimensions[d.key] = d.proposed
    if (d.proposedConfidence) dimensionConfidence[d.key] = d.proposedConfidence
    else delete dimensionConfidence[d.key]
  }

  const previous = existing?.researchImport?.datasetId === pack.datasetId ? existing.researchImport.fields : []
  // Back up every value of the owner's that this import overwrites. The EARLIEST backup wins, so
  // repeated imports never lose the original hands-on value.
  const before = existing?.researchImport?.replaced ?? {}
  const replacedDims: Partial<Record<SpecialistDimensionKey, number>> = { ...(before.dimensions ?? {}) }
  for (const d of plan.dimensions) {
    if (d.take && d.current != null && d.current !== d.proposed && !(d.key in replacedDims)) replacedDims[d.key] = d.current
  }
  const replaced: ReplacedValues = { ...(Object.keys(replacedDims).length ? { dimensions: replacedDims } : {}) }
  if ('feel' in before) replaced.feel = before.feel
  else if (plan.feel.take && plan.feel.proposed && existing?.feel != null && existing.feel !== plan.feel.proposed) replaced.feel = existing.feel
  const researchImport = { datasetId: pack.datasetId, importedAt, fields: mergeList(previous, fields), ...(Object.keys(replaced).length ? { replaced } : {}) }

  if (!existing) {
    return {
      string_id: plan.stringId,
      experience_source: proposed.experienceSource,
      confidence: proposed.confidence,
      reviewer: proposed.reviewer ?? null,
      feel: plan.feel.take ? (proposed.feel ?? null) : null,
      dimensions,
      dimension_confidence: Object.keys(dimensionConfidence).length ? dimensionConfidence : null,
      strengths: plan.addTexts ? proposed.strengths : [],
      weaknesses: plan.addTexts ? proposed.weaknesses : [],
      specialist_tags: plan.addTexts ? proposed.specialistTags : [],
      subjective_notes: proposed.subjectiveNotes ?? null,
      research_import: researchImport,
    }
  }
  return {
    string_id: plan.stringId,
    dimensions,
    dimension_confidence: Object.keys(dimensionConfidence).length ? dimensionConfidence : null,
    ...(plan.feel.take && proposed.feel ? { feel: proposed.feel } : {}),
    ...(plan.addTexts
      ? {
          strengths: mergeList(existing.strengths, proposed.strengths),
          weaknesses: mergeList(existing.weaknesses, proposed.weaknesses),
          specialist_tags: mergeList(existing.specialistTags, proposed.specialistTags),
        }
      : {}),
    research_import: researchImport,
  }
}

/**
 * Undo "replace": put the owner's backed-up values back, drop the research confidence for those
 * dimensions, and forget the backup. Returns null when there's nothing to restore.
 */
export function buildRestoreRow(stringId: string, existing: ExistingProfile): Record<string, unknown> | null {
  const replaced = existing.researchImport?.replaced
  if (!replaced || (!replaced.dimensions && !('feel' in replaced))) return null
  const dimensions = { ...existing.dimensions, ...(replaced.dimensions ?? {}) }
  const dimensionConfidence = { ...existing.dimensionConfidence }
  for (const k of Object.keys(replaced.dimensions ?? {})) delete dimensionConfidence[k as SpecialistDimensionKey]
  const restoredFields = [...Object.keys(replaced.dimensions ?? {}).map((k) => `dimensions.${k}`), ...('feel' in replaced ? ['feel'] : [])]
  const fields = (existing.researchImport?.fields ?? []).filter((f) => !restoredFields.includes(f))
  return {
    string_id: stringId,
    dimensions,
    dimension_confidence: Object.keys(dimensionConfidence).length ? dimensionConfidence : null,
    ...('feel' in replaced ? { feel: replaced.feel ?? null } : {}),
    research_import: existing.researchImport ? { datasetId: existing.researchImport.datasetId, importedAt: new Date().toISOString(), fields } : null,
  }
}
