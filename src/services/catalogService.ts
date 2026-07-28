// Phase 4: the ONLY place that queries Supabase for catalog (public.strings)
// data. Components never call Supabase directly — they consume the plain
// StringItem[] this module (via hooks/useStringPool.ts) produces.
//
// Architecture: catalog fetching is deliberately decoupled from inventory
// fetching (see services/inventoryService.ts). This module's job stops at
// "a validated, ordered StringItem[] with a placeholder stock value" — it
// never reads or writes public.inventory. The orchestrating hook merges the
// two afterward.
//
// Source-of-truth rule: either the ENTIRE live catalog is accepted, or the
// ENTIRE local fallback (src/data/strings.ts) is used instead. A partial
// live catalog (missing known strings, or containing invalid rows) is never
// merged with the local fallback to "fill the gaps" — that would risk a
// silent, non-deterministic mix. See isLiveCatalogComplete() below.

import { strings as localCatalog, type StringItem, type StringCategory, type StringTensionMeta, type HybridStringMeta } from '../data/strings.js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import type { Database } from '../types/database.js'

type StringsRow = Database['public']['Tables']['strings']['Row']

export type CatalogSource = 'live' | 'fallback'

export interface CatalogFetchStatus {
  at: string
  source: CatalogSource
  acceptedCount: number
  rejectedCount: number
  rejectedReasons: string[]
  /** Only set when source === 'fallback' and Supabase was actually reachable but rejected for a structural reason (missing config/network failure has its own message instead). */
  fallbackReason?: string
}

export interface CatalogResult {
  items: StringItem[]
  status: CatalogFetchStatus
}

let lastFetchStatus: CatalogFetchStatus | null = null

/** For the /debug/supabase page — reports the outcome of the most recent fetchCatalogFromSupabase() call, if any has run yet this session. */
export function getLastCatalogFetchStatus(): CatalogFetchStatus | null {
  return lastFetchStatus
}

/**
 * The complete local catalog, in its own authored order — used both as the
 * fallback dataset and as the canonical ordering reference for the live
 * catalog (see sortByCanonicalOrder). Never mutated.
 */
export function getLocalFallbackCatalog(): StringItem[] {
  return localCatalog
}

const LOCAL_ORDER_INDEX: ReadonlyMap<string, number> = new Map(localCatalog.map((item, i) => [item.id, i]))

/**
 * Preserves strings.ts's own hand-curated display order for every string
 * already known locally (grouped by brand/category, not derivable from
 * popularity_rank alone — most strings have no rank at all). Any string
 * that only exists live (e.g. added directly in Supabase ahead of a future
 * catalog admin UI) sorts deterministically after all known strings, by
 * popularity rank then brand/name/id.
 */
export function sortByCanonicalOrder(items: StringItem[]): StringItem[] {
  return [...items].sort((a, b) => {
    const ai = LOCAL_ORDER_INDEX.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const bi = LOCAL_ORDER_INDEX.get(b.id) ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    const ap = a.popularityRank ?? Number.MAX_SAFE_INTEGER
    const bp = b.popularityRank ?? Number.MAX_SAFE_INTEGER
    if (ap !== bp) return ap - bp
    return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  })
}

// Exported so services/catalogAdminService.ts (Phase 5's create/edit form
// validation) enforces exactly the same rules as this read-path validator —
// one source of truth for what counts as a valid catalog row, whether it
// came from a live fetch or an admin form submission.
export const VALID_CATEGORIES: readonly StringCategory[] = ['repulsion', 'control', 'durability']
export const RATING_MIN = 0
export const RATING_MAX = 11
/** Only http(s) accepted — rejects javascript:/data: schemes so a malformed row can never become a clickable script link. */
export const SAFE_URL_PATTERN = /^https?:\/\//i

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function inRange(v: number, min: number, max: number): boolean {
  return v >= min && v <= max
}

/** True if `v` has at most `maxDecimals` decimal places (e.g. 9.5 passes at maxDecimals=1, 9.55 does not) — rejects over-precise input rather than silently rounding it, matching the database's own `= round(x, 1)` CHECK constraint on ratings. */
export function hasDecimalPrecision(v: number, maxDecimals: number): boolean {
  return Math.round(v * 10 ** maxDecimals) / 10 ** maxDecimals === v
}

