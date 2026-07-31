// Phase 11 — read-only operational dashboard aggregator. This file makes
// NO Supabase queries of its own: it calls the five existing admin fetch
// functions (fetchAdminCatalog, fetchAdminInventory, fetchAdminSpecialistList,
// fetchAdminRetailers, fetchAdminRetailerListings) in parallel and derives
// every summary card, attention list, coverage figure, health metric,
// recent-update entry, and data-quality issue from those same five arrays —
// purely client-side reshaping, exactly like logic/comparisonMetrics.ts does
// for the public comparison table. No new table, no new RPC, no
// service-role key, and (per the existing services it calls) no dashboard
// query bypasses RLS: an authenticated non-admin or anon caller gets
// whatever those policies already allow, same as every other admin page.
//
// One failing source never blocks the rest: each of the five fetches is
// independent (every fetchAdminX() already returns { ok, ... } rather than
// throwing), so a single Supabase hiccup shows one compact per-section
// error while every other panel still renders from what DID load.

import { fetchAdminCatalog, type AdminCatalogRow } from './catalogAdminService.js'
import { fetchAdminInventory, type AdminInventoryRow } from './adminInventoryService.js'
import { fetchAdminSpecialistList, type AdminSpecialistRow } from './specialistAdminService.js'
import { fetchAdminRetailers, type AdminRetailerRow } from './retailerAdminService.js'
import { fetchAdminRetailerListings, type AdminRetailerListingRow } from './retailerListingAdminService.js'
import { summarizeRetailerDiagnostics, type RetailerListing } from './retailerPriceService.js'
import { daysSince } from '../logic/relativeTime.js'

/** Listings last checked more than this many days ago count as "stale" everywhere in the dashboard — one number, defined once, instead of a magic constant repeated in several places. 30 days is a reasonable default cadence for manually re-checking a retailer's price/availability page; adjust here only. */
export const STALE_LISTING_DAYS = 30

/**
 * The canonical admin-section identifier — defined here (not in
 * components/admin/AdminApp.tsx) specifically so this service, and any
 * plain script/test that imports it, never has to pull a .tsx component
 * into a non-JSX compilation (scripts/ is checked under tsconfig.node.json,
 * which has no "jsx" option set). AdminApp.tsx imports this type from here
 * instead of the other way around.
 */
export type AdminSection = 'dashboard' | 'inventory' | 'catalog' | 'specialists' | 'retailers' | 'retailerListings'

export type DashboardSourceId = 'catalog' | 'inventory' | 'specialists' | 'retailers' | 'retailerListings'

export interface DashboardSourceError {
  source: DashboardSourceId
  message: string
}

export interface CatalogSummary {
  total: number
}

export interface InventorySummary {
  total: number
  inStock: number
  lowStock: number
  unavailable: number
  /** Rows with a null quantity — not necessarily wrong (quantity is optional), but worth surfacing since a stringer usually does know how many they have. */
  missingQuantity: number
}

export interface SpecialistSummary {
  totalCatalogStrings: number
  withProfile: number
  withoutProfile: number
  /** Rounded to the nearest whole percent; 0 when totalCatalogStrings is 0 (never NaN/Infinity). */
  coveragePercent: number
}

export interface RetailerSummary {
  total: number
  active: number
  inactive: number
}

export interface RetailerListingSummary {
  total: number
  available: number
  missingPrice: number
  missingProductUrl: number
  neverChecked: number
  stale: number
}

export interface DashboardSummary {
  catalog: CatalogSummary
  inventory: InventorySummary
  specialists: SpecialistSummary
  retailers: RetailerSummary
  retailerListings: RetailerListingSummary
}

export type AttentionPriority = 'unavailable' | 'low-stock' | 'data-issue'

export interface InventoryAttentionItem {
  stringId: string
  brand: string
  name: string
  status: AdminInventoryRow['stockStatus']
  quantity: number | null
  packageType: AdminInventoryRow['packageType']
  updatedAt: string
  priority: AttentionPriority
}

export interface CoverageMetrics {
  specialistProfiles: { present: number; missing: number; total: number; percent: number }
  missingDescription: number
  missingProductUrl: number
  missingImageUrl: number
  /** Strings missing shock absorption specifically — the only nullable manufacturer rating; repulsion/control/durability/hitting_sound are NOT NULL at the database level, so they can never be "incomplete" here. */
  missingShockAbsorption: number
  /** Hybrid strings with neither a structured main- nor cross-string metadata object at all. */
  hybridMissingStructuredMeta: number
}

