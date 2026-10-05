import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildEnquiryWhatsAppUrl } from '../logic/contactMessage'
import { encodeResultShareState } from '../logic/resultShareState'
import { play } from '../logic/sound'
import { recommendStrings } from '../logic/recommendationEngine'
import { recommendTension } from '../logic/tensionRecommendation'
import { formatKg, formatLbs } from '../logic/units'
import { formatGauge } from '../logic/formatGauge'
import { buildPodiumAlternativeReason, buildPodiumBestReason } from '../logic/recommendationExplanation'
import { getSpecialistProfile } from '../data/stringSpecialistProfiles'
import { DATA_SOURCE_NOTE, type DataSource } from '../logic/dataSourcePreference'
import ImageSwiper from './ImageSwiper'
import RacketMaxInput from './RacketMaxInput'
import { writeWorkshopPreset } from '../logic/workshopPreset'
import { HANDS_ON_PROPERTY_COUNT, provenanceOf } from '../logic/provenance'
import { CONTACT } from '../data/contact'
import { hasScoringAnswer } from '../logic/inTheRunning'
import { getQuestion } from '../data/quizQuestions'
import { TensionFields } from './TensionTuner'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { QuizAnswers } from '../logic/types'
import type { StringItem } from '../data/strings'
import type { RetailerListing } from '../services/retailerPriceService'
import DisclaimerBox from './DisclaimerBox'
import StringMap from './StringMap'
import RecommendationPodium, { PODIUM_COMPARE_LIMIT } from './RecommendationPodium'
import StringingEnquiry from './StringingEnquiry'
import StringBasics from './StringBasics'
import AnswerTree from './AnswerTree'

