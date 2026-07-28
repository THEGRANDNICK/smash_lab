// Phase 7: admin-only retailer-LISTING CRUD (one row per retailer selling
// one string in one package). This is the ONLY place the Retailer
// Listings admin UI touches Supabase — components never call
// getSupabaseClient() directly. Every call runs through the caller's
// normal authenticated Supabase session (same shared client as
// adminInventoryService.ts / catalogAdminService.ts / specialistAdminService.ts);
// there is no service-role key anywhere in this file. RLS is the only
// thing that decides whether a write actually succeeds.
//
// Retailer ENTITY admin (create/edit/deactivate/delete a retailer) lives
// in retailerAdminService.ts, kept deliberately separate — this file only
// ever selects an existing retailer by id, never creates one implicitly.
//
// Validation reuses retailerPriceService.ts's constants/rules (RETAILER_*
// arrays, price/URL helpers from catalogService.ts) so an admin can never
// save something the public read path would then reject.
//
// The list is built from every catalog string and every retailer
// LEFT-JOINed (client-side, via three plain queries merged in memory —
// same pattern as specialistAdminService.ts) onto each listing — a string
// can have zero, one, or many listings, unlike the 1:1 specialist_profiles
// relationship, and a retailer can appear on many listings across many
// strings.

import { getSupabaseClient } from '../lib/supabase.js'
import type { Database, RetailerAvailabilityStatus, RetailerCurrency, RetailerPackageType } from '../types/database.js'
import { isFiniteNumber, hasDecimalPrecision } from './catalogService.js'
import { parseNullableUrl, value } from './catalogAdminService.js'
import { RETAILER_CURRENCIES, RETAILER_AVAILABILITY_STATUSES, RETAILER_PACKAGE_TYPES } from './retailerPriceService.js'

type RetailerListingRow = Database['public']['Tables']['retailer_prices']['Row']
type RetailerListingInsert = Database['public']['Tables']['retailer_prices']['Insert']
type RetailerListingUpdate = Database['public']['Tables']['retailer_prices']['Update']

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const CURRENCY_OPTIONS: RetailerCurrency[] = [...RETAILER_CURRENCIES]
export const AVAILABILITY_OPTIONS: RetailerAvailabilityStatus[] = [...RETAILER_AVAILABILITY_STATUSES]
export const PACKAGE_TYPE_OPTIONS: RetailerPackageType[] = [...RETAILER_PACKAGE_TYPES]

/** A retailer entity as seen from the listing picker — just enough to render and validate the select, not the full admin retailer-entity shape. */
export interface RetailerOption {
  id: number
  name: string
  active: boolean
}

