// Admin-only inventory CRUD. This is the ONLY place admin UI components
// query or mutate Supabase — they never call getSupabaseClient() directly.
//
// Every call here runs through the caller's normal authenticated Supabase
// session (the same shared client from lib/supabase.ts — signing in
// mutates that client's session, it isn't a separate "admin client").
// There is no service-role key anywhere in this file or anywhere under
// src/: RLS is the only thing that decides whether a write actually
// succeeds. A non-admin (or unauthenticated) caller gets a rejected
// write surfaced as a normal error result here, never a crash and never
// a client-side check standing in for the real database-level rule.

import { getSupabaseClient } from '../lib/supabase'
import type { StockLevel } from '../data/strings'
import type { PackageType } from './inventoryService'

export type { PackageType }

export const STOCK_STATUS_OPTIONS: StockLevel[] = ['in-stock', 'low-stock', 'unavailable']
export const PACKAGE_TYPE_OPTIONS: PackageType[] = ['reel', 'set', 'mixed', 'unknown']

export interface AdminInventoryRow {
  stringId: string
  brand: string
  name: string
  stockStatus: StockLevel
  quantity: number | null
  packageType: PackageType
  color: string | null
  notes: string | null
  updatedAt: string
}

export interface InventoryUpdateInput {
  stockStatus: StockLevel
  quantity: number | null
  packageType: PackageType
  color: string | null
  notes: string | null
}

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Fetches every inventory row joined with just enough catalog context
 * (brand/name) to identify each string in the admin UI. This does NOT
 * make the public site read catalog data from Supabase — it's a
 * one-query convenience for this admin page only, using the same
 * strings/inventory tables Phase 1/2 already created.
 */
export async function fetchAdminInventory(): Promise<AdminResult<AdminInventoryRow[]>> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('inventory')
      .select('string_id, stock_status, quantity, package_type, color, notes, updated_at, strings(brand, name)')

    if (error) return { ok: false, error: error.message }

    const rows: AdminInventoryRow[] = (data ?? []).map((row) => ({
      stringId: row.string_id,
      brand: row.strings?.brand ?? '(unknown brand)',
      name: row.strings?.name ?? row.string_id,
      stockStatus: row.stock_status,
      quantity: row.quantity,
      packageType: row.package_type,
      color: row.color,
      notes: row.notes,
      updatedAt: row.updated_at,
    }))

    rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
    return { ok: true, data: rows }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Updates one inventory row. A rejected write (non-admin, expired session, bad constraint) surfaces as { ok: false }, never a thrown error. */
export async function updateInventoryRow(stringId: string, patch: InventoryUpdateInput): Promise<AdminResult<void>> {
  try {
    const { error } = await getSupabaseClient()
      .from('inventory')
      .update({
        stock_status: patch.stockStatus,
        quantity: patch.quantity,
        package_type: patch.packageType,
        color: patch.color,
        notes: patch.notes,
      })
      .eq('string_id', stringId)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Empty -> null. Rejects non-numeric, decimal, or negative input — matches the database's own CHECK constraint (quantity IS NULL OR quantity >= 0) plus the "whole number" expectation from a reel/set count. */
export function parseQuantityInput(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return { ok: false, error: 'Quantity must be a number.' }
  if (!Number.isInteger(num)) return { ok: false, error: 'Quantity must be a whole number — no decimals.' }
  if (num < 0) return { ok: false, error: 'Quantity cannot be negative.' }
  return { ok: true, value: num }
}

/** Trims free text and converts an empty result to null, so "optional text" fields store null rather than an empty string. */
export function normalizeOptionalText(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}
