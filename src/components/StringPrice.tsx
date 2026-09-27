import { formatEuro } from '../logic/pricing'

/**
 * The string's own price, shown for information only. Prices are entered by
 * hand in the catalog admin and not every string has one — those show
 * "Price on request". The stringing fee is deliberately never shown on the
 * site; it's quoted when a customer gets in touch.
 */
export default function StringPrice({ stringCost }: { stringCost: number | null | undefined }) {
  if (stringCost == null) {
    return <p className="text-xs font-semibold text-ink-700/70 dark:text-shuttle-100/70">String price on request</p>
  }
  return (
    <p className="text-sm">
      <span className="font-bold text-ink-900 dark:text-shuttle-50">{formatEuro(stringCost)}</span>
      <span className="text-xs text-ink-700/70 dark:text-shuttle-100/70"> string price</span>
    </p>
  )
}
