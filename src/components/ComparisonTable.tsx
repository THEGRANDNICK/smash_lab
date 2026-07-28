import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { buildComparisonRows } from '../logic/comparisonMetrics'
import { primaryStringColor } from '../logic/stringColor'
import { RADAR_COMPARE_COLORS } from './performanceAxes'
import StringColorSwatch from './StringColorSwatch'

interface ComparisonTableProps {
  items: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

function DotIndicator({ filled, of }: { filled: number; of: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-court-700 dark:bg-shuttle-400' : 'bg-court-900/15 dark:bg-white/15'}`} />
      ))}
    </span>
  )
}

/**
 * Compact, table-based side-by-side comparison — deliberately dot/text
 * indicators rather than another chart, per the Phase 8 brief. Reads only
 * data buildComparisonRows() already derives from existing manufacturer
 * ratings, specialist profiles and retailer listings; never affects
 * recommendation scoring or ranking.
 */
export default function ComparisonTable({ items, specialistProfiles, retailerListingsByStringId }: ComparisonTableProps) {
  if (items.length === 0) return null

  const perItemRows = items.map((item) => buildComparisonRows(item, specialistProfiles?.[item.id], retailerListingsByStringId?.[item.id]))
  const rowCount = perItemRows[0]?.length ?? 0

  return (
    <div className="overflow-x-auto rounded-xl border border-court-900/10 dark:border-white/10">
      <table className="min-w-full text-sm border-collapse" style={{ minWidth: `${8 + items.length * 9}rem` }}>
        <caption className="sr-only">Side-by-side comparison of {items.map((i) => i.name).join(', ')}</caption>
        <thead>
          <tr className="bg-court-900/[0.03] dark:bg-white/[0.03]">
            <th scope="col" className="text-left font-semibold text-ink-700/70 dark:text-shuttle-100/70 px-3 py-2 whitespace-nowrap">
              Metric
            </th>
            {items.map((item, i) => {
              const swatch = primaryStringColor(item.colors)
              return (
                <th key={item.id} scope="col" className="text-left font-semibold text-ink-900 dark:text-shuttle-50 px-3 py-2 min-w-[8rem]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${RADAR_COMPARE_COLORS[i].dotClassName}`} aria-hidden="true" title="Chart series color" />
                    {swatch && <StringColorSwatch swatch={swatch} size="sm" />}
                    <span className="truncate">{item.name}</span>
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => {
            const label = perItemRows[0][rowIndex].label
            return (
              <tr key={label} className="border-t border-court-900/10 dark:border-white/10 odd:bg-transparent even:bg-court-900/[0.02] dark:even:bg-white/[0.02]">
                <th scope="row" className="text-left font-medium text-ink-700/70 dark:text-shuttle-100/70 px-3 py-2 whitespace-nowrap">
                  {label}
                </th>
                {perItemRows.map((rows, itemIndex) => {
                  const row = rows[rowIndex]
                  return (
                    <td key={items[itemIndex].id} className="px-3 py-2 text-ink-900 dark:text-shuttle-50">
                      {row.kind === 'dots' ? (
                        row.dots ? (
                          <span className="inline-flex items-center gap-2">
                            <DotIndicator filled={row.dots.filled} of={row.dots.of} />
                            <span className="sr-only">{row.text}</span>
                          </span>
                        ) : (
                          <span className="text-ink-700/40 dark:text-shuttle-100/40">{row.text}</span>
                        )
                      ) : (
                        <span>{row.text}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
