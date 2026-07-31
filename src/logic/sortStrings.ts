// String catalog sorting — separate from the UI so sort behavior can be
// tuned or extended without touching StringComparison.tsx.

import type { StringItem } from '../data/strings.js'
import { bestPricePerMetre, type RetailerListing } from '../services/retailerPriceService.js'

export type SortOption = 'recommended' | 'priceAsc' | 'priceDesc' | 'popularity' | 'nameAsc'

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recommended', label: 'Recommended / Default' },
  { id: 'priceAsc', label: 'Price per metre: Low to High' },
  { id: 'priceDesc', label: 'Price per metre: High to Low' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'nameAsc', label: 'Name: A–Z' },
]

/**
 * Phase 12 — Part 13: price sorting is based on each string's best real
 * retailer price-per-metre (see bestPricePerMetre() in
 * retailerPriceService.ts), never on `stringCost` — that field is this
 * stringer's own personal service-string price (see logic/pricing.ts's
 * STRINGING_SERVICE_FEE total), not a market retail price, so using it
 * here would misrepresent it as one. A string with no valid retailer
 * price-per-metre at all sorts after every string that has one,
 * regardless of direction — never invented, never estimated.
 */
function comparePrice(a: StringItem, b: StringItem, direction: 1 | -1, listingsByStringId: Record<string, RetailerListing[]>): number {
  const aPpm = bestPricePerMetre(listingsByStringId[a.id] ?? [])?.pricePerMetre
  const bPpm = bestPricePerMetre(listingsByStringId[b.id] ?? [])?.pricePerMetre
  if (aPpm == null && bPpm == null) return 0
  if (aPpm == null) return 1
  if (bPpm == null) return -1
  return (aPpm - bPpm) * direction
}

/** Unranked strings always sort after every explicitly ranked string. */
function comparePopularity(a: StringItem, b: StringItem): number {
  if (a.popularityRank == null && b.popularityRank == null) return 0
  if (a.popularityRank == null) return 1
  if (b.popularityRank == null) return -1
  return a.popularityRank - b.popularityRank
}

/** `listingsByStringId` defaults to empty (every string sorts as "no known price") — pass useRetailerPrices()'s map to sort by real price-per-metre. Omitting it entirely never crashes; it just means priceAsc/priceDesc degrade to a no-op ordering, same as any other string with no listings. */
export function sortStrings(items: StringItem[], sortBy: SortOption, listingsByStringId: Record<string, RetailerListing[]> = {}): StringItem[] {
  if (sortBy === 'recommended') return items

  const sorted = [...items]
  switch (sortBy) {
    case 'priceAsc':
      return sorted.sort((a, b) => comparePrice(a, b, 1, listingsByStringId))
    case 'priceDesc':
      return sorted.sort((a, b) => comparePrice(a, b, -1, listingsByStringId))
    case 'popularity':
      return sorted.sort(comparePopularity)
    case 'nameAsc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return sorted
  }
}
