// Phase 2: the ONLY place that queries Supabase for inventory data.
// Components never call Supabase directly — they consume the plain
// StringItem[] this module (via hooks/useLiveStrings.ts) produces.
//
// The recommendation engine stays completely untouched and stock-blind:
// this module only ever changes the `.stock` (and `.setsAvailable`)
// fields already present on each StringItem, purely for presentation
// (badges, filters, Best Available Alternative). It never affects
// scoring, weights, or which strings are eligible to be recommended.

import { strings as catalog, type StringItem, type StockLevel } from '../data/strings'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export type PackageType = 'reel' | 'set' | 'mixed' | 'unknown'

export interface InventorySnapshot {
  stockStatus: StockLevel
  /** Internal only — never shown publicly as an exact count, matching the existing UI's behavior. */
  quantity: number | null
  packageType: PackageType
  color?: string
  notes?: string
}

export type InventoryMap = Record<string, InventorySnapshot>

export interface FetchStatus {
  at: string
  ok: boolean
  message?: string
}

let lastFetchStatus: FetchStatus | null = null

/** For the /debug/supabase page — reports the outcome of the most recent fetchInventoryFromSupabase() call, if any has run yet this session. */
export function getLastFetchStatus(): FetchStatus | null {
  return lastFetchStatus
}

/**
 * Derived straight from strings.ts's own stock/setsAvailable fields —
 * zero network, always available. This is the fallback used whenever
 * Supabase is unreachable or not configured, and it's also exactly what
 * the site already showed before Phase 2, so falling back to it is
 * never a visible regression.
 */
export function getLocalFallbackInventory(): InventoryMap {
  const map: InventoryMap = {}
  for (const item of catalog) {
    map[item.id] = {
      stockStatus: item.stock,
      quantity: item.setsAvailable ?? null,
      packageType: 'unknown',
    }
  }
  return map
}

/**
 * Fetches live inventory from Supabase. Never throws — returns null on
 * any failure (not configured, network error, query error), logging a
 * console warning so a failure is visible in dev tools without ever
 * surfacing as a user-facing error. Callers should treat null as "use
 * getLocalFallbackInventory() instead".
 */
export async function fetchInventoryFromSupabase(): Promise<InventoryMap | null> {
  if (!isSupabaseConfigured) {
    lastFetchStatus = { at: new Date().toISOString(), ok: false, message: 'Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).' }
    return null
  }

  try {
    const { data, error } = await getSupabaseClient().from('inventory').select('string_id, stock_status, quantity, package_type, color, notes')

    if (error) {
      console.warn('[inventoryService] Supabase inventory fetch failed, using local fallback:', error.message)
      lastFetchStatus = { at: new Date().toISOString(), ok: false, message: error.message }
      return null
    }

    const map: InventoryMap = {}
    for (const row of data ?? []) {
      map[row.string_id] = {
        stockStatus: row.stock_status,
        quantity: row.quantity,
        packageType: row.package_type,
        color: row.color ?? undefined,
        notes: row.notes ?? undefined,
      }
    }
    lastFetchStatus = { at: new Date().toISOString(), ok: true, message: `${Object.keys(map).length} row(s)` }
    return map
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[inventoryService] Supabase inventory fetch threw, using local fallback:', message)
    lastFetchStatus = { at: new Date().toISOString(), ok: false, message }
    return null
  }
}

/**
 * Merges an inventory map onto the catalog, producing StringItem[] with
 * live stock. Never removes a catalog string. A string present in the
 * catalog but missing from `inventory` (e.g. a brand-new string not yet
 * backfilled) keeps its own existing stock value from strings.ts rather
 * than being forced to "unavailable" — conservative by design, since the
 * catalog's own value is a known-good fallback, not a guess.
 */
export function mergeInventoryIntoCatalog(inventory: InventoryMap): StringItem[] {
  return catalog.map((item) => {
    const entry = inventory[item.id]
    if (!entry) return item
    return { ...item, stock: entry.stockStatus, setsAvailable: entry.quantity ?? undefined }
  })
}