export interface RetailerHealthMetrics {
  activeRetailers: number
  inactiveRetailers: number
  totalListings: number
  preferredListings: number
  availableListings: number
  missingPrice: number
  missingProductUrl: number
  /** Phase 12 — listings with a known price but no package length, so they can never produce a price-per-metre comparison (see retailerPriceService.ts's pricePerMetre()). Distinct from missingPrice: a listing can be missing one, the other, or both. */
  missingPackageLength: number
  neverChecked: number
  stale: number
  inactiveRetailersWithListings: { retailerId: number; retailerName: string; listingCount: number }[]
  /** String ids with more than one listing marked "preferred" — reuses retailerPriceService.ts's own findPreferredConflicts() (via summarizeRetailerDiagnostics), computed here over the FULL admin listing set (including inactive retailers), unlike the public diagnostics page's active-retailer-only view. */
  preferredConflictStringIds: string[]
  duplicateCandidates: string[]
}

export type IssueSeverity = 'critical' | 'warning' | 'info'

export interface DataQualityIssue {
  id: string
  label: string
  count: number
  severity: IssueSeverity
  section: AdminSection
}

export interface RecentUpdateItem {
  id: string
  sourceType: DashboardSourceId
  sourceLabel: string
  title: string
  secondary?: string
  updatedAt: string
  section: AdminSection
}

export interface DashboardData {
  summary: DashboardSummary
  inventoryAttention: { items: InventoryAttentionItem[]; totalNeedingAttention: number }
  coverage: CoverageMetrics
  retailerHealth: RetailerHealthMetrics
  dataQuality: DataQualityIssue[]
  recentUpdates: RecentUpdateItem[]
}

export interface DashboardFetchResult {
  data: DashboardData
  errors: DashboardSourceError[]
  fetchedAt: string
}

const INVENTORY_ATTENTION_LIMIT = 10
const RECENT_UPDATES_LIMIT = 10

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function toRetailerListing(row: AdminRetailerListingRow): RetailerListing {
  return {
    id: row.id,
    stringId: row.stringId,
    retailerId: row.retailerId,
    retailerName: row.retailerName,
    retailerLogoUrl: row.retailerLogoUrl,
    retailerActive: row.retailerActive,
    productUrl: row.productUrl,
    price: row.price,
    currency: row.currency,
    availabilityStatus: row.availabilityStatus,
    packageType: row.packageType,
    packageLengthM: row.packageLengthM,
    isPreferred: row.isPreferred,
    notes: row.notes,
    lastCheckedAt: row.lastCheckedAt,
    updatedAt: row.updatedAt,
  }
}

function groupByStringId(listings: readonly AdminRetailerListingRow[]): Record<string, RetailerListing[]> {
  const byId: Record<string, RetailerListing[]> = {}
  for (const row of listings) {
    const mapped = toRetailerListing(row)
    ;(byId[row.stringId] ??= []).push(mapped)
  }
  return byId
}

export function buildSummary(
  catalog: readonly AdminCatalogRow[],
  inventory: readonly AdminInventoryRow[],
  specialists: readonly AdminSpecialistRow[],
  retailers: readonly AdminRetailerRow[],
  listings: readonly AdminRetailerListingRow[],
  now: Date,
): DashboardSummary {
  const withProfile = specialists.filter((s) => s.hasProfile).length
  return {
    catalog: { total: catalog.length },
    inventory: {
      total: inventory.length,
      inStock: inventory.filter((r) => r.stockStatus === 'in-stock').length,
      lowStock: inventory.filter((r) => r.stockStatus === 'low-stock').length,
      unavailable: inventory.filter((r) => r.stockStatus === 'unavailable').length,
      missingQuantity: inventory.filter((r) => r.quantity == null).length,
    },
    specialists: {
      totalCatalogStrings: specialists.length,
      withProfile,
      withoutProfile: specialists.length - withProfile,
      coveragePercent: percent(withProfile, specialists.length),
    },
    retailers: {
      total: retailers.length,
      active: retailers.filter((r) => r.active).length,
      inactive: retailers.filter((r) => !r.active).length,
    },
    retailerListings: {
      total: listings.length,
      available: listings.filter((l) => l.availabilityStatus === 'in_stock').length,
      missingPrice: listings.filter((l) => l.price == null).length,
      missingProductUrl: listings.filter((l) => l.productUrl == null).length,
      neverChecked: listings.filter((l) => l.lastCheckedAt == null).length,
      stale: listings.filter((l) => {
        const days = daysSince(l.lastCheckedAt, now)
        return days != null && days > STALE_LISTING_DAYS
      }).length,
    },
  }
}

