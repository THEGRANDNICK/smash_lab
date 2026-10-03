import { useState } from 'react'
import { stringPagePath } from '../logic/stringPages'
import type { ScoredString } from '../logic/recommendationEngine'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { getSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { buildStructuredExplanation, buildAlternativeReasons, buildPodiumBestReason, buildPodiumAlternativeReason } from '../logic/recommendationExplanation'
import { formatGauge } from '../logic/formatGauge'
import StockBadge from './StockBadge'
import StatBars from './StatBars'
import SpecialistPanel from './SpecialistPanel'
import PurchaseOptions from './PurchaseOptions'
import { PricePerMetreSummary } from './StringCard'

export const PODIUM_COMPARE_LIMIT = 3

interface RecommendationPodiumProps {
  /** Exactly `rec.topThree` from recommendStrings() — the top 3 by matchPercent, in the engine's own order. Never re-sorted here. */
  topThree: ScoredString[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  retailerListingsByStringId?: Record<string, RetailerListing[]>
  selectedForCompare: Set<string>
  compareFull: boolean
  onToggleCompare: (id: string) => void
  /** The string currently shown at the top of the results page (defaults to rank 1). */
  featuredId?: string
  /** Shows a string at the top of the results page — its tension and the WhatsApp/email message follow it. */
  onFeature?: (id: string) => void
}

/**
 * A compact top-3 ranked podium, replacing the old text-heavy "Cross-Brand
 * Alternative" / "Specialist Choice" cards. Rank 1 gets typographic
 * emphasis; ranks 2/3 sit side by side below it. Default copy per card is
 * one sentence — strengths, trade-offs, manufacturer ratings, specialist
 * context and the full comparison against rank 1 all live behind "Read
 * more", matching the site's existing progressive-disclosure convention
 * (see ComparisonTable.tsx).
 */
export default function RecommendationPodium({ topThree, specialistProfiles, retailerListingsByStringId, selectedForCompare, compareFull, onToggleCompare, featuredId, onFeature }: RecommendationPodiumProps) {
  if (topThree.length === 0) return null
  const best = topThree[0]

  return (
    <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Top 3 recommended strings">
      <PodiumCard
        rank={1}
        scored={topThree[0]}
        best={best}
        prominent
        specialistProfiles={specialistProfiles}
        retailerListings={retailerListingsByStringId?.[topThree[0].string.id]}
        selected={selectedForCompare.has(topThree[0].string.id)}
        disabled={compareFull && !selectedForCompare.has(topThree[0].string.id)}
        onToggleCompare={() => onToggleCompare(topThree[0].string.id)}
        featured={featuredId == null || featuredId === topThree[0].string.id}
        onFeature={onFeature ? () => onFeature(topThree[0].string.id) : undefined}
        className="sm:col-span-2"
      />
      {topThree.slice(1).map((scored, i) => (
        <PodiumCard
          key={scored.string.id}
          rank={i + 2}
          scored={scored}
          best={best}
          specialistProfiles={specialistProfiles}
          retailerListings={retailerListingsByStringId?.[scored.string.id]}
          selected={selectedForCompare.has(scored.string.id)}
          disabled={compareFull && !selectedForCompare.has(scored.string.id)}
          onToggleCompare={() => onToggleCompare(scored.string.id)}
          featured={featuredId === scored.string.id}
          onFeature={onFeature ? () => onFeature(scored.string.id) : undefined}
        />
      ))}
    </ol>
  )
}

interface PodiumCardProps {
  rank: number
  scored: ScoredString
  best: ScoredString
  prominent?: boolean
  specialistProfiles?: Record<string, StringSpecialistProfile>
  retailerListings?: RetailerListing[]
  selected: boolean
  disabled: boolean
  onToggleCompare: () => void
  featured?: boolean
  onFeature?: () => void
  className?: string
}

const RANK_MEDAL = ['🥇', '🥈', '🥉']

function PodiumCard({ rank, scored, best, prominent, specialistProfiles, retailerListings, selected, disabled, onToggleCompare, featured = false, onFeature, className = '' }: PodiumCardProps) {
  const isBest = rank === 1
  // Rank 1 is the "why" panel for the hero above it, so its details are always open.
  const [expanded, setExpanded] = useState(isBest)
  const { string: item, matchPercent } = scored
  const profile = specialistProfiles ? specialistProfiles[item.id] : getSpecialistProfile(item.id)
  const bestProfile = specialistProfiles ? specialistProfiles[best.string.id] : getSpecialistProfile(best.string.id)
  const gauge = formatGauge(item)
  // Relative labels: in practice all three results scored 75–89 %, so the old absolute
  // "Great Match" label appeared on every card and helped no one choose.
  const gap = best.matchPercent - matchPercent
  const matchLabel = isBest ? 'Best match' : gap <= 3 ? 'Close alternative' : 'Alternative'

  const structured = buildStructuredExplanation(scored, '', profile)
  // The hero above already shows the Best Match's one-line reason — here Rank 1 shows its top strength instead of repeating it.
  const reason = isBest ? (structured.strengths[0] ?? buildPodiumBestReason(scored, profile)) : buildPodiumAlternativeReason(scored, best, profile, bestProfile)
  const vsWinnerReasons = isBest ? [] : buildAlternativeReasons(scored, best, profile, bestProfile)

  return (
    <li
      className={`list-none rounded-2xl border-2 ${featured && onFeature ? 'border-shuttle-500 ring-2 ring-shuttle-500/30' : 'border-court-900/10 dark:border-white/10'} card-stock p-5 sm:p-6 ${className}`}
      aria-label={`Rank ${rank} of 3: ${item.brand} ${item.name}, ${matchPercent} percent match, ${matchLabel}`}
    >
      {isBest ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl sm:text-2xl font-bold text-ink-900 dark:text-shuttle-50">Why {item.name} is your best match</h3>
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70 mt-1">{matchPercent}% match with your answers</p>
          </div>
          <StockBadge stock={item.stock} />
        </div>
      ) : (
        <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400">
              {RANK_MEDAL[rank - 1] ?? `#${rank}`} Rank {rank}
            </p>
            <p className="text-xs uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50 mt-1">{item.brand}</p>
            <h3 className={`font-display font-bold text-ink-900 dark:text-shuttle-50 ${prominent ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>
              <a href={`${import.meta.env.BASE_URL}${stringPagePath(item.id)}`} className="focus-ring rounded hover:underline decoration-shuttle-500 decoration-2 underline-offset-4">
                {item.name}
              </a>
              {gauge != null && <span className="text-sm font-normal text-ink-700/70 dark:text-shuttle-100/50 ml-2">{gauge}</span>}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-display font-bold text-shuttle-700 dark:text-shuttle-400 leading-none ${prominent ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>{matchLabel}</p>
            <p className="text-xs text-ink-700/70 dark:text-shuttle-100/50 mt-1">{matchPercent}% match</p>
          </div>
        </div>

        <div className="mt-3">
          <StockBadge stock={item.stock} />
        </div>

        <p className={`mt-3 text-ink-700/80 dark:text-shuttle-100/80 ${prominent ? 'text-base' : 'text-sm'}`}>{reason}</p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onFeature &&
          (featured ? (
            <span className="rounded-full bg-shuttle-500/15 text-shuttle-700 dark:text-shuttle-400 text-xs font-semibold px-3 py-2">✓ Shown at the top</span>
          ) : (
            <button
              type="button"
              onClick={onFeature}
              className="focus-ring rounded-full bg-court-800 hover:bg-court-700 text-white text-xs font-semibold px-3 py-2 transition-colors cursor-pointer"
            >
              {isBest ? '↩ Back to this one' : '↑ Choose this one'}
            </button>
          ))}
        <button
          type="button"
          onClick={onToggleCompare}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${item.name} from comparison` : `Add ${item.name} to comparison`}
          className={`focus-ring rounded-full border-2 text-xs font-semibold px-3 py-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
            selected ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
          }`}
        >
          {selected ? 'Comparing' : '+ Compare'}
        </button>
        {!isBest && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? `Show less about ${item.name}` : `Read more about ${item.name}`}
            className="focus-ring text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline cursor-pointer"
        >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-5 pt-5 border-t border-court-900/10 dark:border-white/10 space-y-5">
          {!isBest && vsWinnerReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50 mb-2">Vs. the top result</p>
              <ul className="space-y-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">
                {vsWinnerReasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span aria-hidden="true">↳</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(structured.strengths.length > 0 || structured.tradeoffs.length > 0) && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {structured.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50 mb-2">✅ Strengths</p>
                  <ul className="space-y-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">
                    {structured.strengths.map((s) => (
                      <li key={s} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {structured.tradeoffs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50 mb-2">⚖️ Trade-offs</p>
                  <ul className="space-y-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">
                    {structured.tradeoffs.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50 mb-2">Manufacturer ratings</p>
            <StatBars item={item} compact />
          </div>

          {profile && <SpecialistPanel profile={profile} />}

          {retailerListings && retailerListings.length > 0 && (
            <div>
              <div className="mb-2">
                <PricePerMetreSummary listings={retailerListings} />
              </div>
              <PurchaseOptions listings={retailerListings} />
            </div>
          )}
        </div>
      )}
    </li>
  )
}
