import type { StringItem } from '../data/strings'
import { formatGauge } from '../logic/formatGauge'
import { stringPagePath } from '../logic/stringPages'
import ImageSwiper from './ImageSwiper'
import { REEL_DRAG_TYPE } from './StringingBench'
import RadarChart from './RadarChart'
import { AXIS_EXPLANATION, PERFORMANCE_AXES, PERFORMANCE_MAX, RADAR_COMPARE_COLORS, getPerformanceValues } from './performanceAxes'
import type { PerformanceView } from './StringCard'

interface StringTileProps {
  item: StringItem
  view?: PerformanceView
  compareSelected?: boolean
  compareDisabled?: boolean
  onToggleCompare?: (id: string) => void
  /** Position in the grid — staggers the "dealt onto the table" entrance. */
  index?: number
}

const STOCK_DOT: Record<StringItem['stock'], { className: string; label: string }> = {
  'in-stock': { className: 'bg-emerald-500', label: 'In stock' },
  'low-stock': { className: 'bg-amber-500', label: 'Low stock' },
  unavailable: { className: 'bg-court-900/30 dark:bg-white/30', label: 'Currently unavailable' },
}

/**
 * The lineup tile: picture first (swipe front/back), then name and the five ratings as bars or a
 * small radar — nothing else. Description, hands-on notes, price and retailer links live on the
 * string's own page, one tap away ("Details"). Two tiles fit side by side on a phone.
 */
export default function StringTile({ item, view = 'bars', compareSelected = false, compareDisabled = false, onToggleCompare, index = 0 }: StringTileProps) {
  const href = `${import.meta.env.BASE_URL}${stringPagePath(item.id)}`
  const gauge = formatGauge(item)
  const stock = STOCK_DOT[item.stock]
  const values = getPerformanceValues(item)

  return (
    <article
      style={{ ['--deal-i' as string]: Math.min(index, 8) }}
      className={`paper deal relative rounded-2xl border-2 p-2.5 sm:p-3.5 flex flex-col gap-2.5 transition-transform duration-200 hover:-rotate-1 ${
        compareSelected ? 'border-shuttle-500' : 'border-transparent'
      }`}
    >
      {/* drag the reel onto a racket on the stringing bench (desktop); "+ Racket" does the same anywhere */}
      <div
        className="relative cursor-grab active:cursor-grabbing"
        draggable={onToggleCompare != null && !compareSelected}
        onDragStart={(e) => {
          e.dataTransfer.setData(REEL_DRAG_TYPE, item.id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
      >
        <ImageSwiper front={item.imageUrl} back={item.imageBackUrl} label={`${item.brand} ${item.name}`} placeholderText={item.name} />
        {item.popularityRank != null && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm ${item.popularityRank === 1 ? 'bg-shuttle-500 text-court-900' : 'bg-white/95 text-shuttle-700'}`}
            title={item.popularityRank === 1 ? 'Most popular among players at my club' : 'Popular among players at my club'}
          >
            ★ {item.popularityRank === 1 ? '#1' : 'Popular'}
          </span>
        )}
      </div>

      <div className="min-w-0 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400">{item.brand}</p>
        <h3 className="font-display text-base sm:text-lg font-semibold leading-tight text-ink-900 dark:text-shuttle-50">
          {/* The whole tile's main link — "Details" below goes to the same page. */}
          <a href={href} className="focus-ring rounded hover:underline decoration-shuttle-500 decoration-2 underline-offset-4">
            {item.name}
          </a>
        </h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-700/70 dark:text-shuttle-100/70">
          <span className={`inline-block h-2 w-2 rounded-full ${stock.className}`} aria-hidden="true" />
          <span className="sr-only">{stock.label}. </span>
          <span title={stock.label}>{gauge ?? '—'}</span>
        </p>
      </div>

      {view === 'bars' ? (
        <ul className="space-y-1 px-0.5" aria-label="Manufacturer ratings out of 11">
          {PERFORMANCE_AXES.map((axis) => {
            const v = values[axis.key]
            return (
              <li key={axis.key} className="flex items-center gap-1.5 text-xs" title={`${axis.label}: ${AXIS_EXPLANATION[axis.key]}`}>
                <span aria-hidden="true" className="w-4 text-center">
                  {axis.emoji}
                </span>
                <span className="sr-only">{axis.label}</span>
                <span className="relative h-1.5 flex-1 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-shuttle-500" style={{ width: `${v == null ? 0 : (v / PERFORMANCE_MAX) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-ink-700/80 dark:text-shuttle-100/80">{v ?? '—'}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <RadarChart
          series={[{ id: item.id, label: item.name, values, strokeClassName: RADAR_COMPARE_COLORS[0].strokeClassName, fillClassName: RADAR_COMPARE_COLORS[0].fillClassName }]}
          size={180}
          maxWidthClassName="max-w-[200px]"
        />
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {onToggleCompare ? (
          <button
            type="button"
            onClick={() => onToggleCompare(item.id)}
            disabled={compareDisabled && !compareSelected}
            aria-pressed={compareSelected}
            className={`focus-ring shrink-0 whitespace-nowrap rounded-full border-2 px-2 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              compareSelected ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
            }`}
          >
            {compareSelected ? '✓ On racket' : '+ Racket'}
          </button>
        ) : (
          <span />
        )}
        <a href={href} className="focus-ring shrink-0 whitespace-nowrap rounded text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline" aria-label={`Details about ${item.brand} ${item.name}`}>
          Details →
        </a>
      </div>
    </article>
  )
}