export function attentionPriorityOf(row: AdminInventoryRow): AttentionPriority | null {
  if (row.stockStatus === 'unavailable') return 'unavailable'
  if (row.stockStatus === 'low-stock') return 'low-stock'
  if (row.quantity == null || row.packageType === 'unknown') return 'data-issue'
  return null
}

const ATTENTION_PRIORITY_RANK: Record<AttentionPriority, number> = { unavailable: 0, 'low-stock': 1, 'data-issue': 2 }

export function buildInventoryAttention(inventory: readonly AdminInventoryRow[]): { items: InventoryAttentionItem[]; totalNeedingAttention: number } {
  const flagged = inventory
    .map((row) => ({ row, priority: attentionPriorityOf(row) }))
    .filter((x): x is { row: AdminInventoryRow; priority: AttentionPriority } => x.priority != null)

  flagged.sort((a, b) => {
    const rankDiff = ATTENTION_PRIORITY_RANK[a.priority] - ATTENTION_PRIORITY_RANK[b.priority]
    if (rankDiff !== 0) return rankDiff
    return a.row.brand.localeCompare(b.row.brand) || a.row.name.localeCompare(b.row.name)
  })

  const items: InventoryAttentionItem[] = flagged.slice(0, INVENTORY_ATTENTION_LIMIT).map(({ row, priority }) => ({
    stringId: row.stringId,
    brand: row.brand,
    name: row.name,
    status: row.stockStatus,
    quantity: row.quantity,
    packageType: row.packageType,
    updatedAt: row.updatedAt,
    priority,
  }))

  return { items, totalNeedingAttention: flagged.length }
}

export function buildCoverage(catalog: readonly AdminCatalogRow[], specialists: readonly AdminSpecialistRow[]): CoverageMetrics {
  const withProfile = specialists.filter((s) => s.hasProfile).length
  return {
    specialistProfiles: {
      present: withProfile,
      missing: specialists.length - withProfile,
      total: specialists.length,
      percent: percent(withProfile, specialists.length),
    },
    missingDescription: catalog.filter((c) => !c.description || c.description.trim() === '').length,
    missingProductUrl: catalog.filter((c) => !c.productUrl).length,
    missingImageUrl: catalog.filter((c) => !c.imageUrl).length,
    missingShockAbsorption: catalog.filter((c) => c.shockAbsorption == null).length,
    hybridMissingStructuredMeta: catalog.filter((c) => c.isHybrid && !c.mainStringMeta && !c.crossStringMeta).length,
  }
}

export function buildRetailerHealth(retailers: readonly AdminRetailerRow[], listings: readonly AdminRetailerListingRow[], now: Date): RetailerHealthMetrics {
  const diagnostics = summarizeRetailerDiagnostics(groupByStringId(listings), [])

  const listingCountByRetailer = new Map<number, number>()
  for (const l of listings) listingCountByRetailer.set(l.retailerId, (listingCountByRetailer.get(l.retailerId) ?? 0) + 1)

  const inactiveRetailersWithListings = retailers
    .filter((r) => !r.active && (listingCountByRetailer.get(r.id) ?? 0) > 0)
    .map((r) => ({ retailerId: r.id, retailerName: r.name, listingCount: listingCountByRetailer.get(r.id) ?? 0 }))
    .sort((a, b) => a.retailerName.localeCompare(b.retailerName))

  return {
    activeRetailers: retailers.filter((r) => r.active).length,
    inactiveRetailers: retailers.filter((r) => !r.active).length,
    totalListings: diagnostics.totalListings,
    preferredListings: listings.filter((l) => l.isPreferred).length,
    availableListings: listings.filter((l) => l.availabilityStatus === 'in_stock').length,
    missingPrice: listings.filter((l) => l.price == null).length,
    missingProductUrl: listings.filter((l) => l.productUrl == null).length,
    missingPackageLength: listings.filter((l) => l.price != null && l.packageLengthM == null).length,
    neverChecked: diagnostics.missingLastCheckedCount,
    stale: listings.filter((l) => {
      const days = daysSince(l.lastCheckedAt, now)
      return days != null && days > STALE_LISTING_DAYS
    }).length,
    inactiveRetailersWithListings,
    preferredConflictStringIds: diagnostics.preferredConflictStringIds,
    duplicateCandidates: diagnostics.duplicateCandidates,
  }
}

