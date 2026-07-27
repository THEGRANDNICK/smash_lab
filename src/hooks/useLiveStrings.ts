import { useEffect, useState } from 'react'
import { strings as catalog, type StringItem } from '../data/strings'
import { fetchInventoryFromSupabase, mergeInventoryIntoCatalog } from '../services/inventoryService'

/**
 * Returns the catalog with live Supabase inventory merged in once it
 * loads. Starts synchronously from strings.ts's own local values (so
 * first paint is instant and identical to before Phase 2), then updates
 * in place if/when the Supabase fetch succeeds. On any failure it just
 * stays on the local values — no loading spinner, no error UI, nothing
 * for the recommendation engine to react to differently.
 */
export function useLiveStrings(): StringItem[] {
  const [items, setItems] = useState<StringItem[]>(catalog)

  useEffect(() => {
    let cancelled = false
    fetchInventoryFromSupabase().then((inventory) => {
      if (cancelled || !inventory) return
      setItems(mergeInventoryIntoCatalog(inventory))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return items
}
