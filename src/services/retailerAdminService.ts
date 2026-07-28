// Phase 7: admin-only retailer ENTITY CRUD (name, logo, website, country,
// active). This is the ONLY place the Retailers admin UI touches
// Supabase for retailer entities — components never call
// getSupabaseClient() directly. Every call runs through the caller's
// normal authenticated Supabase session; there is no service-role key
// anywhere in this file. RLS is the only thing that decides whether a
// write actually succeeds.
//
// Retailer LISTING admin (create/edit/delete a string's retailer_prices
// row) lives in retailerListingAdminService.ts, kept deliberately
// separate — a listing always selects an EXISTING retailer by id, it
// never creates one implicitly.
//
// Deletion policy: prefer deactivation. A retailer with at least one
// listing cannot be deleted — the database's own FK (retailer_prices.
// retailer_id references retailers(id), default NO ACTION/RESTRICT
// behavior) is the real enforcement; this service checks first so the
// admin sees a friendly, specific message instead of a raw Postgres
// foreign-key-violation error.

import { getSupabaseClient } from '../lib/supabase.js'
import type { Database } from '../types/database.js'
import { SAFE_URL_PATTERN } from './catalogService.js'

type RetailerRow = Database['public']['Tables']['retailers']['Row']
type RetailerInsert = Database['public']['Tables']['retailers']['Insert']
type RetailerUpdate = Database['public']['Tables']['retailers']['Update']

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** One retailer entity in the admin list, with its listing count attached (needed both for display and for the "can this be deleted?" check). */
export interface AdminRetailerRow {
  id: number
  name: string
  logoUrl: string | null
  websiteUrl: string | null
  country: string | null
  active: boolean
  listingCount: number
  updatedAt: string
}

function fromRow(row: RetailerRow, listingCount: number): AdminRetailerRow {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    country: row.country,
    active: row.active,
    listingCount,
    updatedAt: row.updated_at,
  }
}

/** Every retailer entity, with a per-retailer listing count (one extra query selecting only retailer_id, counted client-side — simpler and just as correct as a SQL GROUP BY for this admin-only, low-row-count list). */
export async function fetchAdminRetailers(): Promise<AdminResult<AdminRetailerRow[]>> {
  try {
    const client = getSupabaseClient()
    const [retailersResult, listingsResult] = await Promise.all([client.from('retailers').select('*'), client.from('retailer_prices').select('retailer_id')])

    if (retailersResult.error) return { ok: false, error: retailersResult.error.message }
    if (listingsResult.error) return { ok: false, error: listingsResult.error.message }

    const countByRetailerId = new Map<number, number>()
    for (const { retailer_id } of listingsResult.data ?? []) {
      countByRetailerId.set(retailer_id, (countByRetailerId.get(retailer_id) ?? 0) + 1)
    }

    const rows = (retailersResult.data ?? [])
      .map((r) => fromRow(r, countByRetailerId.get(r.id) ?? 0))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { ok: true, data: rows }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Form input + validation
// ---------------------------------------------------------------------------

export interface RetailerFormInput {
  name: string
  logoUrl: string
  websiteUrl: string
  country: string
  active: boolean
}

export function emptyRetailerFormInput(): RetailerFormInput {
  return { name: '', logoUrl: '', websiteUrl: '', country: '', active: true }
}

export function retailerFormInputFromRow(row: AdminRetailerRow): RetailerFormInput {
  return {
    name: row.name,
    logoUrl: row.logoUrl ?? '',
    websiteUrl: row.websiteUrl ?? '',
    country: row.country ?? '',
    active: row.active,
  }
}

export interface RetailerFormErrors {
  name?: string
  logoUrl?: string
  websiteUrl?: string
  country?: string
}

export interface RetailerValidationContext {
  /** Every OTHER existing retailer (the one being edited, if any, excluded) — used for the case-insensitive duplicate-name check. */
  otherRetailers: AdminRetailerRow[]
}

export type ValidatedRetailerPayload = { insert?: RetailerInsert; update: RetailerUpdate }
export type RetailerValidationResult = { ok: true; payload: ValidatedRetailerPayload } | { ok: false; errors: RetailerFormErrors }

function parseNullableUrl(raw: string, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!SAFE_URL_PATTERN.test(trimmed)) return { ok: false, error: `${label} must be a valid http(s) URL.` }
  return { ok: true, value: trimmed }
}

const COUNTRY_PATTERN = /^[A-Z]{2}$/

function parseCountry(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim().toUpperCase()
  if (trimmed === '') return { ok: true, value: null }
  if (!COUNTRY_PATTERN.test(trimmed)) return { ok: false, error: 'Country must be a 2-letter code (e.g. "DE", "IE").' }
  return { ok: true, value: trimmed }
}

/** Extracts `.value` from a parse result already known to be `ok: true`. */
function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error('unreachable: value() called after a failed parse result')
  return result.value
}

export function validateRetailerInput(input: RetailerFormInput, context: RetailerValidationContext, editingId?: number): RetailerValidationResult {
  const errors: RetailerFormErrors = {}

  const name = input.name.trim()
  if (name === '') errors.name = 'Name is required.'

  const logoResult = parseNullableUrl(input.logoUrl, 'Logo URL')
  if (!logoResult.ok) errors.logoUrl = logoResult.error

  const websiteResult = parseNullableUrl(input.websiteUrl, 'Website URL')
  if (!websiteResult.ok) errors.websiteUrl = websiteResult.error

  const countryResult = parseCountry(input.country)
  if (!countryResult.ok) errors.country = countryResult.error

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const others = context.otherRetailers.filter((r) => r.id !== editingId)
  const isDuplicate = others.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())
  if (isDuplicate) {
    return { ok: false, errors: { name: 'A retailer with this name already exists.' } }
  }

  const shared: RetailerUpdate = {
    name,
    logo_url: value(logoResult),
    website_url: value(websiteResult),
    country: value(countryResult),
    active: input.active,
  }

  return { ok: true, payload: { insert: { ...shared, name } as RetailerInsert, update: shared } }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createRetailer(insert: RetailerInsert): Promise<AdminResult<AdminRetailerRow>> {
  try {
    const { data, error } = await getSupabaseClient().from('retailers').insert(insert).select('*').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: fromRow(data, 0) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Also used for deactivate/reactivate — both are just `active` toggling through the same update path. */
export async function updateRetailer(id: number, update: RetailerUpdate, listingCount: number): Promise<AdminResult<AdminRetailerRow>> {
  try {
    const { data, error } = await getSupabaseClient().from('retailers').update(update).eq('id', id).select('*').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: fromRow(data, listingCount) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Deletes a retailer — but only when it's actually safe: a retailer with
 * one or more listings is never deleted here (checked BEFORE attempting
 * the delete, so the error is specific and friendly rather than a raw FK
 * violation from Postgres). The UI should steer towards deactivation
 * instead for a retailer already in use.
 */
export async function deleteRetailer(id: number, listingCount: number): Promise<AdminResult<void>> {
  if (listingCount > 0) {
    return {
      ok: false,
      error: `This retailer has ${listingCount} listing${listingCount === 1 ? '' : 's'} — delete or reassign ${listingCount === 1 ? 'it' : 'them'} first, or deactivate this retailer instead of deleting it.`,
    }
  }
  try {
    const { error } = await getSupabaseClient().from('retailers').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
