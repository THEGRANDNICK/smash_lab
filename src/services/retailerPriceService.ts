// Phase 7: the ONLY place that queries Supabase for retailer listing
// (public.retailer_prices) data. Components never call Supabase directly —
// they consume the plain Record<string, RetailerListing[]> this module
// (via hooks/useRetailerPrices.ts) produces, already joined with retailer
// metadata (name, logo, active status) from retailerService.ts.
//
// Retailer data is purely presentational. It is NEVER passed to
// logic/recommendationEngine.ts — recommendStrings()'s signature has no
// retailer parameter at all, so there is nothing to inject and nothing for
// the engine to depend on. See scripts/testRetailers.ts's isolation tests.
//
// Like specialist profiles (Phase 6) and unlike the catalog (Phase 4),
// retailer data has NO completeness gate: most strings legitimately have
// zero listings, which is normal, not corruption. A live fetch that
// succeeds is used exactly as returned; only a fetch that fails outright
// (network/config/error) results in an empty map (no purchase options
// shown anywhere) plus a recorded diagnostic failure — there is no local
// fallback dataset, because no real local retailer data exists to fall
// back to (inventing one would misrepresent real prices to users).
//
// Public visibility rule: a listing whose retailer is inactive is hidden
// from this read path entirely (never appears in listingsByStringId) —
// the admin's retailerListingAdminService.ts sees every listing
// regardless of retailer active status, since admins still need to view
// and edit those listings.

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js'
import type { Database, RetailerAvailabilityStatus, RetailerCurrency, RetailerPackageType } from '../types/database.js'
import { isFiniteNumber, hasDecimalPrecision, SAFE_URL_PATTERN } from './catalogService.js'
import { fetchRetailersFromSupabase, type Retailer } from './retailerService.js'

type RetailerPriceRow = Database['public']['Tables']['retailer_prices']['Row']

export const RETAILER_CURRENCIES: readonly RetailerCurrency[] = ['EUR']
export const RETAILER_AVAILABILITY_STATUSES: readonly RetailerAvailabilityStatus[] = [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'preorder',
  'discontinued',
  'unknown',
]
export const RETAILER_PACKAGE_TYPES: readonly RetailerPackageType[] = ['set', 'reel', 'hybrid', 'other']

/** Shared human-readable labels — used by both the public PurchaseOptions display and the admin Retailer Listings UI, so the two never drift apart. */
export const AVAILABILITY_LABELS: Record<RetailerAvailabilityStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  preorder: 'Preorder',
  discontinued: 'Discontinued',
  unknown: 'Availability unknown',
}
export const PACKAGE_TYPE_LABELS: Record<RetailerPackageType, string> = {
  set: 'Set',
  reel: 'Reel',
  hybrid: 'Hybrid package',
  other: 'Other',
}

/** Ranks availability from "most buyable" to "least" for default (no-preferred) ordering — lower sorts first. */
const AVAILABILITY_RANK: Record<RetailerAvailabilityStatus, number> = {
  in_stock: 0,
  low_stock: 1,
  preorder: 2,
  unknown: 3,
  out_of_stock: 4,
  discontinued: 5,
}

/** A listing, joined with its retailer's display metadata. retailerActive is carried through even on the public path (always true there, since inactive-retailer listings are filtered out before this type is ever constructed for a public consumer) so admin code can reuse the same shape without a second type. */
export interface RetailerListing {
  id: number
  stringId: string
  retailerId: number
  retailerName: string
  retailerLogoUrl: string | null
  retailerActive: boolean
  productUrl: string | null
  price: number | null
  currency: RetailerCurrency
  availabilityStatus: RetailerAvailabilityStatus
  packageType: RetailerPackageType
  packageLengthM: number | null
  isPreferred: boolean
  notes: string | null
  lastCheckedAt: string | null
  updatedAt: string
}

export type RetailerSource = 'live' | 'unavailable'

export interface RetailerFetchStatus {
  at: string
  source: RetailerSource
  acceptedCount: number
  rejectedCount: number
  rejectedReasons: string[]
  /** Listings whose retailer resolved fine but is inactive — hidden from the public site by design, not an error. */
  hiddenInactiveCount: number
  fallbackReason?: string
}

export interface RetailerFetchResult {
  listingsByStringId: Record<string, RetailerListing[]>
  status: RetailerFetchStatus
}

let lastFetchStatus: RetailerFetchStatus | null = null

