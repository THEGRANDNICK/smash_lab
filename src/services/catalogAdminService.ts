// Admin-only catalog CRUD (Phase 5). This is the ONLY place admin catalog
// UI components query or mutate public.strings — they never call
// getSupabaseClient() directly. Every call runs through the caller's normal
// authenticated Supabase session (same shared client as adminInventoryService.ts);
// there is no service-role key anywhere in this file. RLS is the only thing
// that decides whether a write actually succeeds — a non-admin caller gets a
// rejected write surfaced as a normal error result here, never a crash.
//
// Validation reuses the exact same rules services/catalogService.ts applies
// to live-fetched rows (VALID_CATEGORIES, RATING_MIN/MAX, SAFE_URL_PATTERN)
// so an admin can never save something the public read-path would then
// reject as invalid.

import { getSupabaseClient } from '../lib/supabase.js'
import type { Database } from '../types/database.js'
import type { StringCategory } from '../data/strings.js'
import { VALID_CATEGORIES, RATING_MIN, RATING_MAX, SAFE_URL_PATTERN, isFiniteNumber, inRange, hasDecimalPrecision } from './catalogService.js'
import { splitColorList } from '../logic/colorParsing.js'
import { normalizeDecimalInput } from '../logic/decimalInput.js'

type StringsRow = Database['public']['Tables']['strings']['Row']
type StringsInsert = Database['public']['Tables']['strings']['Insert']
type StringsUpdate = Database['public']['Tables']['strings']['Update']

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const CATEGORY_OPTIONS: StringCategory[] = [...VALID_CATEGORIES]

/** One row in the catalog admin list — the raw database row, camelCased. Deliberately NOT run through catalogService's strict mapCatalogRow(): an admin needs to see (and fix) an invalid row, not have it silently hidden the way the public read-path hides it. */
export interface AdminCatalogRow {
  id: string
  brand: string
  name: string
  category: string
  gaugeMm: number | null
  repulsion: number
  durability: number
  hittingSound: number
  shockAbsorption: number | null
  control: number
  stringCostEur: number | null
  description: string | null
  tensionMeta: { tensionAdjustment?: number; recommendedMin?: number; recommendedMax?: number; tensionNotes?: string } | null
  popularityRank: number | null
  productUrl: string | null
  imageUrl: string | null
  colors: string[] | null
  isHybrid: boolean
  mainStringMeta: HybridMeta | null
  crossStringMeta: HybridMeta | null
  updatedAt: string
}

interface HybridMeta {
  gauge?: number
  material?: string
  construction?: string
  coating?: string
  color?: string
}

function fromRow(row: StringsRow): AdminCatalogRow {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    gaugeMm: row.gauge_mm,
    repulsion: row.repulsion,
    durability: row.durability,
    hittingSound: row.hitting_sound,
    shockAbsorption: row.shock_absorption,
    control: row.control,
    stringCostEur: row.string_cost_eur,
    description: row.description,
    tensionMeta: row.tension_meta,
    popularityRank: row.popularity_rank,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    colors: row.colors,
    isHybrid: row.is_hybrid,
    mainStringMeta: row.main_string_meta,
    crossStringMeta: row.cross_string_meta,
    updatedAt: row.updated_at,
  }
}

