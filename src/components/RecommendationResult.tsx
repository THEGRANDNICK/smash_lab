import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { recommendStrings } from '../logic/recommendationEngine'
import { recommendTension } from '../logic/tensionRecommendation'
import { formatKg, formatLbs } from '../logic/units'
import { formatGauge } from '../logic/formatGauge'
import { buildPodiumAlternativeReason, buildPodiumBestReason } from '../logic/recommendationExplanation'
import { getSpecialistProfile } from '../data/stringSpecialistProfiles'
import { DATA_SOURCE_NOTE, type DataSource } from '../logic/dataSourcePreference'
import DataSourceSwitch from './DataSourceSwitch'
import { writePendingComparisonSelection } from '../logic/pendingComparisonSelection'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { QuizAnswers } from '../logic/types'
import type { StringItem } from '../data/strings'
import type { RetailerListing } from '../services/retailerPriceService'
import StockBadge from './StockBadge'
import Shuttlecock from './Shuttlecock'
import DisclaimerBox from './DisclaimerBox'
import StringMap from './StringMap'
import RecommendationPodium, { PODIUM_COMPARE_LIMIT } from './RecommendationPodium'
import StringingEnquiry from './StringingEnquiry'
import TensionTuner from './TensionTuner'
import StringBasics from './StringBasics'
import AnswerTree from './AnswerTree'