/** Validates one side (main/cross) of a hybrid string's sparse jsonb metadata. Display/admin detail only — never feeds the recommendation engine. */
function validateHybridSide(meta: unknown, side: 'main' | 'cross', id: string): { ok: true; value: HybridStringMeta | undefined } | { ok: false; reason: string } {
  if (meta == null) return { ok: true, value: undefined }
  if (typeof meta !== 'object') return { ok: false, reason: `${id}: ${side}_string_meta must be an object` }
  const m = meta as Record<string, unknown>

  if (m.gauge != null) {
    if (!isFiniteNumber(m.gauge) || m.gauge < 0) return { ok: false, reason: `${id}: ${side}_string_meta.gauge must be a non-negative number` }
  }
  for (const key of ['material', 'construction', 'coating', 'color'] as const) {
    if (m[key] != null && typeof m[key] !== 'string') {
      return { ok: false, reason: `${id}: ${side}_string_meta.${key} must be a string` }
    }
  }

  const value = {
    ...(m.gauge != null ? { gauge: m.gauge as number } : {}),
    ...(m.material != null ? { material: m.material as string } : {}),
    ...(m.construction != null ? { construction: m.construction as string } : {}),
    ...(m.coating != null ? { coating: m.coating as string } : {}),
    ...(m.color != null ? { color: m.color as string } : {}),
  }
  return { ok: true, value: Object.keys(value).length > 0 ? value : undefined }
}

export type CatalogRowValidation = { ok: true; item: StringItem } | { ok: false; reason: string }

/**
 * Maps + validates a single public.strings row into the application's
 * StringItem model. Never throws — returns a typed failure instead. Numeric
 * fields are range-checked (not just type-checked) so a corrupt row (e.g. a
 * rating of 50) is rejected rather than silently reaching the recommendation
 * engine with a misleading value. Nullable columns map to StringItem's own
 * optional/nullable fields explicitly — a null is never turned into 0 or any
 * other default that could pass as a real rating.
 *
 * `stock`/`setsAvailable` are intentionally NOT set from real data here —
 * public.strings has no stock column. Callers must merge inventory
 * afterward; the placeholder 'unavailable' here is only ever visible for a
 * catalog row with no matching inventory row at all, and is deliberately
 * the most conservative default (never overstates availability).
 */
