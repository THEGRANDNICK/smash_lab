import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { recommendStrings, type ScoredString } from '../logic/recommendationEngine'
import { recommendTension } from '../logic/tensionRecommendation'
import { formatKg, formatLbs } from '../logic/units'
import { buildRequestMailto } from '../logic/contactMessage'
import { getSpecialistProfile, type StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { formatGauge } from '../logic/formatGauge'
import { buildStructuredExplanation, buildAlternativeReasons } from '../logic/recommendationExplanation'
import type { QuizAnswers } from '../logic/types'
import type { StringItem } from '../data/strings'
import type { RetailerListing } from '../services/retailerPriceService'
import StatBars from './StatBars'
import StockBadge from './StockBadge'
import Shuttlecock from './Shuttlecock'
import SpecialistPanel from './SpecialistPanel'
import PurchaseOptions from './PurchaseOptions'
import ColorSwatchPreview from './ColorSwatchPreview'

interface RecommendationResultProps {
  answers: QuizAnswers
  onRetake: () => void
  onCompare: () => void
  /** Defaults to the full static catalog (recommendStrings' own default) when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. Never affects scoring, only which stock values are attached to each candidate. */
  pool?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup (recommendStrings' own default) when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). Never affects the scoring math itself, only where the specialist-layer data comes from. */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Display only — never passed to recommendStrings() and never affects scoring. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

export default function RecommendationResult({ answers, onRetake, onCompare, pool, specialistProfiles, retailerListingsByStringId }: RecommendationResultProps) {
  // useMemo avoids recomputing the (pure, but non-trivial) recommendation
  // whenever this component re-renders for an unrelated reason (e.g. the
  // retailer listings map updating after the initial paint) — the inputs
  // here are exactly recommendStrings()'s own parameters, so the result is
  // always identical to calling it directly; this is a rendering
  // optimization only, never a change to what gets computed.
  const rec = useMemo(() => recommendStrings(answers, pool, specialistProfiles), [answers, pool, specialistProfiles])
  const tension = useMemo(() => recommendTension(answers, rec.best.string), [answers, rec.best.string])

  const bestSpecialist = specialistProfiles ? specialistProfiles[rec.best.string.id] : getSpecialistProfile(rec.best.string.id)
  const bestGauge = formatGauge(rec.best.string)
  const bestListings = retailerListingsByStringId?.[rec.best.string.id]

  const bestExplanation = useMemo(() => buildStructuredExplanation(rec.best, rec.explanations.best, bestSpecialist), [rec.best, rec.explanations.best, bestSpecialist])

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
          {/* Very subtle string-bed weave — decorative only, no image asset, static (nothing to reduce for prefers-reduced-motion). */}
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
            <p className="text-shuttle-400 font-semibold text-sm tracking-widest uppercase flex items-center gap-2">🏸 Your Perfect Setup</p>

            <div className="mt-5 flex items-center gap-4">
              <div className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-shuttle-400 leading-none" aria-label={`${rec.best.matchPercent} percent match`}>
                {rec.best.matchPercent}%
              </div>
              <div className="text-lg font-semibold text-white/80">match</div>
            </div>

            <p className="mt-5 text-sm uppercase tracking-wide text-white/50 font-semibold">{rec.best.string.brand}</p>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {rec.best.string.name}
              {bestGauge != null && <span className="text-base font-normal text-white/50 ml-2">{bestGauge}</span>}
            </h1>
            {bestExplanation.playerLevelFit && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                ⭐ {bestExplanation.playerLevelFit}
              </p>
            )}
            {rec.bestAvailable && (
              <p className="mt-2 text-xs font-semibold text-shuttle-400/90 uppercase tracking-wide">Best overall match — order required</p>
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
                <TensionOption kg={tension.higherKg} label="More direct / control" />
              </div>

              {tension.wasCappedByRacketMax && (
                <p className="mt-4 text-xs text-shuttle-400 font-semibold">
                  ⚠️ Capped to stay within your racket's maximum recommended tension ({tension.racketMaxKg} kg).
                </p>
              )}
              <p className="mt-3 text-xs text-white/50">Always stay within the tension range specified by your racket manufacturer.</p>
            </div>
          </div>
        </div>

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

        {/* Best Match detail — the "premium product page" panel: headline,
            manufacturer stats, specialist take, strengths, trade-offs,
            purchase options, all in one place. */}
        <section className="mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 sm:p-7" aria-labelledby="best-match-heading">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 dark:text-shuttle-400">Why this is your best match</p>
              <h2 id="best-match-heading" className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50 mt-1">
                {bestExplanation.headline}
                {bestExplanation.headlineSecondary && <span className="text-ink-700/50 dark:text-shuttle-100/50 font-normal"> · {bestExplanation.headlineSecondary}</span>}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StockBadge stock={rec.best.string.stock} />
              <ColorSwatchPreview item={rec.best.string} size="md" />
            </div>
          </div>

          {bestExplanation.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {bestExplanation.badges.map((badge) => (
                <span
                  key={badge.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-shuttle-100 dark:bg-shuttle-500/15 text-shuttle-700 dark:text-shuttle-400 px-2.5 py-1 text-xs font-semibold"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          <div className="max-w-2xl">
            <p className="mt-4 text-ink-700/80 dark:text-shuttle-100/80">{bestExplanation.paragraph}</p>
            <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">{tension.explanation}</p>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <ExplanationList title="Strengths" icon="✅" items={bestExplanation.strengths} />
            <ExplanationList title="Trade-offs" icon="⚖️" items={bestExplanation.tradeoffs} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50 mb-3">Manufacturer Ratings</h3>
              <StatBars item={rec.best.string} />
            </div>

            <div className="space-y-5">
              {bestSpecialist && <SpecialistPanel profile={bestSpecialist} />}

              {bestListings && bestListings.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50 mb-2">Where to Buy</h3>
                  <PurchaseOptions listings={bestListings} />
                </div>
              ) : (
                <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">No retailer listings available for this string yet.</p>
              )}
            </div>
          </div>
        </section>

        {/* Cross-brand alternative — subtle cool (blue/cyan) accent */}
        {rec.crossBrandAlternative && (
          <AlternativeCard
            title="🌐 Cross-Brand Alternative"
            scored={rec.crossBrandAlternative}
            explanation={rec.explanations.crossBrandAlternative}
            baseline={rec.best}
            specialistProfiles={specialistProfiles}
            variant="cross-brand"
          />
        )}

        {/* Specialist choice — subtle gold accent */}
        {rec.specialistChoice && (
          <AlternativeCard
            title="⭐ Specialist Choice"
            scored={rec.specialistChoice}
            explanation={rec.explanations.specialistChoice}
            baseline={rec.best}
            specialistProfiles={specialistProfiles}
            variant="specialist"
            compact
          />
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={buildRequestMailto(rec.best.string.name, tension.recommendedKg)}
            className="focus-ring text-center rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
          >
            Choose This Setup
          </a>
          <button
            type="button"
            onClick={onCompare}
            className="focus-ring text-center rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 hover:bg-court-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Compare Strings
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

function ExplanationList({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50 mb-2">
        {icon} {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-ink-700/80 dark:text-shuttle-100/80">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type AlternativeVariant = 'cross-brand' | 'specialist'

/** Subtle accent per alternative type — a left border stripe + matching title color, not a fully-colored card, so both stay clearly subordinate to the Best Match panel and part of the same design system. */
const VARIANT_ACCENT: Record<AlternativeVariant, { border: string; title: string }> = {
  'cross-brand': { border: 'border-l-4 border-l-sky-500/60 dark:border-l-sky-400/50', title: 'text-sky-700 dark:text-sky-400' },
  specialist: { border: 'border-l-4 border-l-shuttle-500/70 dark:border-l-shuttle-400/60', title: 'text-shuttle-700 dark:text-shuttle-400' },
}

function AlternativeCard({
  title,
  scored,
  explanation,
  baseline,
  specialistProfiles,
  variant,
  compact,
}: {
  title: string
  scored: ScoredString
  explanation?: string
  baseline: ScoredString
  specialistProfiles?: Record<string, StringSpecialistProfile>
  variant: AlternativeVariant
  compact?: boolean
}) {
  const profile = specialistProfiles ? specialistProfiles[scored.string.id] : getSpecialistProfile(scored.string.id)
  const baselineProfile = specialistProfiles ? specialistProfiles[baseline.string.id] : getSpecialistProfile(baseline.string.id)
  const reasons = useMemo(() => buildAlternativeReasons(scored, baseline, profile, baselineProfile), [scored, baseline, profile, baselineProfile])
  const accent = VARIANT_ACCENT[variant]

  return (
    <div
      className={`mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 ${accent.border} p-6 ${compact ? 'bg-white/40 dark:bg-white/5' : 'bg-white/60 dark:bg-white/5'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${accent.title}`}>{title}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <h4 className="font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">
              {scored.string.brand} {scored.string.name}
            </h4>
            <span className="text-shuttle-600 font-bold">{scored.matchPercent}% Match</span>
          </div>
        </div>
        <ColorSwatchPreview item={scored.string} size="sm" />
      </div>
      {explanation && <p className="mt-2 text-ink-700/80 dark:text-shuttle-100/80 text-sm max-w-2xl">{explanation}</p>}
      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-700/70 dark:text-shuttle-100/70">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true">↳</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
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
