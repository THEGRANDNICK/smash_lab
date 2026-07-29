import { useState } from 'react'
import type { StringItem } from '../data/strings'
import { buildRequestMailto } from '../logic/contactMessage'
import { formatGauge } from '../logic/formatGauge'
import { getSpecialistProfile, type StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { needsClamp } from '../logic/textClamp'
import type { RetailerListing } from '../services/retailerPriceService'
import { getPerformanceValues, RADAR_COMPARE_COLORS } from './performanceAxes'
import StockBadge from './StockBadge'
import StatBars from './StatBars'
import RadarChart from './RadarChart'
import SpecialistPanel from './SpecialistPanel'
import PurchaseOptions from './PurchaseOptions'

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
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles() to reflect current data. Display only; never affects recommendation scoring. */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options for this string, from useRetailerPrices() — omitted or empty renders nothing. Secondary, display-only information; never affects recommendation scoring. */
  retailerListings?: RetailerListing[]
}

export default function StringCard({ item, view = 'bars', compareSelected = false, compareDisabled = false, onToggleCompare, specialistProfiles, retailerListings }: StringCardProps) {
  const orderable = item.stock !== 'unavailable'
  const specialistProfile = specialistProfiles ? specialistProfiles[item.id] : getSpecialistProfile(item.id)
  const gauge = formatGauge(item)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const descriptionClamped = needsClamp(item.notes)

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 bg-white/90 dark:bg-white/5 transition-[box-shadow,transform] duration-200 ${
        compareSelected
          ? 'border-shuttle-500 ring-2 ring-shuttle-500/30'
          : orderable
            ? 'border-court-900/10 dark:border-white/10 hover:shadow-lg hover:-translate-y-0.5'
            : 'border-court-900/5 dark:border-white/5 opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{item.brand}</p>
          <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-shuttle-50">{item.name}</h3>
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-0.5">
            {CATEGORY_LABEL[item.category]}
            {gauge != null && <> · {gauge}</>}
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
          maxWidthClassName="max-w-[320px]"
        />
      )}

      {item.notes && (
        <div className="text-sm text-ink-700/70 dark:text-shuttle-100/70">
          <p className={descriptionClamped && !descriptionExpanded ? 'line-clamp-3' : ''}>{item.notes}</p>
          {descriptionClamped && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((e) => !e)}
              aria-expanded={descriptionExpanded}
              className="focus-ring mt-1 text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
            >
              {descriptionExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {specialistProfile && <SpecialistPanel profile={specialistProfile} />}

      {retailerListings && <PurchaseOptions listings={retailerListings} />}

      {item.productUrl && (
        <a
          href={item.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring self-start text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
        >
          View on {item.brand} ↗
        </a>
      )}

      <div className="mt-auto pt-3 border-t border-court-900/10 dark:border-white/10 flex items-center justify-end gap-2">
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
  )
}
