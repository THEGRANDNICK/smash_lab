import { useState } from 'react'
import type { StringItem } from '../data/strings'
import type { SpecialistDimensionKey, StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { CONTACT } from '../data/contact'
import { buildEnquiryWhatsAppUrl } from '../logic/contactMessage'
import { formatGauge } from '../logic/formatGauge'
import { provenanceOf, HANDS_ON_PROPERTY_COUNT } from '../logic/provenance'
import { SHELF_COLOR, SHELVES, shelfOf } from '../logic/setupStats'
import { recommendTension } from '../logic/tensionRecommendation'
import { formatKg, formatLbs } from '../logic/units'
import { writeWorkshopPreset } from '../logic/workshopPreset'
import { AXIS_EXPLANATION, PERFORMANCE_AXES, PERFORMANCE_MAX, getPerformanceValues } from './performanceAxes'
import ImageSwiper from './ImageSwiper'
import SpecialistPanel from './SpecialistPanel'
import StringBasics from './StringBasics'
import StringFeedback from './StringFeedback'

interface StringDetailProps {
  stringId: string
  strings: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  retailerListingsByStringId?: Record<string, RetailerListing[]>
  onBrowse: () => void
  onCompare: () => void
  onQuiz: () => void
}

const HANDS_ON: { key: SpecialistDimensionKey; label: string }[] = [
  { key: 'easyPower', label: 'Power' },
  { key: 'controlPrecision', label: 'Control' },
  { key: 'shuttleGripHold', label: 'Grip' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'normalWearDurability', label: 'Durability' },
]

const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Club player' },
  { id: 'tournament', label: 'Tournament' },
]

/** The first sentence of a description — the page starts short; the rest is one tap away. */
function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

/**
 * One string on its own page (/strings/<id>/) — usually the first page people see, because Google
 * sends them here. Same workbench look as the rest: the reel, the packet's ratings, the hands-on
 * ratings with their source, which tension to string it at, and a direct way into the Workshop.
 */
