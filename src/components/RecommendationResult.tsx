import { motion } from 'framer-motion'
import { recommendStrings } from '../logic/recommendationEngine'
import { recommendTension } from '../logic/tensionRecommendation'
import { formatKg, formatLbs } from '../logic/units'
import { buildRequestMailto } from '../logic/contactMessage'
import { getSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { QuizAnswers } from '../logic/types'
import StatBars from './StatBars'
import StockBadge from './StockBadge'
import Shuttlecock from './Shuttlecock'
import SpecialistPanel from './SpecialistPanel'

interface RecommendationResultProps {
  answers: QuizAnswers
  onRetake: () => void
  onCompare: () => void
}

const STRENGTH_EMOJI: Record<string, string> = {
  repulsion: '⚡ Quick Repulsion',
  control: '🎯 Excellent Control',
  durability: '💪 Good Durability',
  hittingSound: '🔊 Crisp Hitting Sound',
  shockAbsorption: '🤲 Great Comfort',
}

export default function RecommendationResult({ answers, onRetake, onCompare }: RecommendationResultProps) {
  const rec = recommendStrings(answers)
  const tension = recommendTension(answers, rec.best.string)
  const bestSpecialist = getSpecialistProfile(rec.best.string.id)

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        {/* Hero result card, styled like a match result / player card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-court-900 via-court-800 to-court-700 text-white px-6 py-10 sm:px-10 sm:py-12 shadow-2xl">
          <div className="absolute inset-0 court-lines opacity-30" aria-hidden="true" />
          <motion.div
            className="absolute top-6 right-6 text-shuttle-400/40"
            animate={{ rotate: [0, 10, -10, 0], y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <Shuttlecock className="w-20 h-20" />
          </motion.div>

          <div className="relative">
            <p className="text-shuttle-400 font-semibold text-sm tracking-widest uppercase flex items-center gap-2">🏸 Your Perfect Setup</p>

            <div className="mt-4 flex items-center gap-4">
              <div className="text-5xl sm:text-6xl font-display font-bold text-shuttle-400">{rec.best.matchPercent}%</div>
              <div className="text-lg font-semibold text-white/80">match</div>
            </div>

            <p className="mt-4 text-sm uppercase tracking-wide text-white/50 font-semibold">{rec.best.string.brand}</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">
              {rec.best.string.name}
              {rec.best.string.tension?.gauge != null && (
                <span className="text-base font-normal text-white/50 ml-2">{rec.best.string.tension.gauge}mm</span>
              )}
            </h2>
            {rec.bestAvailable && (
              <p className="mt-1 text-xs font-semibold text-shuttle-400/90 uppercase tracking-wide">Best overall match — order required</p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {rec.best.topDimensions.map((d) => (
                <span key={d} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                  {STRENGTH_EMOJI[d]}
                </span>
              ))}
            </div>

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

        {/* Why this setup */}
        <div className="mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-display text-lg font-semibold text-ink-900 dark:text-shuttle-50">Why this setup?</h3>
            <StockBadge stock={rec.best.string.stock} />
          </div>
          <p className="mt-2 text-ink-700/80 dark:text-shuttle-100/80">{rec.explanations.best}</p>
          <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">{tension.explanation}</p>

          <div className="mt-5">
            <StatBars item={rec.best.string} />
          </div>

          {bestSpecialist && (
            <div className="mt-5">
              <SpecialistPanel profile={bestSpecialist} />
            </div>
          )}
        </div>

        {/* Cross-brand alternative */}
        {rec.crossBrandAlternative && (
          <div className="mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6">
            <p className="text-sm font-semibold text-ink-700/60 dark:text-shuttle-100/60">🌐 Cross-Brand Alternative</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h4 className="font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">
                {rec.crossBrandAlternative.string.brand} {rec.crossBrandAlternative.string.name}
              </h4>
              <span className="text-shuttle-600 font-bold">{rec.crossBrandAlternative.matchPercent}% Match</span>
            </div>
            <p className="mt-2 text-ink-700/80 dark:text-shuttle-100/80">{rec.explanations.crossBrandAlternative}</p>
          </div>
        )}

        {/* Specialist choice */}
        {rec.specialistChoice && (
          <div className="mt-4 rounded-2xl border border-court-900/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-5">
            <p className="text-sm font-semibold text-ink-700/60 dark:text-shuttle-100/60">
              ⭐ Specialist Choice — {rec.specialistChoice.string.name} ({rec.specialistChoice.matchPercent}% Match)
            </p>
            <p className="mt-1 text-ink-700/80 dark:text-shuttle-100/80 text-sm">{rec.explanations.specialistChoice}</p>
          </div>
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

function TensionOption({ kg, label, highlight }: { kg: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-shuttle-500 text-court-900' : 'bg-white/10 text-white'}`}>
      <p className="font-display font-bold">{formatKg(kg)}</p>
      <p className={`mt-1 leading-tight ${highlight ? 'text-court-900/80' : 'text-white/60'}`}>{label}</p>
    </div>
  )
}