/** For the /debug/supabase page — reports the outcome of the most recent fetchRetailerPricesFromSupabase() call, if any has run yet this session. */
export function getLastRetailerFetchStatus(): RetailerFetchStatus | null {
  return lastFetchStatus
}

export type RetailerRowValidation = { ok: true; item: RetailerListing } | { ok: false; reason: string }

/**
 * Maps + validates a single public.retailer_prices row, joined with its
 * already-fetched retailer. `retailer` is `undefined` if retailer_id
 * didn't resolve — structurally impossible given the database's own FK,
 * but checked anyway (surfaced as "missing retailer relation" on the
 * debug page) rather than assumed. Never throws.
 */
export function mapRetailerPriceRow(row: RetailerPriceRow, retailer: Retailer | undefined): RetailerRowValidation {
  const stringId = row.string_id?.trim()
  if (!stringId) return { ok: false, reason: 'empty or missing string_id' }

  if (!retailer) return { ok: false, reason: `${stringId}: retailer_id ${row.retailer_id} has no matching retailer (missing retailer relation)` }

  if (row.price != null) {
    if (!isFiniteNumber(row.price) || row.price < 0) return { ok: false, reason: `${stringId}/${retailer.name}: price must be a non-negative number` }
    if (!hasDecimalPrecision(row.price, 2)) return { ok: false, reason: `${stringId}/${retailer.name}: price allows at most 2 decimal places (e.g. 12.99)` }
  }

  if (!RETAILER_CURRENCIES.includes(row.currency)) return { ok: false, reason: `${stringId}/${retailer.name}: invalid currency "${String(row.currency)}"` }
  if (!RETAILER_AVAILABILITY_STATUSES.includes(row.availability_status)) {
    return { ok: false, reason: `${stringId}/${retailer.name}: invalid availability_status "${String(row.availability_status)}"` }
  }
  if (!RETAILER_PACKAGE_TYPES.includes(row.package_type)) return { ok: false, reason: `${stringId}/${retailer.name}: invalid package_type "${String(row.package_type)}"` }

  if (row.package_length_m != null) {
    if (!isFiniteNumber(row.package_length_m) || row.package_length_m <= 0) {
      return { ok: false, reason: `${stringId}/${retailer.name}: package_length_m must be a positive number` }
    }
  }

  if (row.product_url != null && !SAFE_URL_PATTERN.test(row.product_url)) {
    return { ok: false, reason: `${stringId}/${retailer.name}: product_url must be a valid http(s) URL` }
  }

  if (row.notes != null && typeof row.notes !== 'string') {
    return { ok: false, reason: `${stringId}/${retailer.name}: notes must be a string` }
  }

  const item: RetailerListing = {
    id: row.id,
    stringId,
    retailerId: retailer.id,
    retailerName: retailer.name,
    retailerLogoUrl: retailer.logoUrl,
    retailerActive: retailer.active,
    productUrl: row.product_url,
    price: row.price,
    currency: row.currency,
    availabilityStatus: row.availability_status,
    packageType: row.package_type,
    packageLengthM: row.package_length_m,
    isPreferred: row.is_preferred,
    notes: row.notes,
    lastCheckedAt: row.last_checked_at,
    updatedAt: row.updated_at,
  }
  return { ok: true, item }
}

/**
 * Orders one string's listings for display: any preferred listing first
 * (only one is expected — see findPreferredConflicts — but if a data error
 * produces more than one, they still all sort ahead of non-preferred
 * ones), then by availability ("most buyable" first), then by price
 * ascending (unpriced listings last), then retailer name for a
 * deterministic tie-break.
 */
export function orderRetailerListings(listings: readonly RetailerListing[]): RetailerListing[] {
  return [...listings].sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1
    const av = AVAILABILITY_RANK[a.availabilityStatus] - AVAILABILITY_RANK[b.availabilityStatus]
    if (av !== 0) return av
    const ap = a.price ?? Number.POSITIVE_INFINITY
    const bp = b.price ?? Number.POSITIVE_INFINITY
    if (ap !== bp) return ap - bp
    return a.retailerName.localeCompare(b.retailerName) || a.id - b.id
  })
}

/** Two listings are directly price-comparable only if they represent the same real-world product unit: same package type, same package length (both null counts as equal — two "unknown length" listings of the same type), and the same currency. A 10m set and a 200m reel (or a set vs. a reel of the same string) are never comparable, even if both happen to be EUR. */
export function areListingsComparable(a: RetailerListing, b: RetailerListing): boolean {
  return a.packageType === b.packageType && a.packageLengthM === b.packageLengthM && a.currency === b.currency
}

