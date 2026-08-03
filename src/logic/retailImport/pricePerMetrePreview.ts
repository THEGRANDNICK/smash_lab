// Phase 13A — Part 11: price-per-metre reuse. This file does NOT
// implement a price-per-metre formula — it reuses the EXISTING
// describeBestPricePerMetre() from retailerPriceService.ts (Phase 12's
// one shared "which price-per-metre represents this string" rule) by
// building one throwaway, in-memory RetailerListing from a candidate
// draft. Nothing here is persisted, and nothing here is a second
// implementation of the price/length division.

import { describeBestPricePerMetre, type PricePerMetreSummary, type RetailerListing } from '../../services/retailerPriceService.js'
import type { ImportCandidateDraft } from './types.js'

/**
 * Builds a synthetic single-listing preview of a candidate draft's
 * price-per-metre, purely so the existing describeBestPricePerMetre() can
 * be called on it. Returns null exactly when that function would — most
 * commonly because the draft has no detected price or no detected package
 * length yet (see Part 4: a length is never invented).
 */
export function previewPricePerMetre(draft: ImportCandidateDraft, retailerName: string): PricePerMetreSummary | null {
  if (draft.price == null || draft.package.packageLengthM == null) return null

  const packageType = draft.package.packageType === 'unknown' ? 'other' : draft.package.packageType
  const currency = (draft.currency ?? 'EUR') as RetailerListing['currency']

  const synthetic: RetailerListing = {
    id: -1,
    stringId: draft.suggestedCatalogItem?.id ?? 'unresolved',
    retailerId: -1,
    retailerName,
    retailerLogoUrl: null,
    retailerActive: true,
    productUrl: draft.url,
    price: draft.price,
    currency,
    availabilityStatus: 'unknown',
    packageType,
    packageLengthM: draft.package.packageLengthM,
    isPreferred: false,
    notes: null,
    lastCheckedAt: null,
    updatedAt: new Date().toISOString(),
  }

  return describeBestPricePerMetre([synthetic])
}
