import type { StringItem } from '../data/strings'
import { calculateTotal, formatEuro } from '../logic/pricing'
import { buildRequestMailto } from '../logic/contactMessage'
import StockBadge from './StockBadge'
import StatBars from './StatBars'

const CATEGORY_LABEL: Record<StringItem['category'], string> = {
  repulsion: 'Quick Repulsion',
  control: 'Control',
  durability: 'Durability',
}

export default function StringCard({ item }: { item: StringItem }) {
  const price = calculateTotal(item.stringCost)
  const orderable = item.stock !== 'unavailable'

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 bg-white/90 dark:bg-white/5 transition-shadow ${
        orderable ? 'border-court-900/10 dark:border-white/10 hover:shadow-lg' : 'border-court-900/5 dark:border-white/5 opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{item.brand}</p>
          <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-shuttle-50">{item.name}</h3>
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-0.5">
            {CATEGORY_LABEL[item.category]}
            {item.tension?.gauge != null && <> · {item.tension.gauge}mm</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StockBadge stock={item.stock} />
          {item.popularityRank === 1 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-shuttle-500 text-court-900 px-2.5 py-1 text-xs font-semibold"
              title="Most popular with players I string for at my club"
            >
              ★ #1 Club Favorite
            </span>
          ) : (
            item.popularityRank != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-shuttle-100 dark:bg-shuttle-500/15 text-shuttle-600 dark:text-shuttle-400 px-2.5 py-1 text-xs font-semibold"
                title="Popular with players I string for at my club"
              >
                ★ Popular
              </span>
            )
          )}
        </div>
      </div>

      <StatBars item={item} compact />

      {item.notes && <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">{item.notes}</p>}

      <div className="mt-auto pt-3 border-t border-court-900/10 dark:border-white/10 flex items-end justify-between">
        <div className="text-sm">
          <p className="text-ink-700/60 dark:text-shuttle-100/60">
            String {formatEuro(item.stringCost)} + €15 stringing
          </p>
          <p className="font-display font-semibold text-ink-900 dark:text-shuttle-50">Total {formatEuro(price.total)}</p>
        </div>
        {orderable ? (
          <a
            href={buildRequestMailto(item.name)}
            className="focus-ring shrink-0 rounded-full bg-court-800 text-white text-sm font-semibold px-4 py-2 hover:bg-court-700 transition-colors cursor-pointer"
          >
            Request this
          </a>
        ) : (
          <span className="shrink-0 rounded-full bg-court-900/5 dark:bg-white/5 text-ink-700/40 dark:text-shuttle-100/40 text-sm font-semibold px-4 py-2 select-none">
            Unavailable
          </span>
        )}
      </div>
    </div>
  )
}
