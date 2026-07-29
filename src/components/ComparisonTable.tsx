import { useState } from 'react'
import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { buildComparisonRows, type ComparisonRow, type ComparisonRowGroup } from '../logic/comparisonMetrics'
import { RADAR_COMPARE_COLORS } from './performanceAxes'

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

const SECTION_LABEL: Record<Exclude<ComparisonRowGroup, 'primary'>, string> = {
  performance: 'Performance details',
  availability: 'Availability',
}

/**
 * Compact, table-based side-by-side comparison — deliberately dot/text
 * indicators rather than another chart. Reads only data
 * buildComparisonRows() already derives from existing manufacturer
 * ratings, specialist profiles and retailer listings; never affects
 * recommendation scoring or ranking.
 *
 * Progressive disclosure: the 5 primary rows (Repulsion, Control,
 * Durability, Hitting Sound, Shock Absorption/Comfort) are always visible;
 * "Performance details" (Feel, Tension Retention, Power, Overall
 * Specialist Rating) and "Availability" (Retail Availability, Package
 * Options, Retailer Count) stay behind a "Show more details" toggle so the
 * default view stays scannable at a glance.
 */
export default function ComparisonTable({ items, specialistProfiles, retailerListingsByStringId }: ComparisonTableProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const perItemRows = items.map((item) => buildComparisonRows(item, specialistProfiles?.[item.id], retailerListingsByStringId?.[item.id]))
  const template = perItemRows[0] ?? []
  const primaryIndices = template.map((_, i) => i).filter((i) => template[i].group === 'primary')
  const performanceIndices = template.map((_, i) => i).filter((i) => template[i].group === 'performance')
  const availabilityIndices = template.map((_, i) => i).filter((i) => template[i].group === 'availability')
  const columnCount = items.length + 1

  function renderRow(rowIndex: number, muted: boolean) {
    const label = template[rowIndex].label
    return (
      <tr
        key={label}
        className={`border-t border-court-900/10 dark:border-white/10 ${
          muted ? 'odd:bg-transparent even:bg-court-900/[0.015] dark:even:bg-white/[0.015]' : 'odd:bg-transparent even:bg-court-900/[0.02] dark:even:bg-white/[0.02]'
        }`}
      >
        <th scope="row" className={`text-left font-medium px-3 py-2 whitespace-nowrap ${muted ? 'text-ink-700/50 dark:text-shuttle-100/50' : 'text-ink-700/70 dark:text-shuttle-100/70'}`}>
          {label}
        </th>
        {perItemRows.map((rows, itemIndex) => {
          const row: ComparisonRow = rows[rowIndex]
          return (
            <td key={items[itemIndex].id} className={`px-3 py-2 ${muted ? 'text-ink-900/80 dark:text-shuttle-50/80' : 'text-ink-900 dark:text-shuttle-50'}`}>
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
  }

  function renderSectionHeading(group: Exclude<ComparisonRowGroup, 'primary'>) {
    return (
      <tr key={`heading-${group}`} className="border-t border-court-900/10 dark:border-white/10">
        <th scope="colgroup" colSpan={columnCount} className="text-left font-semibold uppercase tracking-wide text-[0.65rem] text-ink-700/40 dark:text-shuttle-100/40 px-3 pt-3 pb-1">
          {SECTION_LABEL[group]}
        </th>
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-court-900/10 dark:border-white/10">
      <table className="w-full text-sm border-collapse" style={{ minWidth: `${8 + items.length * 9}rem` }}>
        <caption className="sr-only">Side-by-side comparison of {items.map((i) => i.name).join(', ')}</caption>
        <thead>
          <tr className="bg-court-900/[0.03] dark:bg-white/[0.03]">
            <th scope="col" className="text-left font-semibold text-ink-700/70 dark:text-shuttle-100/70 px-3 py-2 whitespace-nowrap">
              Metric
            </th>
            {items.map((item, i) => (
              <th key={item.id} scope="col" className="text-left font-semibold text-ink-900 dark:text-shuttle-50 px-3 py-2 min-w-[8rem]">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${RADAR_COMPARE_COLORS[i].dotClassName}`} aria-hidden="true" title="Chart series color" />
                  <span className="truncate">{item.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{primaryIndices.map((i) => renderRow(i, false))}</tbody>
        {expanded && (
          <tbody>
            {renderSectionHeading('performance')}
            {performanceIndices.map((i) => renderRow(i, true))}
            {renderSectionHeading('availability')}
            {availabilityIndices.map((i) => renderRow(i, true))}
          </tbody>
        )}
        <tfoot>
          <tr className="border-t border-court-900/10 dark:border-white/10">
            <td colSpan={columnCount} className="px-3 py-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="focus-ring text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
              >
                {expanded ? 'Show fewer details' : 'Show more details'}
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