/** One retailer listing row in the admin list, with catalog + retailer identity attached for display/search. */
export interface AdminRetailerListingRow {
  id: number
  stringId: string
  brand: string
  name: string
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

function fromRow(
  row: RetailerListingRow,
  catalogRow: { brand: string; name: string },
  retailer: { name: string; logo_url: string | null; active: boolean },
): AdminRetailerListingRow {
  return {
    id: row.id,
    stringId: row.string_id,
    brand: catalogRow.brand,
    name: catalogRow.name,
    retailerId: row.retailer_id,
    retailerName: retailer.name,
    retailerLogoUrl: retailer.logo_url,
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
}

/** Every catalog string (for the form's string picker) and every retailer (for the form's retailer picker — including inactive ones, so an existing listing's assigned retailer never disappears from view) alongside every retailer listing (joined client-side). A listing whose string_id or retailer_id has no matching row is skipped defensively — the database's own foreign keys mean this should never happen in practice. */
export async function fetchAdminRetailerListings(): Promise<
  AdminResult<{ rows: AdminRetailerListingRow[]; catalog: { id: string; brand: string; name: string }[]; retailers: RetailerOption[] }>
> {
  try {
    const client = getSupabaseClient()
    const [catalogResult, listingResult, retailerResult] = await Promise.all([
      client.from('strings').select('id, brand, name'),
      client.from('retailer_prices').select('*'),
      client.from('retailers').select('*'),
    ])

    if (catalogResult.error) return { ok: false, error: catalogResult.error.message }
    if (listingResult.error) return { ok: false, error: listingResult.error.message }
    if (retailerResult.error) return { ok: false, error: retailerResult.error.message }

    const catalog = catalogResult.data ?? []
    const catalogById = new Map(catalog.map((c) => [c.id, c]))
    const retailerRows = retailerResult.data ?? []
    const retailersById = new Map(retailerRows.map((r) => [r.id, r]))
    const retailers: RetailerOption[] = retailerRows
      .map((r) => ({ id: r.id, name: r.name, active: r.active }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const rows: AdminRetailerListingRow[] = []
    for (const listingRow of listingResult.data ?? []) {
      const catalogRow = catalogById.get(listingRow.string_id)
      const retailerRow = retailersById.get(listingRow.retailer_id)
      if (!catalogRow || !retailerRow) continue
      rows.push(fromRow(listingRow, catalogRow, retailerRow))
    }
    rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name) || a.retailerName.localeCompare(b.retailerName))

    return { ok: true, data: { rows, catalog, retailers } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Form input + validation
// ---------------------------------------------------------------------------

export interface RetailerListingFormInput {
  stringId: string
  /** The retailer's id as a string (select value), or '' if none chosen. */
  retailerId: string
  productUrl: string
  price: string
  currency: string
  availabilityStatus: string
  packageType: string
  packageLengthM: string
  isPreferred: boolean
  notes: string
  /** yyyy-mm-dd, or blank for "not recorded". */
  lastCheckedAt: string
}

export function emptyRetailerListingFormInput(stringId = ''): RetailerListingFormInput {
  return {
    stringId,
    retailerId: '',
    productUrl: '',
    price: '',
    currency: 'EUR',
    availabilityStatus: 'unknown',
    packageType: 'set',
    packageLengthM: '',
    isPreferred: false,
    notes: '',
    lastCheckedAt: '',
  }
}

export function retailerListingFormInputFromRow(row: AdminRetailerListingRow): RetailerListingFormInput {
  return {
    stringId: row.stringId,
    retailerId: String(row.retailerId),
    productUrl: row.productUrl ?? '',
    price: row.price != null ? String(row.price) : '',
    currency: row.currency,
    availabilityStatus: row.availabilityStatus,
    packageType: row.packageType,
    packageLengthM: row.packageLengthM != null ? String(row.packageLengthM) : '',
    isPreferred: row.isPreferred,
    notes: row.notes ?? '',
    lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.slice(0, 10) : '',
  }
}

export interface RetailerListingFormErrors {
  stringId?: string
  retailerId?: string
  productUrl?: string
  price?: string
  currency?: string
  availabilityStatus?: string
  packageType?: string
  packageLengthM?: string
  lastCheckedAt?: string
}

export interface RetailerListingValidationContext {
  /** Every real catalog string id — a listing must point at one of these. */
  validStringIds: ReadonlySet<string>
  /** Every retailer known to the admin (active or not) — a listing must point at one of these. */
  retailers: RetailerOption[]
  /** Every OTHER existing listing (the one being edited, if any, excluded) — used for duplicate and preferred-conflict checks. */
  otherRows: AdminRetailerListingRow[]
  /** When editing, the listing's retailer_id BEFORE this edit — lets an already-inactive-retailer listing be saved unchanged without re-selecting a different (active) retailer. */
  originalRetailerId?: number
}

export interface ValidatedRetailerListingPayload {
  insert?: RetailerListingInsert
  update: RetailerListingUpdate
}

export type RetailerListingValidationResult =
  | { ok: true; payload: ValidatedRetailerListingPayload; warnings: string[] }
  | { ok: false; errors: RetailerListingFormErrors }

function parseNonNegativePrice(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(trimmed)
  if (!isFiniteNumber(num)) return { ok: false, error: 'Price must be a number.' }
  if (num < 0) return { ok: false, error: 'Price cannot be negative.' }
  if (!hasDecimalPrecision(num, 2)) return { ok: false, error: 'Price allows at most 2 decimal places (e.g. 12.99).' }
  return { ok: true, value: num }
}

function parsePositiveLength(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(trimmed)
  if (!isFiniteNumber(num)) return { ok: false, error: 'Package length must be a number.' }
  if (num <= 0) return { ok: false, error: 'Package length must be greater than 0.' }
  return { ok: true, value: num }
}

function parseLastCheckedAt(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return { ok: false, error: 'Last-checked date is not valid.' }
  return { ok: true, value: date.toISOString() }
}

/** The natural-key duplicate rule this feature enforces (mirrors the database's own unique index, so a mistake is caught with a friendly message instead of a raw constraint-violation error): the same string + retailer + package type + package length is one listing. Package type and length are compared exactly, since those genuinely distinguish separate listings (a set vs. a reel, or two different reel lengths, from the same retailer are legitimate, distinct rows). */
function duplicateKey(stringId: string, retailerId: number, packageType: string, packageLengthM: number | null): string {
  return `${stringId}|${retailerId}|${packageType}|${packageLengthM ?? 'null'}`
}

export function validateRetailerListingInput(
  input: RetailerListingFormInput,
  context: RetailerListingValidationContext,
  editingId?: number,
): RetailerListingValidationResult {
  const errors: RetailerListingFormErrors = {}

  const stringId = input.stringId.trim()
  if (stringId === '') errors.stringId = 'Choose a string.'
  else if (!context.validStringIds.has(stringId)) errors.stringId = 'That string id no longer exists in the catalog.'

  const retailerIdTrimmed = input.retailerId.trim()
  const retailerId = retailerIdTrimmed === '' ? null : Number(retailerIdTrimmed)
  const retailer = retailerId != null ? context.retailers.find((r) => r.id === retailerId) : undefined
  if (retailerIdTrimmed === '' || retailerId == null || !Number.isFinite(retailerId)) {
    errors.retailerId = 'Choose a retailer.'
  } else if (!retailer) {
    errors.retailerId = 'That retailer no longer exists.'
  } else if (!retailer.active && retailerId !== context.originalRetailerId) {
    errors.retailerId = 'That retailer is inactive — reactivate it first, or choose a different retailer.'
  }

  if (!CURRENCY_OPTIONS.includes(input.currency as RetailerCurrency)) errors.currency = 'Choose a valid currency.'
  if (!AVAILABILITY_OPTIONS.includes(input.availabilityStatus as RetailerAvailabilityStatus)) errors.availabilityStatus = 'Choose a valid availability.'
  if (!PACKAGE_TYPE_OPTIONS.includes(input.packageType as RetailerPackageType)) errors.packageType = 'Choose a valid package type.'

  const urlResult = parseNullableUrl(input.productUrl, 'Product URL')
  if (!urlResult.ok) errors.productUrl = urlResult.error

  const priceResult = parseNonNegativePrice(input.price)
  if (!priceResult.ok) errors.price = priceResult.error

  const lengthResult = parsePositiveLength(input.packageLengthM)
  if (!lengthResult.ok) errors.packageLengthM = lengthResult.error

  const lastCheckedResult = parseLastCheckedAt(input.lastCheckedAt)
  if (!lastCheckedResult.ok) errors.lastCheckedAt = lastCheckedResult.error

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const packageLengthM = value(lengthResult)
  const resolvedRetailerId = retailerId as number

  // Duplicate check only makes sense once the fields it's keyed on are themselves valid.
  const others = context.otherRows.filter((r) => r.id !== editingId)
  const candidateKey = duplicateKey(stringId, resolvedRetailerId, input.packageType, packageLengthM)
  const isDuplicate = others.some((r) => duplicateKey(r.stringId, r.retailerId, r.packageType, r.packageLengthM) === candidateKey)
  if (isDuplicate) {
    return {
      ok: false,
      errors: { retailerId: 'This retailer already has a listing for this string with the same package type and length.' },
    }
  }

  const warnings: string[] = []
  if (input.isPreferred) {
    const otherPreferred = others.some((r) => r.stringId === stringId && r.isPreferred)
    if (otherPreferred) warnings.push('Another listing for this string is already marked preferred — saving this one as preferred too will create a conflict shown on the debug page.')
  }

  const shared: RetailerListingUpdate = {
    string_id: stringId,
    retailer_id: resolvedRetailerId,
    product_url: value(urlResult),
    price: value(priceResult),
    currency: input.currency as RetailerCurrency,
    availability_status: input.availabilityStatus as RetailerAvailabilityStatus,
    package_type: input.packageType as RetailerPackageType,
    package_length_m: packageLengthM,
    is_preferred: input.isPreferred,
    notes: input.notes.trim() === '' ? null : input.notes.trim(),
    last_checked_at: value(lastCheckedResult),
  }

  return {
    ok: true,
    payload: { insert: { ...shared, string_id: stringId, retailer_id: resolvedRetailerId } as RetailerListingInsert, update: shared },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function loadJoinedRow(client: ReturnType<typeof getSupabaseClient>, row: RetailerListingRow): Promise<AdminResult<AdminRetailerListingRow>> {
  const [catalogResult, retailerResult] = await Promise.all([
    client.from('strings').select('brand, name').eq('id', row.string_id).single(),
    client.from('retailers').select('*').eq('id', row.retailer_id).single(),
  ])
  if (catalogResult.error || !catalogResult.data) return { ok: false, error: catalogResult.error?.message ?? 'string not found after write' }
  if (retailerResult.error || !retailerResult.data) return { ok: false, error: retailerResult.error?.message ?? 'retailer not found after write' }
  return { ok: true, data: fromRow(row, catalogResult.data, retailerResult.data) }
}

export async function createRetailerListing(insert: RetailerListingInsert): Promise<AdminResult<AdminRetailerListingRow>> {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client.from('retailer_prices').insert(insert).select('*').single()
    if (error) return { ok: false, error: error.message }
    return await loadJoinedRow(client, data)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateRetailerListing(id: number, update: RetailerListingUpdate): Promise<AdminResult<AdminRetailerListingRow>> {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client.from('retailer_prices').update(update).eq('id', id).select('*').single()
    if (error) return { ok: false, error: error.message }
    return await loadJoinedRow(client, data)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Deletes only this one listing — never the string, its inventory row, its specialist profile, or the retailer entity (there is no cascade wired from retailer_prices to any of those). */
export async function deleteRetailerListing(id: number): Promise<AdminResult<void>> {
  try {
    const { error } = await getSupabaseClient().from('retailer_prices').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