export function mapCatalogRow(row: StringsRow): CatalogRowValidation {
  const id = row.id?.trim()
  if (!id) return { ok: false, reason: 'empty or missing id' }

  const brand = row.brand?.trim()
  if (!brand) return { ok: false, reason: `${id}: empty or missing brand` }

  const name = row.name?.trim()
  if (!name) return { ok: false, reason: `${id}: empty or missing name` }

  if (!VALID_CATEGORIES.includes(row.category as StringCategory)) {
    return { ok: false, reason: `${id}: invalid category "${String(row.category)}"` }
  }
  const category = row.category as StringCategory

  for (const [field, value] of [
    ['repulsion', row.repulsion],
    ['durability', row.durability],
    ['hittingSound', row.hitting_sound],
    ['control', row.control],
  ] as const) {
    if (!isFiniteNumber(value) || !inRange(value, RATING_MIN, RATING_MAX)) {
      return { ok: false, reason: `${id}: ${field} rating "${String(value)}" is not a number within ${RATING_MIN}-${RATING_MAX}` }
    }
    if (!hasDecimalPrecision(value, 1)) {
      return { ok: false, reason: `${id}: ${field} rating "${String(value)}" has more than one decimal place` }
    }
  }

  let shockAbsorption: number | null = null
  if (row.shock_absorption != null) {
    if (!isFiniteNumber(row.shock_absorption) || !inRange(row.shock_absorption, RATING_MIN, RATING_MAX)) {
      return { ok: false, reason: `${id}: shockAbsorption "${String(row.shock_absorption)}" is not a number within ${RATING_MIN}-${RATING_MAX}` }
    }
    if (!hasDecimalPrecision(row.shock_absorption, 1)) {
      return { ok: false, reason: `${id}: shockAbsorption "${String(row.shock_absorption)}" has more than one decimal place` }
    }
    shockAbsorption = row.shock_absorption
  }

  let gauge: number | undefined
  if (row.gauge_mm != null) {
    if (!isFiniteNumber(row.gauge_mm) || row.gauge_mm < 0) {
      return { ok: false, reason: `${id}: gauge_mm "${String(row.gauge_mm)}" must be a non-negative number` }
    }
    gauge = row.gauge_mm
  }

  let stringCost: number | null = null
  if (row.string_cost_eur != null) {
    if (!isFiniteNumber(row.string_cost_eur) || row.string_cost_eur < 0) {
      return { ok: false, reason: `${id}: string_cost_eur "${String(row.string_cost_eur)}" must be a non-negative number` }
    }
    stringCost = row.string_cost_eur
  }

  let popularityRank: number | undefined
  if (row.popularity_rank != null) {
    if (!isFiniteNumber(row.popularity_rank) || !Number.isInteger(row.popularity_rank) || row.popularity_rank < 1) {
      return { ok: false, reason: `${id}: popularity_rank "${String(row.popularity_rank)}" must be a positive integer` }
    }
    popularityRank = row.popularity_rank
  }

  let colors: string[] | undefined
  if (row.colors != null) {
    if (!Array.isArray(row.colors) || row.colors.some((c) => typeof c !== 'string')) {
      return { ok: false, reason: `${id}: colors must be an array of strings` }
    }
    colors = row.colors.length > 0 ? row.colors : undefined
  }

  let productUrl: string | undefined
  if (row.product_url != null) {
    if (typeof row.product_url !== 'string' || row.product_url.trim() === '' || !SAFE_URL_PATTERN.test(row.product_url)) {
      return { ok: false, reason: `${id}: product_url must be a non-empty http(s) URL` }
    }
    productUrl = row.product_url
  }

  let imageUrl: string | undefined
  if (row.image_url != null) {
    if (typeof row.image_url !== 'string' || row.image_url.trim() === '' || !SAFE_URL_PATTERN.test(row.image_url)) {
      return { ok: false, reason: `${id}: image_url must be a non-empty http(s) URL` }
    }
    imageUrl = row.image_url
  }

  let tension: StringTensionMeta | undefined
  const meta = row.tension_meta
  if (meta != null && typeof meta !== 'object') {
    return { ok: false, reason: `${id}: tension_meta must be an object` }
  }
  if (gauge != null || meta != null) {
    const tensionAdjustment = meta?.tensionAdjustment
    const recommendedMin = meta?.recommendedMin
    const recommendedMax = meta?.recommendedMax
    const tensionNotes = meta?.tensionNotes

    if (tensionAdjustment != null && !isFiniteNumber(tensionAdjustment)) {
      return { ok: false, reason: `${id}: tension_meta.tensionAdjustment must be a number` }
    }
    if (recommendedMin != null && !isFiniteNumber(recommendedMin)) {
      return { ok: false, reason: `${id}: tension_meta.recommendedMin must be a number` }
    }
    if (recommendedMax != null && !isFiniteNumber(recommendedMax)) {
      return { ok: false, reason: `${id}: tension_meta.recommendedMax must be a number` }
    }
    if (recommendedMin != null && recommendedMax != null && recommendedMin > recommendedMax) {
      return { ok: false, reason: `${id}: tension_meta.recommendedMin (${recommendedMin}) exceeds recommendedMax (${recommendedMax})` }
    }
    if (tensionNotes != null && typeof tensionNotes !== 'string') {
      return { ok: false, reason: `${id}: tension_meta.tensionNotes must be a string` }
    }

    tension = {
      ...(gauge != null ? { gauge } : {}),
      ...(tensionAdjustment != null ? { tensionAdjustment } : {}),
      ...(recommendedMin != null ? { recommendedMin } : {}),
      ...(recommendedMax != null ? { recommendedMax } : {}),
      ...(tensionNotes != null ? { tensionNotes } : {}),
    }
  }

  const notes = row.description != null && row.description.trim() !== '' ? row.description : undefined

  const mainStringResult = validateHybridSide(row.main_string_meta, 'main', id)
  if (!mainStringResult.ok) return mainStringResult
  const crossStringResult = validateHybridSide(row.cross_string_meta, 'cross', id)
  if (!crossStringResult.ok) return crossStringResult

  const item: StringItem = {
    id,
    brand,
    name,
    category,
    repulsion: row.repulsion,
    durability: row.durability,
    hittingSound: row.hitting_sound,
    shockAbsorption,
    control: row.control,
    // Placeholder only — overwritten by the inventory merge step for every
    // string that has an inventory row (which migrateInventory.ts guarantees
    // for all catalog rows it seeds). See the doc comment above.
    stock: 'unavailable',
    stringCost,
    ...(colors ? { colors } : {}),
    ...(notes ? { notes } : {}),
    ...(tension ? { tension } : {}),
    ...(popularityRank != null ? { popularityRank } : {}),
    ...(productUrl ? { productUrl } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(row.is_hybrid ? { isHybrid: true } : {}),
    ...(mainStringResult.value ? { mainString: mainStringResult.value } : {}),
    ...(crossStringResult.value ? { crossString: crossStringResult.value } : {}),
  }

  return { ok: true, item }
}

/** Pure, independently testable: which ids appear more than once in a row set (kept in first-seen order). */
export function detectDuplicateIds(rows: { id: string }[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const row of rows) {
    if (seen.has(row.id)) {
      if (!duplicates.includes(row.id)) duplicates.push(row.id)
    } else {
      seen.add(row.id)
    }
  }
  return duplicates
}

/**
 * The live catalog is only ever trusted whole. It's "complete" when every
 * string the local fallback knows about was actually accepted — extra,
 * not-yet-locally-known strings are fine (more strings will be added over
 * time), but a MISSING known string means something is structurally wrong
 * (a bad row, a partial fetch, a botched migration) and the whole live
 * result is discarded in favor of the local fallback rather than risking a
 * half-broken catalog.
 */
export function isLiveCatalogComplete(localIds: ReadonlySet<string>, acceptedIds: ReadonlySet<string>): boolean {
  for (const id of localIds) {
    if (!acceptedIds.has(id)) return false
  }
  return true
}

function fallbackResult(reason: string | undefined, rejectedCount = 0, rejectedReasons: string[] = []): CatalogResult {
  const status: CatalogFetchStatus = {
    at: new Date().toISOString(),
    source: 'fallback',
    acceptedCount: 0,
    rejectedCount,
    rejectedReasons,
    fallbackReason: reason,
  }
  lastFetchStatus = status
  return { items: getLocalFallbackCatalog(), status }
}

/**
 * Fetches and validates the live catalog from Supabase. Never throws and
 * never surfaces a user-facing error — any structural problem (unreachable,
 * misconfigured, empty, incomplete, or containing invalid rows) results in
 * the complete local fallback catalog being returned instead, with the
 * reason recorded in getLastCatalogFetchStatus() for the dev debug page.
 * A console warning is logged in every fallback case so the condition is
 * still visible during development.
 */
export async function fetchCatalogFromSupabase(): Promise<CatalogResult> {
  if (!isSupabaseConfigured) {
    return fallbackResult('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).')
  }

  let rows: StringsRow[]
  try {
    const { data, error } = await getSupabaseClient().from('strings').select('*')
    if (error) {
      console.warn('[catalogService] Supabase catalog fetch failed, using local fallback:', error.message)
      return fallbackResult(error.message)
    }
    rows = data ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[catalogService] Supabase catalog fetch threw, using local fallback:', message)
    return fallbackResult(message)
  }

  if (rows.length === 0) {
    console.warn('[catalogService] Supabase catalog returned zero rows, using local fallback.')
    return fallbackResult('Live catalog returned zero rows.')
  }

  const duplicates = detectDuplicateIds(rows)
  const rejectedReasons: string[] = duplicates.map((id) => `duplicate id "${id}" (kept first occurrence, rejected the rest)`)
  const seen = new Set<string>()
  const accepted: StringItem[] = []

  for (const row of rows) {
    if (seen.has(row.id)) continue // duplicate — already recorded above, skip silently past the first
    seen.add(row.id)

    const result = mapCatalogRow(row)
    if (result.ok) {
      accepted.push(result.item)
    } else {
      rejectedReasons.push(result.reason)
    }
  }

  const localIds = new Set(getLocalFallbackCatalog().map((i) => i.id))
  const acceptedIds = new Set(accepted.map((i) => i.id))

  if (!isLiveCatalogComplete(localIds, acceptedIds)) {
    const missing = [...localIds].filter((id) => !acceptedIds.has(id))
    const reason = `Live catalog is missing ${missing.length} known string(s): ${missing.join(', ')}`
    console.warn(`[catalogService] ${reason} — using complete local fallback instead.`)
    return fallbackResult(reason, rejectedReasons.length, rejectedReasons)
  }

  if (rejectedReasons.length > 0) {
    console.warn(`[catalogService] ${rejectedReasons.length} live catalog row(s) rejected:`, rejectedReasons)
  }

  const status: CatalogFetchStatus = {
    at: new Date().toISOString(),
    source: 'live',
    acceptedCount: accepted.length,
    rejectedCount: rejectedReasons.length,
    rejectedReasons,
  }
  lastFetchStatus = status
  return { items: sortByCanonicalOrder(accepted), status }
}
