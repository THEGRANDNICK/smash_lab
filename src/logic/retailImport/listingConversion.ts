// Phase 13A — Part 10: the listing-conversion boundary.
//
// FUTURE INTEGRATION BOUNDARY. This function is where a later phase (13C,
// once a real review/approval UI exists) would hand an admin-approved
// ImportCandidateDraft to the EXISTING
// retailerListingAdminService.ts's validateRetailerListingInput() +
// createRetailerListing() — the exact same functions the manual "+ New
// listing" admin form already uses today. This module only builds that
// function's input SHAPE; it never imports or calls either of those
// functions itself, never touches Supabase, and is not wired into any UI
// in this phase. There is no approval flow here — see Part 13.
//
// Reuses the EXISTING RetailerListingFormInput type (not a second,
// drifting copy of the same field list) precisely so a later phase's
// conversion is guaranteed to produce something validateRetailerListingInput()
// already knows how to check — including its natural-key duplicate rule.

import type { RetailerListingFormInput } from '../../services/retailerListingAdminService.js'
import type { ImportCandidateDraft } from './types.js'

export interface ListingConversionInput {
  draft: ImportCandidateDraft
  /** The human-confirmed catalog string id this candidate should become a listing for. The draft's own `suggestedCatalogItem` is only ever a suggestion — nothing in this phase applies it automatically (see Part 12/13: no automatic listing creation). */
  stringId: string
  /** The retailer id (as a string, matching RetailerListingFormInput's select-value shape) this candidate's price was found at. */
  retailerId: string
}

export type ListingConversionResult = { ok: true; formInput: RetailerListingFormInput } | { ok: false; error: string }

/**
 * Converts one candidate draft into the existing listing form's input
 * shape. Fails clearly (returns `{ ok: false }`, never throws or invents a
 * value) when data the existing listing form genuinely requires is
 * missing: a chosen string id, a chosen retailer id, or a detected price.
 * Package type/length are passed through even when absent — the existing
 * form already treats those as optional.
 */
export function convertCandidateDraftToListingFormInput(input: ListingConversionInput): ListingConversionResult {
  const { draft, stringId, retailerId } = input

  if (stringId.trim() === '') return { ok: false, error: 'A catalog string id is required before this candidate can become a listing.' }
  if (retailerId.trim() === '') return { ok: false, error: 'A retailer id is required before this candidate can become a listing.' }
  if (draft.price == null) return { ok: false, error: 'This candidate has no detected price — one must be entered manually before it can become a listing.' }

  const packageType = draft.package.packageType === 'unknown' ? 'other' : draft.package.packageType

  const formInput: RetailerListingFormInput = {
    stringId,
    retailerId,
    productUrl: draft.url ?? '',
    price: String(draft.price),
    currency: draft.currency ?? 'EUR',
    availabilityStatus: 'unknown',
    packageType,
    packageLengthM: draft.package.packageLengthM != null ? String(draft.package.packageLengthM) : '',
    isPreferred: false,
    notes: `Imported from "${draft.source}" (confidence: ${draft.confidence.label}).`,
    lastCheckedAt: '',
  }

  return { ok: true, formInput }
}