interface RecommendationResultProps {
  answers: QuizAnswers
  /** Lets the optional tension panel update racket details; omitted → the panel isn't shown (e.g. opened from a share link). */
  onChangeAnswers?: (next: QuizAnswers) => void
  onRetake: () => void
  onCompare: () => void
  dataSource: DataSource
  /** When set, the results page shows a small switch between calibrated and manufacturer-only ranking (formerly a separate quiz step). */
  onChangeDataSource?: (next: DataSource) => void
  /** Defaults to the full static catalog (recommendStrings' own default) when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. Never affects scoring, only which stock values are attached to each candidate. */
  pool?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup (recommendStrings' own default) when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). Never affects the scoring math itself, only where the specialist-layer data comes from. */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Display only — never passed to recommendStrings() and never affects scoring. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

export default function RecommendationResult({ answers, onChangeAnswers, onRetake, onCompare, dataSource, onChangeDataSource, pool, specialistProfiles, retailerListingsByStringId }: RecommendationResultProps) {
  // useMemo avoids recomputing the (pure, but non-trivial) recommendation
  // whenever this component re-renders for an unrelated reason (e.g. the
  // retailer listings map updating after the initial paint) — the inputs
  // here are exactly recommendStrings()'s own parameters, so the result is
  // always identical to calling it directly; this is a rendering
  // optimization only, never a change to what gets computed.
  const rec = useMemo(() => recommendStrings(answers, pool, specialistProfiles), [answers, pool, specialistProfiles])
  // The string shown at the top. Defaults to the recommendation; tapping another match (podium or
  // answer tree) "features" it instead — its tension, reasoning and the WhatsApp/email message all
  // follow — until "Back to recommended". Scored against the player's OWN answers via rec.ranked.
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const featured = (featuredId ? rec.ranked.find((s) => s.string.id === featuredId) : undefined) ?? rec.best
  const isRecommended = featured.string.id === rec.best.string.id
  const featuredRank = rec.ranked.findIndex((s) => s.string.id === featured.string.id) + 1
  const tension = useMemo(() => recommendTension(answers, featured.string), [answers, featured.string])

  const profileOf = (id: string) => (specialistProfiles ? specialistProfiles[id] : getSpecialistProfile(id))
  const bestProfile = profileOf(rec.best.string.id)
  const featuredProfile = profileOf(featured.string.id)
  const featuredGauge = formatGauge(featured.string)
  const bestReason = useMemo(() => buildPodiumBestReason(rec.best, bestProfile), [rec.best, bestProfile])
  const heroReason = isRecommended ? bestReason : buildPodiumAlternativeReason(featured, rec.best, featuredProfile, bestProfile)

  const [tab, setTab] = useState<'matches' | 'answers'>('matches')

  function feature(id: string) {
    setFeaturedId(id === rec.best.string.id ? null : id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())

  function toggleCompare(id: string) {
    setSelectedForCompare((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < PODIUM_COMPARE_LIMIT) next.add(id)
      return next
    })
  }

  function handleCompareClick() {
    if (selectedForCompare.size > 0) {
      writePendingComparisonSelection(typeof window === 'undefined' ? null : window.sessionStorage, [...selectedForCompare])
    }
    onCompare()
  }

  // Availability is presentation only — never a filter on the podium
  // itself. Only surfaced as a small secondary note when the best
  // available string isn't already one of the top 3 shown (each podium
  // card already carries its own stock badge otherwise).
  const bestAvailableOutsidePodium = rec.bestAvailable && !rec.topThree.some((s) => s.string.id === rec.bestAvailable?.string.id) ? rec.bestAvailable : undefined

  // Context for the "where it sits" map: the full candidate pool (so the
  // top 3 are shown against real neighbors, never an isolated point), with
  // the podium's own ranks 1-3 highlighted distinctly from everything else.
  const mapPool = pool ?? rec.topThree.map((s) => s.string)
  const topThreeIds = useMemo(() => rec.topThree.map((s) => s.string.id), [rec.topThree])

  if (rec.best.string == null) {
    // Defensive only — recommendStrings() always returns a `best` when given
    // a non-empty pool, and the app never renders the quiz with an empty
    // one. Kept as a graceful message instead of a crash if that ever
    // changes upstream.
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-lg font-semibold text-ink-900 dark:text-shuttle-50">No recommendations available right now.</p>
        <p className="mt-2 text-ink-700/70 dark:text-shuttle-100/70">Please try again in a moment, or browse the full lineup directly.</p>
        <button
          type="button"
          onClick={onCompare}
          className="focus-ring mt-6 rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
        >
          Browse strings
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        {/* Hero result card, styled like a match result / player card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-court-900 via-court-800 to-court-700 text-white px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16 shadow-2xl">
          <div className="absolute inset-0 court-lines opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 string-grid opacity-[0.07]" aria-hidden="true" />
          <motion.div
            className="absolute top-6 right-6 text-shuttle-400/40"
            animate={{ rotate: [0, 10, -10, 0], y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <Shuttlecock className="w-20 h-20" />
          </motion.div>

          <div className="relative max-w-2xl">
            {isRecommended ? (
              <p className="text-shuttle-400 font-semibold text-sm tracking-widest uppercase flex items-center gap-2">🏸 Your Perfect Setup</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-shuttle-400 font-semibold text-sm tracking-widest uppercase">
                  👀 Your #{featuredRank} match · {featured.matchPercent}%
                </p>
                <button
                  type="button"
                  onClick={() => feature(rec.best.string.id)}
                  className="focus-ring rounded-full border-2 border-white/30 hover:border-white/70 px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  ↩ Back to recommended ({rec.best.string.name})
                </button>
              </div>
            )}

            <p className="mt-5 text-sm uppercase tracking-wide text-white/50 font-semibold">{featured.string.brand}</p>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {featured.string.name}
              {featuredGauge != null && <span className="text-base font-normal text-white/50 ml-2">{featuredGauge}</span>}
            </h1>
            <p className="mt-3 text-white/80 max-w-lg">{heroReason}</p>
            {isRecommended && rec.bestAvailable && (
              <p className="mt-2 text-xs font-semibold text-shuttle-400/90 uppercase tracking-wide">Best overall match — may need to be ordered</p>
            )}

            {/* Tension */}
            <div className="mt-8 rounded-2xl bg-white/10 backdrop-blur-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your Recommended Tension</p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold">{formatKg(tension.recommendedKg)}</span>
                <span className="text-white/60">≈ {formatLbs(tension.recommendedKg)}</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
                <TensionOption kg={tension.lowerKg} label="More forgiving / easier power" />
                <TensionOption kg={tension.recommendedKg} label="Recommended" highlight />
                {tension.higherKg != null ? (
                  <TensionOption kg={tension.higherKg} label="More direct / control" />
                ) : (
                  <div className="rounded-xl p-3 bg-white/5 text-white/40 border border-dashed border-white/15">
                    <p className="font-display font-bold">—</p>
                    <p className="mt-1 leading-tight">Firmer would exceed your racket's max</p>
                  </div>
                )}
              </div>

              {tension.wasCappedByRacketMax && (
                <p className="mt-4 text-xs text-shuttle-400 font-semibold">
                  ⚠️ Capped to stay within your racket's maximum recommended tension ({tension.racketMaxKg} kg).
                </p>
              )}
              <p className="mt-3 text-xs text-white/50">Always stay within the tension range specified by your racket manufacturer — never exceed its maximum, whichever string you choose.</p>
            </div>
          </div>
        </div>

        {onChangeAnswers && <TensionTuner answers={answers} onChange={onChangeAnswers} />}

        {/* Best available now, shown separately when the best overall match isn't in stock */}
        {rec.bestAvailable && (
          <div className="mt-6 rounded-2xl border-2 border-shuttle-500/40 bg-shuttle-100/60 dark:bg-shuttle-500/10 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-court-800 dark:text-shuttle-400">
                ✅ Best Available Alternative — {rec.bestAvailable.string.name} ({rec.bestAvailable.matchPercent}% Match)
              </p>
              <StockBadge stock={rec.bestAvailable.string.stock} />
            </div>
            <p className="mt-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">{rec.explanations.bestAvailable}</p>
          </div>
        )}

        {/* Podium — top-3 ranked results, replacing the old text-heavy Cross-Brand Alternative / Specialist Choice cards. */}
        <div className="mt-8">
          {onChangeDataSource ? (
            <DataSourceSwitch value={dataSource} onChange={onChangeDataSource} />
          ) : (
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50">{DATA_SOURCE_NOTE[dataSource]}</p>
          )}
          <div role="tablist" aria-label="Result details" className="mt-4 flex justify-center gap-2">
            {(
              [
                ['matches', 'Your top 3'],
                ['answers', 'Your answers'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`result-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`result-panel-${id}`}
                onClick={() => setTab(id)}
                className={`focus-ring rounded-full border-2 px-5 py-2 text-sm font-bold transition-colors cursor-pointer ${
                  tab === id ? 'border-court-800 bg-court-800 text-white dark:border-shuttle-500 dark:bg-shuttle-500 dark:text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <h2 className="sr-only">{tab === 'matches' ? 'Your top 3 matches' : 'Your answers'}</h2>
          {tab === 'answers' ? (
            <div role="tabpanel" id="result-panel-answers" aria-labelledby="result-tab-answers" className="mt-6">
              <AnswerTree answers={answers} pool={pool} specialistProfiles={specialistProfiles} featuredId={featured.string.id} onFeature={feature} />
            </div>
          ) : (
          <div role="tabpanel" id="result-panel-matches" aria-labelledby="result-tab-matches">
          <RecommendationPodium
            topThree={rec.topThree}
            specialistProfiles={specialistProfiles}
            retailerListingsByStringId={retailerListingsByStringId}
            selectedForCompare={selectedForCompare}
            compareFull={selectedForCompare.size >= PODIUM_COMPARE_LIMIT}
            onToggleCompare={toggleCompare}
            featuredId={featured.string.id}
            onFeature={feature}
          />
          </div>
          )}
        </div>

        {bestAvailableOutsidePodium && (
          <p className="mt-4 text-center text-sm text-ink-700/70 dark:text-shuttle-100/70">
            Best available right now: <span className="font-semibold text-ink-900 dark:text-shuttle-50">{bestAvailableOutsidePodium.string.name}</span> ({bestAvailableOutsidePodium.matchPercent}
            % match) — {rec.explanations.bestAvailable}
          </p>
        )}

        <StringBasics className="mt-6" />

        <DisclaimerBox className="mt-6" />

        {/* String map — a sibling visualization to the podium, not a replacement; shows where the top 3 sit relative to the rest of the pool. */}
        {mapPool.length > 1 && (
          <section className="mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6 sm:p-7">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400 mb-1">Where they sit</p>
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70 text-center mb-4 max-w-md mx-auto">Your top 3 matches, placed on the feel map against the rest of the lineup.</p>
            <div className="max-w-md mx-auto">
              <StringMap items={mapPool} specialistProfiles={specialistProfiles} useSpecialistData={dataSource === 'manufacturer-specialist'} rankedIds={topThreeIds} />
            </div>
          </section>
        )}

        {/* Conversion — the primary action, framed as the natural next step after seeing a recommendation. */}
        <StringingEnquiry
          stringBrand={featured.string.brand}
          stringName={featured.string.name}
          tensionKg={tension.recommendedKg}
          matchPercent={featured.matchPercent}
          rank={featuredRank}
          dataSourceLabel={DATA_SOURCE_NOTE[dataSource]}
          answers={answers}
          dataSource={dataSource}
        />

        {/* Secondary actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleCompareClick}
            className="focus-ring text-center rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 hover:bg-court-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {selectedForCompare.size > 0 ? `Compare ${selectedForCompare.size} selected` : 'Compare Strings'}
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="focus-ring text-center rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 hover:bg-court-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Retake Quiz
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function TensionOption({ kg, label, highlight }: { kg: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-shuttle-500 text-court-900' : 'bg-white/10 text-white'}`}>
      <p className="font-display font-bold">{formatKg(kg)}</p>
      <p className={`mt-1 leading-tight ${highlight ? 'text-court-900/80' : 'text-white/60'}`}>{label}</p>
    </div>
  )
}
