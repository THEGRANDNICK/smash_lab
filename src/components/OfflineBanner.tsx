import { useEffect, useState } from 'react'

/**
 * Purely additive UX signal — never gates or blocks any feature. The app's
 * data hooks already degrade gracefully to local/fallback data on their own
 * (see useStringPool/useSpecialistProfiles/useRetailerPrices), so being
 * offline doesn't break anything; this just tells the player why prices,
 * stock or retailer listings might be stale.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div role="status" className="bg-shuttle-500 text-court-900 text-sm font-semibold text-center py-2 px-4">
      You're offline — showing the last available data. Prices, stock and retailer info may be out of date.
    </div>
  )
}