interface RecommendationResultProps {
  answers: QuizAnswers
  /** Lets the optional tension panel update racket details; omitted → the panel isn't shown (e.g. opened from a share link). */
  onChangeAnswers?: (next: QuizAnswers) => void
  /** Set after the quick quiz: offers the four extra questions of the detailed quiz. */
  onGoDetailed?: () => void
  /** From a shared link: the string the sender had chosen to show. */
  initialFeaturedId?: string
  onRetake: () => void
  onCompare: () => void
  dataSource: DataSource
  /** Defaults to the full static catalog (recommendStrings' own default) when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. Never affects scoring, only which stock values are attached to each candidate. */
  pool?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup (recommendStrings' own default) when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). Never affects the scoring math itself, only where the specialist-layer data comes from. */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Display only — never passed to recommendStrings() and never affects scoring. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

export default function RecommendationResult({ answers, onChangeAnswers, onGoDetailed, initialFeaturedId, onRetake, onCompare, dataSource, pool, specialistProfiles, retailerListingsByStringId }: RecommendationResultProps) {
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
  const [featuredId, setFeaturedId] = useState<string | null>(initialFeaturedId ?? null)
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

  function feature(id: string) {
    setFeaturedId(id === rec.best.string.id ? null : id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  // A short two-note pluck when a result is revealed.
  const encodedResult = useMemo(
    () => encodeResultShareState(answers, dataSource, featuredId && featuredId !== rec.best.string.id ? featuredId : undefined),
    [answers, dataSource, featuredId, rec.best.string.id],
  )
  useEffect(() => {
    play('reveal')
  }, [rec.best.string.id])

  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  async function shareResult() {
    const url = `${window.location.origin}${window.location.pathname}#result/${encodedResult}`
    const text = `My Smash Lab string: ${featured.string.brand} ${featured.string.name} at ${formatKg(tension.recommendedKg)}`
    try {
      if (navigator.share) await navigator.share({ title: 'Smash Lab', text, url })
      else {
        await navigator.clipboard.writeText(url)
        setShareState('copied')
        window.setTimeout(() => setShareState('idle'), 2000)
      }
    } catch {
      // Share sheet dismissed or clipboard blocked — nothing to do.
    }
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

  /** Comparing happens in the Setup Workshop now: racket A with the shown string, racket B with the first other pick. */
  function handleCompareClick() {
    const picked = [...selectedForCompare]
    const a = picked[0] ?? featured.string.id
    const b = picked.find((id) => id !== a) ?? rec.topThree.map((s) => s.string.id).find((id) => id !== a)
    writeWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage, { stringId: a, compareStringId: b, tensionKg: tension.recommendedKg, racketMaxKg })
    window.location.hash = 'workshop'
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

  const racketMaxKg = answers.maxTensionKnown === 'yes' && typeof answers.maxTensionValue === 'number' ? answers.maxTensionValue : undefined
  const tensionIsProvisional = racketMaxKg == null
  const whatsAppUrl = buildEnquiryWhatsAppUrl({
    stringName: `${featured.string.brand} ${featured.string.name}`,
    tensionKg: tension.recommendedKg,
    racketMaxKg,
    matchPercent: featured.matchPercent,
    dataSourceLabel: DATA_SOURCE_NOTE[dataSource],
    rank: featuredRank,
  })

  // Honest ranking language: a score gap, not a probability (gap thresholds from scripts/analysis/robustness.mts).
  const lead = rec.ranked.length > 1 ? rec.ranked[0].matchPercent - rec.ranked[1].matchPercent : 99
  const rankingLabel = !hasScoringAnswer(answers)
    ? 'General preselection'
    : lead >= 6
      ? 'Clear lead in the ranking'
      : lead >= 3
        ? 'Ahead in the ranking'
        : 'Close call in the ranking'

  const others = rec.topThree.filter((s) => s.string.id !== featured.string.id)
  const featuredProvenance = provenanceOf(specialistProfiles?.[featured.string.id])

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* 1 — the result itself: string + tension, nothing else */}
      <section className="paper deal relative overflow-hidden rounded-3xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isRecommended ? (
              <span
                className="stamp rounded-md border-2 border-shuttle-700 dark:border-shuttle-400 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-shuttle-700 dark:text-shuttle-400"
                title={`Model score ${featured.matchPercent} — a ranking score, not a probability`}
              >
                {rankingLabel}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="pop-in rounded-md border-2 border-court-800/40 dark:border-white/30 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-ink-700 dark:text-shuttle-100">
                  Your #{featuredRank} pick
                </span>
                <button type="button" onClick={() => feature(rec.best.string.id)} className="focus-ring text-xs font-semibold text-court-800 dark:text-shuttle-400 underline underline-offset-4 cursor-pointer">
                  ↩ Back to recommended
                </button>
              </div>
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">{featured.string.brand}</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-none text-ink-900 dark:text-shuttle-50">
              {featured.string.name}
              {featuredGauge != null && <span className="ml-2 align-middle text-base font-normal text-ink-700/70 dark:text-shuttle-100/70">{featuredGauge}</span>}
            </h1>
          </div>
          <div className="w-24 sm:w-28 shrink-0 rotate-3">
            <ImageSwiper front={featured.string.imageUrl} back={featured.string.imageBackUrl} label={`${featured.string.brand} ${featured.string.name}`} placeholderText={featured.string.name} />
          </div>
        </div>
        <p className="mt-3 text-ink-700/90 dark:text-shuttle-100/90">{heroReason}</p>
        {featuredProvenance.thin && (
          <p className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">
            Mostly based on manufacturer data — only {featuredProvenance.ratedCount} of {HANDS_ON_PROPERTY_COUNT} properties have hands-on ratings so far.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 border-t border-dashed border-court-900/20 dark:border-white/20 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">Tension{tensionIsProvisional ? ' · provisional' : ''}</span>
          <span className="font-display text-3xl font-bold text-ink-900 dark:text-shuttle-50">{formatKg(tension.recommendedKg)}</span>
          <span className="text-ink-700/70 dark:text-shuttle-100/70">≈ {formatLbs(tension.recommendedKg)}</span>
        </div>
        {!answers.level && <p className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">You skipped your level, so this is the tension for a typical club player.</p>}

        {/* Racket maximum: checked right here, not hidden in a fold — the default is only an assumption. */}
        {answers.maxTensionKnown === 'yes' && typeof answers.maxTensionValue === 'number' ? (
          <p className="mt-3 text-sm font-semibold text-court-700 dark:text-shuttle-400">
            ✓ Within your racket's maximum of {answers.maxTensionValue.toFixed(1)} kg ({Math.round(answers.maxTensionValue / 0.45359237)} lbs).
          </p>
        ) : (
          <div role="note" className="mt-3 rounded-xl border-2 border-amber-500/70 bg-amber-500/10 p-3 text-sm">
            <p className="font-semibold text-ink-900 dark:text-shuttle-50">Check your racket's maximum before stringing.</p>
            <p className="mt-0.5 text-ink-700/90 dark:text-shuttle-100/90">
              It's printed on the shaft or near the T-joint, e.g. “20–28 lbs” — enter the higher number, in kg or lbs. We assumed 12.5 kg (common for Yonex); some beginner rackets allow only 9–10 kg.
            </p>
            {onChangeAnswers && <RacketMaxInput className="mt-2" onChange={(kg) => onChangeAnswers({ ...answers, maxTensionKnown: 'yes', maxTensionValue: kg })} />}
          </div>
        )}
        <p className="mt-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">
          {formatKg(tension.lowerKg)} for easier power{tension.higherKg != null ? ` · ${formatKg(tension.higherKg)} for more control` : ''}
          {tension.wasCappedByRacketMax ? ` · capped at your racket's max (${tension.racketMaxKg} kg)` : ''}
        </p>
        {isRecommended && rec.bestAvailable && (
          <p className="mt-3 text-xs font-semibold text-shuttle-700 dark:text-shuttle-400">Not in stock right now — best available: {rec.bestAvailable.string.name} ({rec.bestAvailable.matchPercent}%)</p>
        )}

        {/* The action that matters sits in the card itself — visible as soon as the result appears, no scrolling. */}
        <div className="mt-5 flex gap-2">
          {whatsAppUrl && (
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" data-sound="pluck" className="press focus-ring flex-1 rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 text-center font-bold py-3">
              💬 Ask {CONTACT.name} · WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={shareResult}
            className="press focus-ring rounded-full border-2 border-court-900/20 dark:border-white/25 px-4 font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
          >
            {shareState === 'copied' ? '✓ Link copied' : '↗ Share'}
          </button>
        </div>
      </section>

      {/* into the Setup Workshop with this exact build, to play around with racket, string and tension */}
      <button
        type="button"
        onClick={() => {
          writeWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage, { stringId: featured.string.id, tensionKg: tension.recommendedKg, racketMaxKg })
          window.location.hash = 'workshop'
        }}
        className="paper press focus-ring mt-4 w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
      >
        <span>
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50">Tweak this setup in the Workshop</span>
          <span className="block text-sm text-ink-700/80 dark:text-shuttle-100/80">Try another racket balance, string or tension and see what changes.</span>
        </span>
        <span aria-hidden="true" className="text-xl text-shuttle-700 dark:text-shuttle-400">→</span>
      </button>

      {/* 2 — the alternatives, one line each, one tap to show them at the top */}
      <section aria-labelledby="alternatives-heading" className="mt-6">
        <h2 id="alternatives-heading" className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">
          {isRecommended ? 'Also a good fit' : 'Your other matches'}
        </h2>
        <ul className="mt-2 space-y-2.5">
          {others.map((s, i) => {
            const isBest = s.string.id === rec.best.string.id
            const why = isBest ? 'Your best match overall.' : buildPodiumAlternativeReason(s, rec.best, profileOf(s.string.id), bestProfile)
            return (
              <li key={s.string.id} className="deal" style={{ ['--deal-i' as string]: i + 2 }}>
                <button
                  type="button"
                  onClick={() => feature(s.string.id)}
                  data-sound="flick"
                  className="paper press focus-ring w-full rounded-2xl px-4 py-3 text-left flex items-center gap-3 cursor-pointer"
                >
                  <span className="reel block h-12 w-12 shrink-0 !p-[10px]" aria-hidden="true">
                    <span className="reel-core grid place-items-center overflow-hidden">
                      {s.string.imageUrl ? <img src={s.string.imageUrl} alt="" className="h-full w-full object-contain p-[12%]" loading="lazy" /> : <span className="font-display text-[9px] font-bold text-ink-900 whitespace-nowrap">{s.string.name.split(' ')[0]}</span>}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-ink-900 dark:text-shuttle-50">{s.string.name}</span>
                      <span className="text-xs tabular-nums text-ink-700/70 dark:text-shuttle-100/70" title="Model score — a ranking score, not a probability">
                        {rec.ranked[0].matchPercent - s.matchPercent <= 2 ? 'close · ' : ''}score {s.matchPercent}
                      </span>
                    </span>
                    <span className="block text-sm text-ink-700/80 dark:text-shuttle-100/80 truncate">{why}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 3 — everything else, closed until asked for */}
      {onGoDetailed && (
        <button
          type="button"
          onClick={onGoDetailed}
          className="paper press focus-ring mt-6 w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
        >
          <span>
            <span className="block font-semibold text-ink-900 dark:text-shuttle-50">Want it more precise?</span>
            <span className="block text-sm text-ink-700/80 dark:text-shuttle-100/80">4 more questions — your answers so far are kept.</span>
          </span>
          <span aria-hidden="true" className="text-xl text-shuttle-700 dark:text-shuttle-400">→</span>
        </button>
      )}

      <div className="mt-6 space-y-2.5">
        {onChangeAnswers && (
          <Fold title="Fine-tune: your power, mishits & racket">
            <FineTune answers={answers} onChange={onChangeAnswers} />
          </Fold>
        )}
        <Fold title={isRecommended ? `Why ${featured.string.name}` : 'Details and comparison'}>
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
          <div className="mt-4 text-center">
            <button type="button" onClick={handleCompareClick} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-5 py-2 text-sm font-semibold cursor-pointer">
              {selectedForCompare.size > 0 ? `Compare ${selectedForCompare.size} selected` : 'Compare strings'}
            </button>
          </div>
        </Fold>
        <Fold title="How your answers led here">
          <AnswerTree answers={answers} pool={pool} specialistProfiles={specialistProfiles} featuredId={featured.string.id} onFeature={feature} />
        </Fold>
        {mapPool.length > 1 && (
          <Fold title="Where they sit on the feel map">
            <div className="max-w-md mx-auto">
              <StringMap items={mapPool} specialistProfiles={specialistProfiles} useSpecialistData={dataSource === 'manufacturer-specialist'} rankedIds={topThreeIds} />
            </div>
          </Fold>
        )}
        <Fold title="Ask a question or add your racket">
          <StringingEnquiry
            racketMaxKg={racketMaxKg}
            stringBrand={featured.string.brand}
            stringName={featured.string.name}
            tensionKg={tension.recommendedKg}
            matchPercent={featured.matchPercent}
            rank={featuredRank}
            dataSourceLabel={DATA_SOURCE_NOTE[dataSource]}
            answers={answers}
            dataSource={dataSource}
          />
        </Fold>
        <Fold title="About this result">
          <p className="text-sm">{DATA_SOURCE_NOTE[dataSource]}</p>
          {bestAvailableOutsidePodium && (
            <p className="mt-3 text-sm text-ink-700/80 dark:text-shuttle-100/80">
              Best available right now: <strong>{bestAvailableOutsidePodium.string.name}</strong> ({bestAvailableOutsidePodium.matchPercent}% match) — {rec.explanations.bestAvailable}
            </p>
          )}
          <StringBasics className="mt-4" />
          <DisclaimerBox className="mt-4" />
        </Fold>
      </div>

      <div className="mt-8 text-center">
        <button type="button" onClick={onRetake} className="focus-ring text-sm font-semibold text-court-800 dark:text-shuttle-400 underline underline-offset-4 cursor-pointer">
          Retake the quiz
        </button>
      </div>

    </div>
  )
}

/**
 * The questions the 4-round quiz leaves out — optional, here on the result, updating it live:
 * own power, mishit breakage, and the racket/tension details.
 */
function FineTune({ answers, onChange }: { answers: QuizAnswers; onChange: (next: QuizAnswers) => void }) {
  const power = getQuestion('powerGeneration')
  return (
    <div className="space-y-5">
      {power && (
        <fieldset>
          <legend className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">{power.title}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {power.options.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={answers.powerGeneration === o.id}
                onClick={() => onChange({ ...answers, powerGeneration: answers.powerGeneration === o.id ? undefined : o.id })}
                className={`press focus-ring rounded-full border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer ${
                  answers.powerGeneration === o.id ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer">
        <input
          type="checkbox"
          checked={answers.restringReason === 'mishitBreakage'}
          onChange={(e) => onChange({ ...answers, restringReason: e.target.checked ? 'mishitBreakage' : undefined })}
          className="h-4 w-4 accent-shuttle-500"
        />
        My strings often break from mishits
      </label>
      <TensionFields answers={answers} onChange={onChange} showRacketMax={false} />
    </div>
  )
}

/** A closed-by-default paper fold for everything that isn't the result itself. */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="paper group rounded-2xl">
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 font-semibold text-ink-900 dark:text-shuttle-50 [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-shuttle-700 dark:text-shuttle-400 transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}
