import { useState } from 'react'
import {
  orderRetailerListings,
  formatRetailerPrice,
  pricePerMetre,
  AVAILABILITY_LABELS,
  PACKAGE_TYPE_LABELS,
  type RetailerListing,
} from '../services/retailerPriceService'
import { SAFE_URL_PATTERN } from '../services/catalogService'

interface PurchaseOptionsProps {
  listings: RetailerListing[]
}

function packageLabel(listing: RetailerListing): string {
  const base = PACKAGE_TYPE_LABELS[listing.packageType]
  return listing.packageLengthM != null ? `${base} (${listing.packageLengthM}m)` : base
}

/**
 * Secondary, collapsed-by-default purchase-option list — keeps catalog
 * cards visually clean per the phase spec, while still surfacing retailer
 * data where it's genuinely useful. Renders nothing if there are no
 * listings, so callers can render it unconditionally.
 *
 * Ordering: orderRetailerListings() (preferred first, then availability,
 * then price) — re-applied here defensively even though
 * fetchRetailerPricesFromSupabase() already orders its output, so this
 * component is correct regardless of caller.
 */
export default function PurchaseOptions({ listings }: PurchaseOptionsProps) {
  if (listings.length === 0) return null
  const ordered = orderRetailerListings(listings)

  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none font-semibold text-shuttle-600 dark:text-shuttle-400 focus-ring rounded">
        🛒 Purchase options ({ordered.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {ordered.map((listing) => {
          const price = formatRetailerPrice(listing.price, listing.currency)
          const perMetre = listing.packageType === 'reel' ? pricePerMetre(listing) : null
          const safeUrl = listing.productUrl && SAFE_URL_PATTERN.test(listing.productUrl) ? listing.productUrl : null
          return (
            <li
              key={listing.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-court-900/10 dark:border-white/10 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <RetailerLogo listing={listing} />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 dark:text-shuttle-50 truncate">
                    {listing.retailerName}
                    {listing.isPreferred && <span className="ml-1.5 text-xs font-normal text-shuttle-600 dark:text-shuttle-400">preferred</span>}
                  </p>
                  <p className="text-xs text-ink-700/60 dark:text-shuttle-100/60">
                    {packageLabel(listing)} · {AVAILABILITY_LABELS[listing.availabilityStatus]}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {price != null && <p className="font-semibold text-ink-900 dark:text-shuttle-50">{price}</p>}
                {perMetre != null && <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">{formatRetailerPrice(perMetre, listing.currency)}/m</p>}
                {safeUrl != null && (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="focus-ring inline-block mt-1 text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
                  >
                    Buy ↗
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/** Shows the retailer's logo when a (safe, http(s)) URL is set and actually loads; falls back to nothing (never a broken-image icon, never a layout shift) if the URL is missing, unsafe, or the image fails to load. */
function RetailerLogo({ listing }: { listing: RetailerListing }) {
  const [failed, setFailed] = useState(false)
  const safeLogoUrl = listing.retailerLogoUrl && SAFE_URL_PATTERN.test(listing.retailerLogoUrl) ? listing.retailerLogoUrl : null
  if (!safeLogoUrl || failed) return null
  return (
    <img
      src={safeLogoUrl}
      alt=""
      onError={() => setFailed(true)}
      className="w-6 h-6 rounded object-contain bg-white/50 dark:bg-white/10 shrink-0"
    />
  )
}
