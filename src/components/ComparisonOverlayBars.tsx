import type { StringItem } from '../data/strings'
import { buildOverlayBarRows, type OverlayBarSeriesValue } from '../logic/comparisonOverlay'
import { RADAR_COMPARE_COLORS } from './performanceAxes'

interface ComparisonOverlayBarsProps {
  /** In the same order as the comparison chips/legend — every bar and value below lines up with that order. */
  items: StringItem[]
}

function rowAccessibleText(label: string, series: OverlayBarSeriesValue[]): string {
  return `${label}: ${series.map((s) => `${s.label} ${s.displayText}`).join(', ')}.`
}

/**
 * A compact, shared-scale bar per core performance metric (Repulsion,
 * Control, Durability, Hitting sound, Shock absorption) beneath the radar,
 * so a difference is readable without reading every axis label. Two
 * strings overlap visually on one track (a translucent full-height bar for
 * the first series, a shorter solid outlined bar layered on top for the
 * second) so neither disappears even when their values are equal or very
 * close. Three strings use three thin stacked mini-bars in the same row
 * instead of forcing an unreadable triple overlap.
 */
export default function ComparisonOverlayBars({ items }: ComparisonOverlayBarsProps) {
  if (items.length < 2) return null
  const rows = buildOverlayBarRows(items)

  return (
    <div role="group" aria-label="Compact metric-by-metric comparison" className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-xs font-semibold text-ink-700/70 dark:text-shuttle-100/70 sm:w-36 sm:shrink-0">{row.label}</span>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex-1 min-w-0 h-5" aria-hidden="true">
              <div className="absolute inset-0 rounded-full bg-court-900/5 dark:bg-white/5" />
              {row.series.length <= 2 ? (
                <OverlappingBars series={row.series} />
              ) : (
                <StackedMiniBars series={row.series} />
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2" aria-hidden="true">
              {row.series.map((s, i) => (
                <span key={s.id} className={`text-sm font-semibold tabular-nums ${RADAR_COMPARE_COLORS[i].textClassName}`}>
                  {s.displayText}
                </span>
              ))}
            </div>
          </div>
          <span className="sr-only">{rowAccessibleText(row.label, row.series)}</span>
        </div>
      ))}
    </div>
  )
}

/** Two series sharing one track: series 0 is a full-height translucent bar, series 1 a shorter, solid, outlined bar layered on top — whichever value is shorter still shows as its own distinct bar rather than being visually swallowed by the other. */
function OverlappingBars({ series }: { series: OverlayBarSeriesValue[] }) {
  const first = series[0]
  const second = series[1]
  return (
    <>
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${RADAR_COMPARE_COLORS[0].barClassName} opacity-40`}
        style={{ width: `${first.percent}%` }}
      />
      {second && (
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full ring-2 ring-white dark:ring-court-900 ${RADAR_COMPARE_COLORS[1].barClassName}`}
          style={{ width: `${second.percent}%` }}
        />
      )}
    </>
  )
}

/** Three series as thin stacked mini-bars in the same row — avoids an unreadable triple overlap while keeping every string's value clearly visible and in chip order. */
function StackedMiniBars({ series }: { series: OverlayBarSeriesValue[] }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-0.5">
      {series.map((s, i) => (
        <div key={s.id} className="relative h-[5px] w-full">
          <div className={`absolute inset-y-0 left-0 rounded-full ${RADAR_COMPARE_COLORS[i].barClassName}`} style={{ width: `${s.percent}%` }} />
        </div>
      ))}
    </div>
  )
}
