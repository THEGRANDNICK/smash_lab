// String catalog sorting — separate from the UI so sort behavior can be
// tuned or extended without touching StringComparison.tsx.

import type { StringItem } from '../data/strings'

export type SortOption = 'recommended' | 'priceAsc' | 'priceDesc' | 'popularity' | 'nameAsc'

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recommended', label: 'Recommended / Default' },
  { id: 'priceAsc', label: 'Price: Low to High' },
  { id: 'priceDesc', label: 'Price: High to Low' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'nameAsc', label: 'Name: A–Z' },
]

/** Unknown prices always sort after every known price, regardless of direction. */
function comparePrice(a: StringItem, b: StringItem, direction: 1 | -1): number {
  if (a.stringCost == null && b.stringCost == null) return 0
  if (a.stringCost == null) return 1
  if (b.stringCost == null) return -1
  return (a.stringCost - b.stringCost) * direction
}

/** Unranked strings always sort after every explicitly ranked string. */
function comparePopularity(a: StringItem, b: StringItem): number {
  if (a.popularityRank == null && b.popularityRank == null) return 0
  if (a.popularityRank == null) return 1
  if (b.popularityRank == null) return -1
  return a.popularityRank - b.popularityRank
}

export function sortStrings(items: StringItem[], sortBy: SortOption): StringItem[] {
  if (sortBy === 'recommended') return items

  const sorted = [...items]
  switch (sortBy) {
    case 'priceAsc':
      return sorted.sort((a, b) => comparePrice(a, b, 1))
    case 'priceDesc':
      return sorted.sort((a, b) => comparePrice(a, b, -1))
    case 'popularity':
      return sorted.sort(comparePopularity)
    case 'nameAsc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return sorted
  }
}
