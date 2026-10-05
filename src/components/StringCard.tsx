import { useState } from 'react'
import { stringPagePath } from '../logic/stringPages'
import type { StringItem } from '../data/strings'
import { buildRequestMailto } from '../logic/contactMessage'
import { formatGauge } from '../logic/formatGauge'
import { getSpecialistProfile, type StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { needsClamp } from '../logic/textClamp'
import { describeBestPricePerMetre, type RetailerListing } from '../services/retailerPriceService'
import { getPerformanceValues, RADAR_COMPARE_COLORS } from './performanceAxes'
import StockBadge from './StockBadge'
import StatBars from './StatBars'
import RadarChart from './RadarChart'
import SpecialistPanel from './SpecialistPanel'
import SpecialistHighlights from './SpecialistHighlights'
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
  /** 'h2' on the string's own page, where the card is the main content. */
  headingLevel?: 'h2' | 'h3'
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles() to reflect current data. Display only; never affects recommendation scoring. */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options for this string, from useRetailerPrices() — omitted or empty renders nothing. Secondary, display-only information; never affects recommendation scoring. */
  retailerListings?: RetailerListing[]
}

export default function StringCard({ item, view = 'bars', compareSelected = false, compareDisabled = false, onToggleCompare, specialistProfiles, retailerListings, headingLevel = 'h3' }: StringCardProps) {
  const orderable = item.stock !== 'unavailable'
  const specialistProfile = specialistProfiles ? specialistProfiles[item.id] : getSpecialistProfile(item.id)
  const gauge = formatGauge(item)
  // On the string's own page (headingLevel 'h2') everything is shown in full: no clamped text, hands-on notes open.
  const isDetailPage = headingLevel === 'h2'
  const [descriptionExpanded, setDescriptionExpanded] = useState(isDetailPage)
  const descriptionClamped = needsClamp(item.notes)

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 card-stock transition-[box-shadow,transform] duration-200 ${
        compareSelected
          ? 'border-shuttle-500 ring-2 ring-shuttle-500/30'
          : orderable
            ? 'border-court-900/10 dark:border-white/10 hover:shadow-lg hover:-translate-y-0.5'
            : 'border-dashed border-court-900/20 dark:border-white/20 saturate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400">{item.brand}</p>
          {(() => {
            const Heading = headingLevel
            return (
              <Heading className="font-display text-lg font-semibold text-ink-900 dark:text-shuttle-50">
                {headingLevel === 'h3' ? (
                  <a href={`${import.meta.env.BASE_URL}${stringPagePath(item.id)}`} className="focus-ring rounded hover:underline decoration-shuttle-500 decoration-2 underline-offset-4">
                    {item.name}
                  </a>
                ) : (
                  item.name
                )}
              </Heading>
            )
          })()}
          <p className="text-xs text-ink-700/70 dark:text-shuttle-100/50 mt-0.5">
            {CATEGORY_LABEL[item.category]}
            {gauge != null && <> · {gauge}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StockBadge stock={item.stock} />
          {item.popularityRank === 1 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-shuttle-500 text-court-900 px-2.5 py-1 text-xs font-semibold"
              title="Most popular among players at my club"
            >
              ★ #1 Club Favorite
            </span>
          ) : (
            item.popularityRank != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-shuttle-100 dark:bg-shuttle-500/15 text-shuttle-700 dark:text-shuttle-400 px-2.5 py-1 text-xs font-semibold"
                title="Popular among players at my club"
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

      <SpecialistHighlights profile={specialistProfile} />

      {item.notes && (
        <div className="text-sm text-ink-700/70 dark:text-shuttle-100/70">
          <p className={descriptionClamped && !descriptionExpanded ? 'line-clamp-3' : ''}>{item.notes}</p>
          {descriptionClamped && !isDetailPage && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((e) => !e)}
              aria-expanded={descriptionExpanded}
              className="focus-ring mt-1 text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline cursor-pointer"
            >
              {descriptionExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {specialistProfile && <SpecialistPanel profile={specialistProfile} defaultOpen={isDetailPage} />}

      {retailerListings && retailerListings.length > 0 && (
        <PricePerMetreSummary listings={retailerListings} />
      )}

      {retailerListings && <PurchaseOptions listings={retailerListings} />}

      {item.productUrl && (
        <a
          href={item.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring self-start text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline cursor-pointer"
        >
          View on {item.brand} ↗
        </a>
      )}

      <div className="pt-3 border-t border-court-900/10 dark:border-white/10 flex items-center justify-end gap-2">
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
        {/* A question is always possible, whatever the stock — Smash Lab is a guide, not a shop. */}
        <a
          href={buildRequestMailto(item.name)}
          className="focus-ring shrink-0 rounded-full border-2 border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 text-sm font-semibold px-4 py-2 hover:border-shuttle-500 transition-colors cursor-pointer"
        >
          Ask about it
        </a>
      </div>
    </div>
  )
}

/**
 * Phase 12 — Part 14: a transparent, one-line "From €X/m" summary shown
 * above the collapsed purchase-options list, so a price-per-metre figure
 * is never hidden behind a click. Sourced entirely from
 * describeBestPricePerMetre() (services/retailerPriceService.ts) — never
 * a second price calculation. Renders nothing if no listing has a known
 * price AND package length, per the phase brief's "don't show
 * price-per-metre when length unknown".
 */
export function PricePerMetreSummary({ listings }: { listings: RetailerListing[] }) {
  const summary = describeBestPricePerMetre(listings)
  if (!summary) return null
  return (
    <p className="text-sm">
      <span className="font-semibold text-ink-900 dark:text-shuttle-50">From {summary.formatted}</span>{' '}
      <span className="text-ink-700/70 dark:text-shuttle-100/50">— {summary.sourceDescription}</span>
    </p>
  )
}
