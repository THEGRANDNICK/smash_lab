import { useEffect, useState } from 'react'
import type { StringItem } from '../data/strings'
import { getLocalFallbackCatalog, fetchCatalogFromSupabase } from '../services/catalogService'
import { getLocalFallbackInventory, fetchInventoryFromSupabase, mergeInventoryIntoCatalog } from '../services/inventoryService'

/**
 * Orchestrates the two independent live data sources — catalog
 * (services/catalogService.ts) and inventory (services/inventoryService.ts)
 * — into the single StringItem[] pool the public UI and recommendation
 * engine consume. Deliberately thin: all fetching, validation, fallback,
 * and mapping logic lives in the two services; this hook only sequences
 * "fetch both, merge, set state" and owns no business logic of its own.
 *
 * Starts synchronously from the local fallback catalog merged with its own
 * local fallback inventory — identical to what the site showed before
 * Phase 2/4, so first paint is instant with no loading spinner. Catalog and
 * inventory are then fetched concurrently; whichever resolves is merged in,
 * falling back independently per source on failure. Never throws and never
 * surfaces a user-facing error — see the two services for how each failure
 * mode degrades.
 */
export function useStringPool(): StringItem[] {
  const [items, setItems] = useState<StringItem[]>(() => mergeInventoryIntoCatalog(getLocalFallbackCatalog(), getLocalFallbackInventory()))

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchCatalogFromSupabase(), fetchInventoryFromSupabase()]).then(([catalogResult, inventory]) => {
      if (cancelled) return
      const merged = mergeInventoryIntoCatalog(catalogResult.items, inventory ?? getLocalFallbackInventory())
      setItems(merged)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return items
}