export default function StringDetail({ stringId, strings, specialistProfiles, onBrowse, onQuiz }: StringDetailProps) {
  const item = strings.find((s) => s.id === stringId)
  const [copied, setCopied] = useState(false)
  const [moreText, setMoreText] = useState(false)

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">This string isn't in the lineup</h1>
        <p className="mt-2 text-ink-700/70 dark:text-shuttle-100/70">The link may be outdated. Browse the current lineup to find it or a close alternative.</p>
        <button type="button" onClick={onBrowse} className="focus-ring mt-6 rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 cursor-pointer">
          Browse strings
        </button>
      </div>
    )
  }

  const profile = specialistProfiles?.[item.id]
  const provenance = provenanceOf(profile)
  const shelf = shelfOf(item, profile)
  const shelfInfo = SHELVES.find((s) => s.id === shelf)
  const maker = getPerformanceValues(item)
  const text = item.notes ?? ''
  const short = firstSentence(text)
  const tensions = LEVELS.map((l) => ({ ...l, kg: recommendTension({ level: l.id }, item).recommendedKg }))
  const whatsAppUrl = buildEnquiryWhatsAppUrl({ stringName: `${item.brand} ${item.name}`, tensionKg: tensions[1].kg, dataSourceLabel: 'String page' })

  function tryInWorkshop() {
    writeWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage, { stringId: item!.id, tensionKg: tensions[1].kg })
    window.location.hash = 'workshop'
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — nothing else to do
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <button type="button" onClick={onBrowse} className="focus-ring text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer">
        ← All strings
      </button>

      {/* the string itself */}
      <section className="paper deal mt-4 p-5 sm:p-7 flex flex-col sm:flex-row gap-5 sm:gap-7 items-center sm:items-start">
        <div className="w-40 sm:w-48 shrink-0">
          <ImageSwiper front={item.imageUrl} back={item.imageBackUrl} label={`${item.brand} ${item.name}`} placeholderText={item.name} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <span className="tape">{item.brand}</span>
          <h1 className="mt-3 font-display text-4xl font-bold leading-none text-ink-900 dark:text-shuttle-50">{item.name}</h1>
          <p className="mt-2 flex flex-wrap justify-center sm:justify-start items-center gap-x-3 gap-y-1 text-sm text-ink-700/80 dark:text-shuttle-100/80">
            <span>{formatGauge(item) ?? 'hybrid'}</span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: SHELF_COLOR[shelf] }} />
              {shelfInfo?.label}
            </span>
            {item.popularityRank != null && <span>★ Popular at the club</span>}
          </p>
          {short && <p className="mt-3 text-ink-700/90 dark:text-shuttle-100/90">{short}</p>}
          <div className="mt-5 flex flex-wrap justify-center sm:justify-start gap-2">
            <button type="button" onClick={tryInWorkshop} data-sound="pluck" className="press focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold px-5 py-2.5 cursor-pointer">
              Try in Workshop
            </button>
            <button type="button" onClick={onQuiz} className="press focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-5 py-2.5 text-ink-900 dark:text-shuttle-50 cursor-pointer">
              Does it suit me?
            </button>
          </div>
        </div>
      </section>

      {/* ratings: packet and hands-on, side by side */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <section className="paper p-5" aria-labelledby="maker-ratings">
          <h2 id="maker-ratings" className="font-display font-bold text-ink-900 dark:text-shuttle-50">On the packet</h2>
          <p className="text-xs text-ink-700/70 dark:text-shuttle-100/70">Manufacturer ratings, 0–{PERFORMANCE_MAX}</p>
          <ul className="mt-3 space-y-2">
            {PERFORMANCE_AXES.map((a) => {
              const v = maker[a.key]
              return (
                <li key={a.key} className="grid grid-cols-[7.5rem_1fr_1.5rem] items-center gap-2 text-sm" title={AXIS_EXPLANATION[a.key]}>
                  <span className="text-ink-700/90 dark:text-shuttle-100/90">
                    <span aria-hidden="true">{a.emoji}</span> {a.key === 'repulsion' ? 'Power' : a.label}
                  </span>
                  <span className="h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
                    <span className="block h-full rounded-full bg-shuttle-500" style={{ width: `${v == null ? 0 : (v / PERFORMANCE_MAX) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-ink-700/80 dark:text-shuttle-100/80">{v ?? '–'}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="paper p-5" aria-labelledby="hands-on-ratings">
          <h2 id="hands-on-ratings" className="font-display font-bold text-ink-900 dark:text-shuttle-50">Hands-on</h2>
          <p className="text-xs text-ink-700/70 dark:text-shuttle-100/70">
            {provenance.ratedCount} of {HANDS_ON_PROPERTY_COUNT} rated{provenance.source ? ` · ${provenance.source}` : ''}{provenance.confidence ? ` · ${provenance.confidence}` : ''} · 1–5
          </p>
          {provenance.ratedCount === 0 ? (
            <p className="mt-3 text-sm text-ink-700/80 dark:text-shuttle-100/80">No hands-on ratings yet — the packet is all we have for now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {HANDS_ON.map(({ key, label }) => {
                const v = profile?.dimensions[key]
                return (
                  <li key={key} className="grid grid-cols-[7.5rem_1fr_1.5rem] items-center gap-2 text-sm">
                    <span className="text-ink-700/90 dark:text-shuttle-100/90">{label}</span>
                    <span className="h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
                      {v != null && <span className="block h-full rounded-full bg-court-600 dark:bg-shuttle-400" style={{ width: `${(v / 5) * 100}%` }} />}
                    </span>
                    <span className="text-right tabular-nums text-ink-700/80 dark:text-shuttle-100/80">{v ?? '–'}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* which tension — what people coming from Google usually want to know */}
      <section className="paper mt-5 p-5" aria-labelledby="which-tension">
        <h2 id="which-tension" className="font-display font-bold text-ink-900 dark:text-shuttle-50">Which tension for {item.name}?</h2>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
          {tensions.map((t) => (
            <li key={t.id} className="rounded-xl border-2 border-court-900/10 dark:border-white/15 p-3">
              <span className="block text-xs text-ink-700/70 dark:text-shuttle-100/70">{t.label}</span>
              <span className="block font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">{formatKg(t.kg)}</span>
              <span className="block text-[11px] text-ink-700/70 dark:text-shuttle-100/70">≈ {formatLbs(t.kg)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-700/80 dark:text-shuttle-100/80">
          Starting points — always stay below your racket's maximum. Tournament players can go higher (up to about 13.6 kg / 30 lb) if their racket allows it; the Workshop checks that for you.
        </p>
      </section>

      {/* the full story, for those who want it */}
      {text.length > short.length && (
        <section className="paper mt-5 p-5" aria-labelledby="about-string">
          <h2 id="about-string" className="font-display font-bold text-ink-900 dark:text-shuttle-50">About {item.name}</h2>
          <p className="mt-2 text-sm text-ink-700/90 dark:text-shuttle-100/90">{moreText ? text : `${text.slice(0, 220).trimEnd()}…`}</p>
          <button type="button" onClick={() => setMoreText((v) => !v)} className="focus-ring mt-2 text-sm font-semibold text-court-800 dark:text-shuttle-400 underline underline-offset-4 cursor-pointer">
            {moreText ? 'Show less' : 'Read more'}
          </button>
          {profile && (
            <div className="mt-4">
              <SpecialistPanel profile={profile} />
            </div>
          )}
        </section>
      )}

      <StringFeedback stringId={item.id} stringName={item.name} />

      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        {whatsAppUrl && (
          <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="press focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-5 py-2.5 text-ink-900 dark:text-shuttle-50">
            💬 Ask {CONTACT.name} · WhatsApp
          </a>
        )}
        <button type="button" onClick={copyLink} aria-live="polite" className="press focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-5 py-2.5 text-ink-900 dark:text-shuttle-50 cursor-pointer">
          {copied ? '✓ Link copied' : 'Copy link'}
        </button>
      </div>

      <StringBasics className="mt-8" />
    </div>
  )
}
