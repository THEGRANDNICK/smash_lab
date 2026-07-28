// Phase 7: the ONLY place that queries Supabase for retailer ENTITY
// (public.retailers) data on the public read path. Components never call
// Supabase directly — retailerPriceService.ts consumes this module to join
// retailer metadata (name, logo, active status) onto each listing; nothing
// public-facing imports this module directly.
//
// Retailers are purely presentational, reusable metadata. Never passed to
// logic/recommendationEngine.ts.

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import type { Database } from '../types/database.js'
import { SAFE_URL_PATTERN } from './catalogService.js'

type RetailerRow = Database['public']['Tables']['retailers']['Row']

export interface Retailer {
  id: number
  name: string
  logoUrl: string | null
  websiteUrl: string | null
  country: string | null
  active: boolean
  updatedAt: string
}

export type RetailerEntitySource = 'live' | 'unavailable'

export interface RetailerEntityFetchStatus {
  at: string
  source: RetailerEntitySource
  acceptedCount: number
  rejectedCount: number
  rejectedReasons: string[]
  fallbackReason?: string
}

export interface RetailerEntityFetchResult {
  retailersById: Record<number, Retailer>
  status: RetailerEntityFetchStatus
}

let lastFetchStatus: RetailerEntityFetchStatus | null = null

/** For the /debug/supabase page — reports the outcome of the most recent fetchRetailersFromSupabase() call, if any has run yet this session. */
export function getLastRetailerEntityFetchStatus(): RetailerEntityFetchStatus | null {
  return lastFetchStatus
}

/** ISO 3166-1 alpha-2, matching the database's own CHECK constraint. */
const COUNTRY_PATTERN = /^[A-Z]{2}$/

export type RetailerRowValidation = { ok: true; retailer: Retailer } | { ok: false; reason: string }

/** Maps + validates a single public.retailers row. Never throws. */
export function mapRetailerRow(row: RetailerRow): RetailerRowValidation {
  const name = row.name?.trim()
  if (!name) return { ok: false, reason: `retailer id ${row.id}: empty or missing name` }
  if (row.logo_url != null && !SAFE_URL_PATTERN.test(row.logo_url)) return { ok: false, reason: `${name}: logo_url must be a valid http(s) URL` }
  if (row.website_url != null && !SAFE_URL_PATTERN.test(row.website_url)) return { ok: false, reason: `${name}: website_url must be a valid http(s) URL` }
  if (row.country != null && !COUNTRY_PATTERN.test(row.country)) return { ok: false, reason: `${name}: country must be a 2-letter code (e.g. "DE")` }

  return {
    ok: true,
    retailer: {
      id: row.id,
      name,
      logoUrl: row.logo_url,
      websiteUrl: row.website_url,
      country: row.country,
      active: row.active,
      updatedAt: row.updated_at,
    },
  }
}

function fallbackResult(reason: string | undefined, rejectedCount = 0, rejectedReasons: string[] = []): RetailerEntityFetchResult {
  const status: RetailerEntityFetchStatus = {
    at: new Date().toISOString(),
    source: 'unavailable',
    acceptedCount: 0,
    rejectedCount,
    rejectedReasons,
    fallbackReason: reason,
  }
  lastFetchStatus = status
  return { retailersById: {}, status }
}

/**
 * Fetches every retailer entity from Supabase. Never throws and never
 * surfaces a user-facing error — retailerPriceService.ts treats a failure
 * here as "cannot safely join or check active status," so it shows no
 * purchase options at all rather than guessing. Individual invalid rows
 * are skipped and logged rather than failing the whole fetch.
 */
export async function fetchRetailersFromSupabase(): Promise<RetailerEntityFetchResult> {
  if (!isSupabaseConfigured) {
    return fallbackResult('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).')
  }

  let rows: RetailerRow[]
  try {
    const { data, error } = await getSupabaseClient().from('retailers').select('*')
    if (error) {
      console.warn('[retailerService] Supabase retailer fetch failed:', error.message)
      return fallbackResult(error.message)
    }
    rows = data ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[retailerService] Supabase retailer fetch threw:', message)
    return fallbackResult(message)
  }

  const retailersById: Record<number, Retailer> = {}
  const rejectedReasons: string[] = []

  for (const row of rows) {
    const result = mapRetailerRow(row)
    if (result.ok) retailersById[result.retailer.id] = result.retailer
    else rejectedReasons.push(result.reason)
  }

  if (rejectedReasons.length > 0) {
    console.warn(`[retailerService] ${rejectedReasons.length} retailer row(s) rejected:`, rejectedReasons)
  }

  const status: RetailerEntityFetchStatus = {
    at: new Date().toISOString(),
    source: 'live',
    acceptedCount: rows.length - rejectedReasons.length,
    rejectedCount: rejectedReasons.length,
    rejectedReasons,
  }
  lastFetchStatus = status
  return { retailersById, status }
}

/** Case-insensitive name collisions among already-valid retailers — the database's own unique index on lower(name) should make this structurally impossible, but checked anyway (mirrors retailerPriceService.ts's findDuplicateCandidates) as a defensive debug-page signal rather than an assumption. */
export function findDuplicateRetailerNameCandidates(retailersById: Record<number, Retailer>): string[] {
  const byLowerName = new Map<string, Retailer[]>()
  for (const retailer of Object.values(retailersById)) {
    const key = retailer.name.toLowerCase()
    const group = byLowerName.get(key)
    if (group) group.push(retailer)
    else byLowerName.set(key, [retailer])
  }
  const candidates: string[] = []
  for (const group of byLowerName.values()) {
    if (group.length > 1) candidates.push(`${group[0].name} (${group.length} retailers)`)
  }
  return candidates
}