/** Fetches every catalog row for the admin list, sorted by brand then name (matches the inventory admin page's convention). */
export async function fetchAdminCatalog(): Promise<AdminResult<AdminCatalogRow[]>> {
  try {
    const { data, error } = await getSupabaseClient().from('strings').select('*')
    if (error) return { ok: false, error: error.message }
    const rows = (data ?? []).map(fromRow)
    rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
    return { ok: true, data: rows }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Form input + validation. Every field arrives as a raw string (HTML inputs
// are always strings) and is parsed/validated here into a typed payload —
// no `as` casts, no silently-accepted corrupt values.
// ---------------------------------------------------------------------------

export interface CatalogFormInput {
  id: string
  brand: string
  name: string
  category: string
  gauge: string
  repulsion: string
  durability: string
  hittingSound: string
  shockAbsorption: string
  control: string
  stringCost: string
  description: string
  popularityRank: string
  imageUrl: string
  productUrl: string
  colors: string
  tensionAdjustment: string
  recommendedMin: string
  recommendedMax: string
  tensionNotes: string
  isHybrid: boolean
  mainGauge: string
  mainMaterial: string
  mainConstruction: string
  mainCoating: string
  mainColor: string
  crossGauge: string
  crossMaterial: string
  crossConstruction: string
  crossCoating: string
  crossColor: string
}

export function emptyCatalogFormInput(): CatalogFormInput {
  return {
    id: '',
    brand: '',
    name: '',
    category: '',
    gauge: '',
    repulsion: '',
    durability: '',
    hittingSound: '',
    shockAbsorption: '',
    control: '',
    stringCost: '',
    description: '',
    popularityRank: '',
    imageUrl: '',
    productUrl: '',
    colors: '',
    tensionAdjustment: '',
    recommendedMin: '',
    recommendedMax: '',
    tensionNotes: '',
    isHybrid: false,
    mainGauge: '',
    mainMaterial: '',
    mainConstruction: '',
    mainCoating: '',
    mainColor: '',
    crossGauge: '',
    crossMaterial: '',
    crossConstruction: '',
    crossCoating: '',
    crossColor: '',
  }
}

export function catalogFormInputFromRow(row: AdminCatalogRow): CatalogFormInput {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    gauge: row.gaugeMm == null ? '' : String(row.gaugeMm),
    repulsion: String(row.repulsion),
    durability: String(row.durability),
    hittingSound: String(row.hittingSound),
    shockAbsorption: row.shockAbsorption == null ? '' : String(row.shockAbsorption),
    control: String(row.control),
    stringCost: row.stringCostEur == null ? '' : String(row.stringCostEur),
    description: row.description ?? '',
    popularityRank: row.popularityRank == null ? '' : String(row.popularityRank),
    imageUrl: row.imageUrl ?? '',
    productUrl: row.productUrl ?? '',
    colors: row.colors && row.colors.length > 0 ? row.colors.join(', ') : '',
    tensionAdjustment: row.tensionMeta?.tensionAdjustment != null ? String(row.tensionMeta.tensionAdjustment) : '',
    recommendedMin: row.tensionMeta?.recommendedMin != null ? String(row.tensionMeta.recommendedMin) : '',
    recommendedMax: row.tensionMeta?.recommendedMax != null ? String(row.tensionMeta.recommendedMax) : '',
    tensionNotes: row.tensionMeta?.tensionNotes ?? '',
    isHybrid: row.isHybrid,
    mainGauge: row.mainStringMeta?.gauge != null ? String(row.mainStringMeta.gauge) : '',
    mainMaterial: row.mainStringMeta?.material ?? '',
    mainConstruction: row.mainStringMeta?.construction ?? '',
    mainCoating: row.mainStringMeta?.coating ?? '',
    mainColor: row.mainStringMeta?.color ?? '',
    crossGauge: row.crossStringMeta?.gauge != null ? String(row.crossStringMeta.gauge) : '',
    crossMaterial: row.crossStringMeta?.material ?? '',
    crossConstruction: row.crossStringMeta?.construction ?? '',
    crossCoating: row.crossStringMeta?.coating ?? '',
    crossColor: row.crossStringMeta?.color ?? '',
  }
}

export type CatalogFormErrors = Partial<Record<keyof CatalogFormInput, string>>

export interface ValidationContext {
  /** True when creating a new string — id is required and checked for uniqueness; false when editing, where id is fixed and excluded from the uniqueness check. */
  isNew: boolean
  /** Every id currently in the catalog (excluding the row being edited, if any). */
  existingIds: ReadonlySet<string>
  /** Every "brand|name" pair (lowercased, trimmed) currently in the catalog, excluding the row being edited. Used only for a non-blocking duplicate warning — the schema deliberately allows legitimate (brand, name) repeats (e.g. a regional/gauge variant), so this never blocks submission. */
  existingBrandNamePairs: ReadonlySet<string>
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** brand + name -> a suggested slug id, e.g. "Yonex" + "BG 80 Power" -> "yonex-bg-80-power". Purely a starting point — the admin can still edit it before saving. */
export function suggestCatalogId(brand: string, name: string): string {
  const slug = `${brand} ${name}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug
}

/** Ratings allow decimals (e.g. 9.5, matching real manufacturer-published values) but at most one decimal place — 9.55 is rejected rather than silently rounded, matching the database's own CHECK constraint. A "," decimal separator (common on mobile keyboards) is normalized to "." before parsing — see logic/decimalInput.ts. */
function parseRequiredRating(raw: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, error: `${label} is required.` }
  const num = Number(normalizeDecimalInput(trimmed))
  if (!isFiniteNumber(num)) return { ok: false, error: `${label} must be a number.` }
  if (!inRange(num, RATING_MIN, RATING_MAX)) return { ok: false, error: `${label} must be between ${RATING_MIN} and ${RATING_MAX}.` }
  if (!hasDecimalPrecision(num, 1)) return { ok: false, error: `${label} allows at most one decimal place (e.g. 9.5).` }
  return { ok: true, value: num }
}

function parseNullableRating(raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(normalizeDecimalInput(trimmed))
  if (!isFiniteNumber(num)) return { ok: false, error: `${label} must be a number.` }
  if (!inRange(num, RATING_MIN, RATING_MAX)) return { ok: false, error: `${label} must be between ${RATING_MIN} and ${RATING_MAX}.` }
  if (!hasDecimalPrecision(num, 1)) return { ok: false, error: `${label} allows at most one decimal place (e.g. 9.5).` }
  return { ok: true, value: num }
}

function parseNullableNonNegative(raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(normalizeDecimalInput(trimmed))
  if (!isFiniteNumber(num)) return { ok: false, error: `${label} must be a number.` }
  if (num < 0) return { ok: false, error: `${label} cannot be negative.` }
  return { ok: true, value: num }
}

function parseNullablePositiveInt(raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(normalizeDecimalInput(trimmed))
  if (!isFiniteNumber(num) || !Number.isInteger(num)) return { ok: false, error: `${label} must be a whole number.` }
  if (num < 1) return { ok: false, error: `${label} must be 1 or greater.` }
  return { ok: true, value: num }
}

export function parseNullableUrl(raw: string, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!SAFE_URL_PATTERN.test(trimmed)) return { ok: false, error: `${label} must be a valid http(s) URL.` }
  return { ok: true, value: trimmed }
}

/** Extracts `.value` from a parse result already known to be `ok: true` (the caller has already returned early if any parse result had errors) — avoids repeating a runtime-safe-but-TS-unprovable narrowing at every call site. */
export function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error('unreachable: value() called after a failed parse result')
  return result.value
}

/** Builds a sparse hybrid-side metadata object, or null if nothing was entered — never an object with only empty/undefined values. */
function buildHybridMeta(gauge: number | null, material: string, construction: string, coating: string, color: string): HybridMeta | null {
  const meta: HybridMeta = {
    ...(gauge != null ? { gauge } : {}),
    ...(material.trim() !== '' ? { material: material.trim() } : {}),
    ...(construction.trim() !== '' ? { construction: construction.trim() } : {}),
    ...(coating.trim() !== '' ? { coating: coating.trim() } : {}),
    ...(color.trim() !== '' ? { color: color.trim() } : {}),
  }
  return Object.keys(meta).length > 0 ? meta : null
}

/** Splits on commas AND semicolons (Phase 9 fix — real data used both), trims, drops blanks, and deduplicates case-insensitively so "Yellow, yellow" is saved as just "Yellow" — the first-seen casing wins. Never splits on a bare "/", so a value like "Black/Yellow" is preserved as one (likely-unmapped) entry rather than silently guessed apart. */
function parseColors(raw: string): string[] | null {
  const seen = new Set<string>()
  const items: string[] = []
  for (const candidate of splitColorList(raw)) {
    const key = candidate.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(candidate)
  }
  return items.length > 0 ? items : null
}

export interface ValidatedCatalogPayload {
  insert?: StringsInsert
  update: StringsUpdate
}

export type CatalogValidationResult = { ok: true; payload: ValidatedCatalogPayload; warnings: string[] } | { ok: false; errors: CatalogFormErrors }

/** Validates a form input into a typed insert/update payload. Never silently coerces a bad value — every failure is reported against the specific field, and nothing partially-valid is returned. */
export function validateCatalogInput(input: CatalogFormInput, context: ValidationContext): CatalogValidationResult {
  const errors: CatalogFormErrors = {}
  const warnings: string[] = []

  const id = input.id.trim()
  if (context.isNew) {
    if (id === '') errors.id = 'ID is required.'
    else if (!ID_PATTERN.test(id)) errors.id = 'ID must be lowercase letters, numbers, and hyphens only (e.g. "yonex-bg80").'
    else if (context.existingIds.has(id)) errors.id = `"${id}" is already in use by another string.`
  }

  const brand = input.brand.trim()
  if (brand === '') errors.brand = 'Brand is required.'

  const name = input.name.trim()
  if (name === '') errors.name = 'Name is required.'

  if (!VALID_CATEGORIES.includes(input.category as StringCategory)) {
    errors.category = 'Choose a category.'
  }

  if (brand !== '' && name !== '') {
    const pairKey = `${brand.toLowerCase()}|${name.toLowerCase()}`
    if (context.existingBrandNamePairs.has(pairKey)) {
      warnings.push(`Another string already uses "${brand} ${name}" — this is allowed (e.g. a different gauge or regional variant), but double-check it's intentional.`)
    }
  }

  const gaugeResult = parseNullableNonNegative(input.gauge, 'Gauge')
  if (!gaugeResult.ok) errors.gauge = gaugeResult.error

  const repulsionResult = parseRequiredRating(input.repulsion, 'Repulsion')
  if (!repulsionResult.ok) errors.repulsion = repulsionResult.error

  const durabilityResult = parseRequiredRating(input.durability, 'Durability')
  if (!durabilityResult.ok) errors.durability = durabilityResult.error

  const hittingSoundResult = parseRequiredRating(input.hittingSound, 'Hitting sound')
  if (!hittingSoundResult.ok) errors.hittingSound = hittingSoundResult.error

  const shockAbsorptionResult = parseNullableRating(input.shockAbsorption, 'Shock absorption')
  if (!shockAbsorptionResult.ok) errors.shockAbsorption = shockAbsorptionResult.error

  const controlResult = parseRequiredRating(input.control, 'Control')
  if (!controlResult.ok) errors.control = controlResult.error

  const stringCostResult = parseNullableNonNegative(input.stringCost, 'String cost')
  if (!stringCostResult.ok) errors.stringCost = stringCostResult.error

  const popularityRankResult = parseNullablePositiveInt(input.popularityRank, 'Popularity rank')
  if (!popularityRankResult.ok) errors.popularityRank = popularityRankResult.error

  const imageUrlResult = parseNullableUrl(input.imageUrl, 'Image URL')
  if (!imageUrlResult.ok) errors.imageUrl = imageUrlResult.error

  const productUrlResult = parseNullableUrl(input.productUrl, 'Product URL')
  if (!productUrlResult.ok) errors.productUrl = productUrlResult.error

  // Tension adjustment is a +/- nudge (unlike the other non-negative fields), so it's validated inline rather than via parseNullableNonNegative.
  let tensionAdjustment: number | null = null
  {
    const trimmed = input.tensionAdjustment.trim()
    if (trimmed !== '') {
      const num = Number(normalizeDecimalInput(trimmed))
      if (!isFiniteNumber(num)) errors.tensionAdjustment = 'Tension adjustment must be a number.'
      else tensionAdjustment = num
    }
  }

  const recommendedMinResult = parseNullableNonNegative(input.recommendedMin, 'Recommended min tension')
  if (!recommendedMinResult.ok) errors.recommendedMin = recommendedMinResult.error

  const recommendedMaxResult = parseNullableNonNegative(input.recommendedMax, 'Recommended max tension')
  if (!recommendedMaxResult.ok) errors.recommendedMax = recommendedMaxResult.error

  if (recommendedMinResult.ok && recommendedMaxResult.ok && recommendedMinResult.value != null && recommendedMaxResult.value != null) {
    if (recommendedMinResult.value > recommendedMaxResult.value) {
      errors.recommendedMax = 'Recommended max must be greater than or equal to the min.'
    }
  }

  // Hybrid metadata is display/admin detail only (never a recommendation input) — validated the same way regardless of whether isHybrid is checked, so toggling it off and back on never silently drops a typo'd value.
  const mainGaugeResult = parseNullableNonNegative(input.mainGauge, 'Main string gauge')
  if (!mainGaugeResult.ok) errors.mainGauge = mainGaugeResult.error
  const crossGaugeResult = parseNullableNonNegative(input.crossGauge, 'Cross string gauge')
  if (!crossGaugeResult.ok) errors.crossGauge = crossGaugeResult.error

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const recommendedMin = value(recommendedMinResult)
  const recommendedMax = value(recommendedMaxResult)
  const hasTensionMeta = tensionAdjustment != null || recommendedMin != null || recommendedMax != null || input.tensionNotes.trim() !== ''

  const tensionMeta = hasTensionMeta
    ? {
        ...(tensionAdjustment != null ? { tensionAdjustment } : {}),
        ...(recommendedMin != null ? { recommendedMin } : {}),
        ...(recommendedMax != null ? { recommendedMax } : {}),
        ...(input.tensionNotes.trim() !== '' ? { tensionNotes: input.tensionNotes.trim() } : {}),
      }
    : null

  const mainStringMeta = buildHybridMeta(value(mainGaugeResult), input.mainMaterial, input.mainConstruction, input.mainCoating, input.mainColor)
  const crossStringMeta = buildHybridMeta(value(crossGaugeResult), input.crossMaterial, input.crossConstruction, input.crossCoating, input.crossColor)

  const sharedFields = {
    brand,
    name,
    category: input.category as StringCategory,
    gauge_mm: value(gaugeResult),
    repulsion: value(repulsionResult),
    durability: value(durabilityResult),
    hitting_sound: value(hittingSoundResult),
    shock_absorption: value(shockAbsorptionResult),
    control: value(controlResult),
    string_cost_eur: value(stringCostResult),
    description: input.description.trim() === '' ? null : input.description.trim(),
    tension_meta: tensionMeta,
    popularity_rank: value(popularityRankResult),
    product_url: value(productUrlResult),
    image_url: value(imageUrlResult),
    colors: parseColors(input.colors),
    is_hybrid: input.isHybrid,
    main_string_meta: mainStringMeta,
    cross_string_meta: crossStringMeta,
  }

  return {
    ok: true,
    warnings,
    payload: {
      ...(context.isNew ? { insert: { id, ...sharedFields } } : {}),
      update: sharedFields,
    },
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Creates a new catalog row, then a default inventory row for it (stock
 * unavailable, quantity unknown, package unknown) so it immediately appears
 * in the inventory admin page rather than requiring a manual insert. If the
 * inventory insert fails after the string insert succeeds, the string is
 * deleted again as a best-effort compensating rollback — PostgREST/Supabase
 * doesn't expose a real cross-table client transaction, so this is the
 * closest equivalent: the operation either fully succeeds or leaves nothing
 * behind, never a catalog row with no matching inventory row.
 */
export async function createString(insert: StringsInsert): Promise<AdminResult<AdminCatalogRow>> {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client.from('strings').insert(insert).select('*').single()
    if (error) return { ok: false, error: error.message }

    const { error: inventoryError } = await client.from('inventory').insert({
      string_id: insert.id,
      stock_status: 'unavailable',
      quantity: null,
      package_type: 'unknown',
    })

    if (inventoryError) {
      await client.from('strings').delete().eq('id', insert.id)
      return { ok: false, error: `Created the string but failed to create its inventory row, so the string was rolled back: ${inventoryError.message}` }
    }

    return { ok: true, data: fromRow(data) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Updates an existing catalog row. Does not touch inventory. */
export async function updateString(id: string, update: StringsUpdate): Promise<AdminResult<AdminCatalogRow>> {
  try {
    const { data, error } = await getSupabaseClient().from('strings').update(update).eq('id', id).select('*').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: fromRow(data) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Deletes a catalog row. `inventory`, `specialist_profiles`, and
 * `retailer_prices` all have `references public.strings(id) on delete
 * cascade`, so this single statement atomically removes the matching
 * inventory row too (a real Postgres transaction, not a client-side
 * simulation). Note: `stringSpecialistProfiles.ts`'s LOCAL specialist data
 * is a separate file, not the (currently unused) `specialist_profiles`
 * table — deleting a string here does not remove a local specialist
 * profile entry for it; the dev debug page flags that mismatch afterward.
 */
export async function deleteString(id: string): Promise<AdminResult<void>> {
  try {
    const { error } = await getSupabaseClient().from('strings').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