export function buildDataQuality(
  catalog: readonly AdminCatalogRow[],
  inventory: readonly AdminInventoryRow[],
  coverage: CoverageMetrics,
  retailerHealth: RetailerHealthMetrics,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = []

  const inventoryIds = new Set(inventory.map((r) => r.stringId))
  const missingInventoryRow = catalog.filter((c) => !inventoryIds.has(c.id)).length
  if (missingInventoryRow > 0) {
    issues.push({ id: 'missing-inventory-row', label: 'Catalog strings with no inventory row', count: missingInventoryRow, severity: 'critical', section: 'catalog' })
  }

  const missingQuantity = inventory.filter((r) => r.quantity == null).length
  if (missingQuantity > 0) issues.push({ id: 'missing-quantity', label: 'Inventory rows missing a quantity', count: missingQuantity, severity: 'warning', section: 'inventory' })

  const unknownPackageType = inventory.filter((r) => r.packageType === 'unknown').length
  if (unknownPackageType > 0) issues.push({ id: 'unknown-package-type', label: 'Inventory rows with an unknown package type', count: unknownPackageType, severity: 'warning', section: 'inventory' })

  if (coverage.specialistProfiles.missing > 0) {
    issues.push({ id: 'missing-specialist-profile', label: 'Strings without a specialist profile', count: coverage.specialistProfiles.missing, severity: 'info', section: 'specialists' })
  }
  if (coverage.missingDescription > 0) issues.push({ id: 'missing-description', label: 'Strings missing a description', count: coverage.missingDescription, severity: 'info', section: 'catalog' })
  if (coverage.missingShockAbsorption > 0) {
    issues.push({ id: 'missing-shock-absorption', label: 'Strings missing a shock absorption rating', count: coverage.missingShockAbsorption, severity: 'info', section: 'catalog' })
  }
  if (coverage.hybridMissingStructuredMeta > 0) {
    issues.push({ id: 'hybrid-missing-meta', label: 'Hybrid strings with no structured main/cross metadata', count: coverage.hybridMissingStructuredMeta, severity: 'info', section: 'catalog' })
  }

  if (retailerHealth.missingPrice > 0) issues.push({ id: 'listing-missing-price', label: 'Retailer listings missing a price', count: retailerHealth.missingPrice, severity: 'warning', section: 'retailerListings' })
  if (retailerHealth.missingProductUrl > 0) {
    issues.push({ id: 'listing-missing-url', label: 'Retailer listings missing a product URL', count: retailerHealth.missingProductUrl, severity: 'warning', section: 'retailerListings' })
  }
  if (retailerHealth.missingPackageLength > 0) {
    issues.push({
      id: 'listing-missing-package-length',
      label: 'Priced listings missing a package length (no price-per-metre comparison)',
      count: retailerHealth.missingPackageLength,
      severity: 'info',
      section: 'retailerListings',
    })
  }
  if (retailerHealth.stale > 0) {
    issues.push({ id: 'listing-stale', label: `Retailer listings not checked in over ${STALE_LISTING_DAYS} days`, count: retailerHealth.stale, severity: 'warning', section: 'retailerListings' })
  }
  if (retailerHealth.inactiveRetailersWithListings.length > 0) {
    const count = retailerHealth.inactiveRetailersWithListings.reduce((sum, r) => sum + r.listingCount, 0)
    issues.push({ id: 'inactive-retailer-listings', label: 'Listings tied to an inactive retailer', count, severity: 'warning', section: 'retailers' })
  }
  if (retailerHealth.preferredConflictStringIds.length > 0) {
    issues.push({
      id: 'preferred-conflicts',
      label: 'Strings with more than one preferred listing',
      count: retailerHealth.preferredConflictStringIds.length,
      severity: 'warning',
      section: 'retailerListings',
    })
  }

  return issues
}

