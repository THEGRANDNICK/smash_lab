import type { StringItem } from '../data/strings'
import { calculateTotal, formatEuro } from '../logic/pricing'
import { buildRequestMailto } from '../logic/contactMessage'
import { getPerformanceValues, RADAR_COMPARE_COLORS } from './performanceAxes'
import StockBadge from './StockBadge'
import StatBars from './StatBars'
import RadarChart from './RadarChart'

const CATEGORY_LABEL: Record<StringItem['category'], string> = {
  repulsion: 'Quick Repulsion',
  control: 'Control',
  durability: 'Durability',
}

export type PerformanceView = 'bars' | 'radar'

interface StringCardProps {
  item: StringItem
  view?: PerformanceView
  compareSelected?: boolean
  compareDisabled?: boolean
  onToggleCompare?: (id: string) => void
}

export default function StringCard({ item, view = 'bars', compareSelected = false, compareDisabled = false, onToggleCompare }: StringCardProps) {
  const price = calculateTotal(item.stringCost)
  const orderable = item.stock !== 'unavailable'

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 bg-white/90 dark:bg-white/5 transition-shadow ${
        compareSelected
          ? 'border-shuttle-500 ring-2 ring-shuttle-500/30'
          : orderable
            ? 'border-court-900/10 dark:border-white/10 hover:shadow-lg'
            : 'border-court-900/5 dark:border-white/5 opacity-70'
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

      {view === 'bars' ? (
        <StatBars item={item} compact />
      ) : (
        <RadarChart
          series={[
            {
              id: item.id,
              label: item.name,
              values: getPerformanceValues(item),
              strokeClassName: RADAR_COMPARE_COLORS[0].strokeClassName,
              fillClassName: RADAR_COMPARE_COLORS[0].fillClassName,
            },
          ]}
          size={200}
          showValues
        />
      )}

      {item.notes && <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">{item.notes}</p>}

      {item.productUrl && (
        <a
          href={item.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring self-start text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
        >
          View on Yonex ↗
        </a>
      )}

      <div className="mt-auto pt-3 border-t border-court-900/10 dark:border-white/10 flex items-end justify-between gap-2">
        <div className="text-sm">
          <p className="text-ink-700/60 dark:text-shuttle-100/60">
            String {formatEuro(item.stringCost)} + €15 stringing
          </p>
          <p className="font-display font-semibold text-ink-900 dark:text-shuttle-50">Total {formatEuro(price.total)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(item.id)}
              disabled={compareDisabled && !compareSelected}
              aria-pressed={compareSelected}
              className={`focus-ring rounded-full border-2 text-xs font-semibold px-3 py-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                compareSelected
                  ? 'border-shuttle-500 bg-shuttle-500 text-court-900'
                  : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
              }`}
            >
              {compareSelected ? '✓ Comparing' : '+ Compare'}
            </button>
          )}
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
    </div>
  )
}