/** Groups a string's listings into comparable buckets (see areListingsComparable) — each group can be safely price-compared within itself, but never against another group. */
export function groupComparableListings(listings: readonly RetailerListing[]): RetailerListing[][] {
  const groups: RetailerListing[][] = []
  for (const listing of listings) {
    const group = groups.find((g) => areListingsComparable(g[0], listing))
    if (group) group.push(listing)
    else groups.push([listing])
  }
  return groups
}

/** The lowest priced listing within a single comparable group (ignores unpriced listings), or null if none has a known price. Never compares across groups — call groupComparableListings first. */
export function lowestPriceInGroup(group: readonly RetailerListing[]): RetailerListing | null {
  let lowest: RetailerListing | null = null
  for (const listing of group) {
    if (listing.price == null) continue
    if (lowest == null || listing.price < lowest.price!) lowest = listing
  }
  return lowest
}

/**
 * Price per metre for a single listing, for display only — never used to
 * compare across strings or across package types (a hybrid string's
 * combined-package price-per-metre is not directly comparable to a normal
 * string's, since "one metre" of a hybrid package still contains two
 * different constructions). Requires both a known price and a known
 * package length; rounded to 2 decimal places, consistent with the
 * currency's own precision.
 */
export function pricePerMetre(listing: RetailerListing): number | null {
  if (listing.price == null || listing.packageLengthM == null || listing.packageLengthM <= 0) return null
  return Math.round((listing.price / listing.packageLengthM) * 100) / 100
}

/** Formats a listing's price for display (EUR only for now — see RetailerCurrency). Returns null (never a placeholder string) when the price is unknown, so callers can decide their own "price on request"-style copy. */
export function formatRetailerPrice(price: number | null, currency: RetailerCurrency): string | null {
  if (price == null) return null
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(price)
}

/** More than one preferred listing for the same string is a data error (the editor is meant to enforce "only one preferred per string", but a direct SQL edit or a race could still produce this) — surfaced by the debug page, never silently picked between. */
export function findPreferredConflicts(listingsByStringId: Record<string, RetailerListing[]>): string[] {
  return Object.entries(listingsByStringId)
    .filter(([, listings]) => listings.filter((l) => l.isPreferred).length > 1)
    .map(([stringId]) => stringId)
}

/** Same string + same retailer with more than one listing — legitimate (a set and a reel from the same retailer are two real listings), but flagged as worth a human glance since it's also the shape a genuine accidental duplicate (entered twice with a typo'd package type/length) would take. The database's unique index already prevents an EXACT duplicate; this is a softer, advisory signal for near-duplicates it can't catch. */
export function findDuplicateCandidates(listingsByStringId: Record<string, RetailerListing[]>): string[] {
  const candidates: string[] = []
  for (const [stringId, listings] of Object.entries(listingsByStringId)) {
    const byRetailer = new Map<number, RetailerListing[]>()
    for (const listing of listings) {
      const group = byRetailer.get(listing.retailerId)
      if (group) group.push(listing)
      else byRetailer.set(listing.retailerId, [listing])
    }
    for (const [, group] of byRetailer) {
      if (group.length > 1) candidates.push(`${stringId}/${group[0].retailerName} (${group.length} listings)`)
    }
  }
  return candidates
}

export interface RetailerDiagnostics {
  totalListings: number
  stringsWithListingsCount: number
  stringsWithoutListingIds: string[]
  outOfStockCount: number
  discontinuedCount: number
  missingLastCheckedCount: number
  preferredConflictStringIds: string[]
  duplicateCandidates: string[]
  currencyCounts: Record<string, number>
  packageTypeCounts: Record<string, number>
}