export function buildRecentUpdates(
  catalog: readonly AdminCatalogRow[],
  inventory: readonly AdminInventoryRow[],
  specialists: readonly AdminSpecialistRow[],
  retailers: readonly AdminRetailerRow[],
  listings: readonly AdminRetailerListingRow[],
): RecentUpdateItem[] {
  const items: RecentUpdateItem[] = []

  for (const c of catalog) {
    items.push({ id: `catalog-${c.id}`, sourceType: 'catalog', sourceLabel: 'Catalog', title: `${c.brand} ${c.name}`, updatedAt: c.updatedAt, section: 'catalog' })
  }
  for (const i of inventory) {
    items.push({
      id: `inventory-${i.stringId}`,
      sourceType: 'inventory',
      sourceLabel: 'Inventory',
      title: `${i.brand} ${i.name}`,
      secondary: i.stockStatus,
      updatedAt: i.updatedAt,
      section: 'inventory',
    })
  }
  for (const s of specialists) {
    if (!s.hasProfile || !s.updatedAt) continue // "not yet profiled" is not an update
    items.push({
      id: `specialist-${s.stringId}`,
      sourceType: 'specialists',
      sourceLabel: 'Specialist profile',
      title: `${s.brand} ${s.name}`,
      updatedAt: s.updatedAt,
      section: 'specialists',
    })
  }
  for (const r of retailers) {
    items.push({ id: `retailer-${r.id}`, sourceType: 'retailers', sourceLabel: 'Retailer', title: r.name, updatedAt: r.updatedAt, section: 'retailers' })
  }
  for (const l of listings) {
    items.push({
      id: `listing-${l.id}`,
      sourceType: 'retailerListings',
      sourceLabel: 'Retailer listing',
      title: `${l.brand} ${l.name}`,
      secondary: `at ${l.retailerName}`,
      updatedAt: l.updatedAt,
      section: 'retailerListings',
    })
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return items.slice(0, RECENT_UPDATES_LIMIT)
}

/** Fetches all five admin sources in parallel and derives every dashboard panel from them — one fetch cycle, zero additional queries. A source that fails to load contributes an empty array to every downstream computation (never blocks the others) and is reported in `errors`. */
export async function fetchDashboardData(now: Date = new Date()): Promise<DashboardFetchResult> {
  const [catalogResult, inventoryResult, specialistResult, retailerResult, listingResult] = await Promise.all([
    fetchAdminCatalog(),
    fetchAdminInventory(),
    fetchAdminSpecialistList(),
    fetchAdminRetailers(),
    fetchAdminRetailerListings(),
  ])

  const errors: DashboardSourceError[] = []
  const catalog = catalogResult.ok ? catalogResult.data : []
  const inventory = inventoryResult.ok ? inventoryResult.data : []
  const specialists = specialistResult.ok ? specialistResult.data : []
  const retailers = retailerResult.ok ? retailerResult.data : []
  const listings = listingResult.ok ? listingResult.data.rows : []

  if (!catalogResult.ok) errors.push({ source: 'catalog', message: catalogResult.error })
  if (!inventoryResult.ok) errors.push({ source: 'inventory', message: inventoryResult.error })
  if (!specialistResult.ok) errors.push({ source: 'specialists', message: specialistResult.error })
  if (!retailerResult.ok) errors.push({ source: 'retailers', message: retailerResult.error })
  if (!listingResult.ok) errors.push({ source: 'retailerListings', message: listingResult.error })

  const coverage = buildCoverage(catalog, specialists)
  const retailerHealth = buildRetailerHealth(retailers, listings, now)

  return {
    data: {
      summary: buildSummary(catalog, inventory, specialists, retailers, listings, now),
      inventoryAttention: buildInventoryAttention(inventory),
      coverage,
      retailerHealth,
      dataQuality: buildDataQuality(catalog, inventory, coverage, retailerHealth),
      recentUpdates: buildRecentUpdates(catalog, inventory, specialists, retailers, listings),
    },
    errors,
    fetchedAt: now.toISOString(),
  }
}
