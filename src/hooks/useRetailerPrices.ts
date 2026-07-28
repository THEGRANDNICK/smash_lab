import { useEffect, useState } from 'react'
import type { RetailerListing } from '../services/retailerPriceService.js'
import { fetchRetailerPricesFromSupabase } from '../services/retailerPriceService.js'

/** Empty until the fetch resolves — there is no local fallback dataset (see retailerPriceService.ts), so "loading" and "no listings anywhere" look identical, which is intentional: retailer data is optional, secondary information. */
export function useRetailerPrices(): Record<string, RetailerListing[]> {
  const [listings, setListings] = useState<Record<string, RetailerListing[]>>({})
  useEffect(() => {
    let cancelled = false
    fetchRetailerPricesFromSupabase().then((result) => {
      if (cancelled) return
      setListings(result.listingsByStringId)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return listings
}