/** Aggregates every listing diagnostic the /debug/supabase page (and its regression tests) need, from the already-fetched (public, active-retailer-only) listings map plus the full set of known catalog ids (so "strings without any listing" can be reported — a listings map alone can't distinguish "zero listings" from "string doesn't exist"). Retailer-entity diagnostics (active/inactive counts, etc.) live in retailerService.ts's counterpart, computed from the full (unfiltered) admin fetch. */
export function summarizeRetailerDiagnostics(listingsByStringId: Record<string, RetailerListing[]>, catalogIds: readonly string[]): RetailerDiagnostics {
  const all = Object.values(listingsByStringId).flat()
  const currencyCounts: Record<string, number> = {}
  const packageTypeCounts: Record<string, number> = {}
  for (const listing of all) {
    currencyCounts[listing.currency] = (currencyCounts[listing.currency] ?? 0) + 1
    packageTypeCounts[listing.packageType] = (packageTypeCounts[listing.packageType] ?? 0) + 1
  }

  return {
    totalListings: all.length,
    stringsWithListingsCount: Object.keys(listingsByStringId).filter((id) => listingsByStringId[id].length > 0).length,
    stringsWithoutListingIds: catalogIds.filter((id) => (listingsByStringId[id]?.length ?? 0) === 0),
    outOfStockCount: all.filter((l) => l.availabilityStatus === 'out_of_stock').length,
    discontinuedCount: all.filter((l) => l.availabilityStatus === 'discontinued').length,
    missingLastCheckedCount: all.filter((l) => l.lastCheckedAt == null).length,
    preferredConflictStringIds: findPreferredConflicts(listingsByStringId),
    duplicateCandidates: findDuplicateCandidates(listingsByStringId),
    currencyCounts,
    packageTypeCounts,
  }
}

function fallbackResult(reason: string | undefined, rejectedCount = 0, rejectedReasons: string[] = []): RetailerFetchResult {
  const status: RetailerFetchStatus = {
    at: new Date().toISOString(),
    source: 'unavailable',
    acceptedCount: 0,
    rejectedCount,
    rejectedReasons,
    hiddenInactiveCount: 0,
    fallbackReason: reason,
  }
  lastFetchStatus = status
  return { listingsByStringId: {}, status }
}

/**
 * Fetches every VISIBLE retailer listing from Supabase — visible meaning
 * both structurally valid and belonging to an active retailer. Never
 * throws and never surfaces a user-facing error — a failure simply means
 * no purchase options are shown anywhere (the rest of the site is
 * unaffected). Individual invalid rows are skipped and logged rather than
 * failing the whole fetch. If the retailers fetch itself fails, this
 * short-circuits to the same "unavailable" fallback without even querying
 * listings — without retailer data there is no safe way to join names/logos
 * or check active status, so guessing would be worse than showing nothing.
 */
export async function fetchRetailerPricesFromSupabase(): Promise<RetailerFetchResult> {
  if (!isSupabaseConfigured) {
    return fallbackResult('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).')
  }

  const retailersResult = await fetchRetailersFromSupabase()
  if (retailersResult.status.source === 'unavailable') {
    return fallbackResult(`retailer entities unavailable: ${retailersResult.status.fallbackReason ?? 'unknown reason'}`)
  }

  let rows: RetailerPriceRow[]
  try {
    const { data, error } = await getSupabaseClient().from('retailer_prices').select('*')
    if (error) {
      console.warn('[retailerPriceService] Supabase retailer listing fetch failed, no purchase options will be shown:', error.message)
      return fallbackResult(error.message)
    }
    rows = data ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[retailerPriceService] Supabase retailer listing fetch threw, no purchase options will be shown:', message)
    return fallbackResult(message)
  }

  const listingsByStringId: Record<string, RetailerListing[]> = {}
  const rejectedReasons: string[] = []
  let hiddenInactiveCount = 0

  for (const row of rows) {
    const retailer = retailersResult.retailersById[row.retailer_id]
    const result = mapRetailerPriceRow(row, retailer)
    if (!result.ok) {
      rejectedReasons.push(result.reason)
      continue
    }
    if (!result.item.retailerActive) {
      hiddenInactiveCount++
      continue
    }
    ;(listingsByStringId[result.item.stringId] ??= []).push(result.item)
  }

  for (const stringId of Object.keys(listingsByStringId)) {
    listingsByStringId[stringId] = orderRetailerListings(listingsByStringId[stringId])
  }

  if (rejectedReasons.length > 0) {
    console.warn(`[retailerPriceService] ${rejectedReasons.length} retailer listing row(s) rejected:`, rejectedReasons)
  }

  const status: RetailerFetchStatus = {
    at: new Date().toISOString(),
    source: 'live',
    acceptedCount: rows.length - rejectedReasons.length - hiddenInactiveCount,
    rejectedCount: rejectedReasons.length,
    rejectedReasons,
    hiddenInactiveCount,
  }
  lastFetchStatus = status
  return { listingsByStringId, status }
}
