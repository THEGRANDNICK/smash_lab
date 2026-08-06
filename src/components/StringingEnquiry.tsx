import { useState } from 'react'
import { buildEnquiryMailto, buildEnquiryWhatsAppUrl, buildResultSummaryText } from '../logic/contactMessage'
import { formatKg } from '../logic/units'
import { writeSavedSetup, type SavedSetup } from '../logic/savedSetup'
import { encodeResultShareState } from '../logic/resultShareState'
import type { DataSource } from '../logic/dataSourcePreference'
import type { QuizAnswers } from '../logic/types'

interface StringingEnquiryProps {
  stringBrand: string
  stringName: string
  tensionKg: number
  matchPercent: number
  dataSourceLabel: string
  /** The exact quiz answers + data-source choice that produced this result — encoded into the "Share result" link so opening it recomputes the identical recommendation client-side. Never written anywhere but the URL itself. */
  answers: QuizAnswers
  dataSource: DataSource
}

/**
 * The result page's primary conversion path — Part 3's "Stringing
 * enquiry" / "Request this setup" action. Deliberately framed as the
 * natural next step after seeing a recommendation ("Want this setup in
 * your racket?"), not a bolted-on second CTA. Racket model and the note
 * only ever live in this component's own state — they're read into a
 * message body at the moment the player taps Send/Copy, never stored or
 * transmitted anywhere before that.
 */
export default function StringingEnquiry({ stringBrand, stringName, tensionKg, matchPercent, dataSourceLabel, answers, dataSource }: StringingEnquiryProps) {
  const [racketModel, setRacketModel] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const fullName = `${stringBrand} ${stringName}`
  const details = { stringName: fullName, tensionKg, matchPercent, dataSourceLabel, racketModel: racketModel.trim() || undefined, note: note.trim() || undefined }
  const whatsAppUrl = buildEnquiryWhatsAppUrl(details)
  const mailtoUrl = buildEnquiryMailto(details)

  async function handleCopy() {
    const text = buildResultSummaryText(details)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied by the browser/embedded context — the
      // summary is still visible in the message preview below, so this is a
      // soft failure, not a broken page.
    }
  }

  async function handleShare() {
    if (typeof window === 'undefined') return
    const encoded = encodeResultShareState(answers, dataSource)
    const url = `${window.location.origin}${window.location.pathname}#result/${encoded}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Same soft-failure reasoning as handleCopy() above.
    }
  }

  function handleSaveSetup() {
    const setup: SavedSetup = {
      stringBrand,
      stringName,
      tensionKg,
      matchPercent,
      dataSourceLabel,
      racketModel: racketModel.trim() || undefined,
      savedAt: new Date().toISOString(),
    }
    writeSavedSetup(typeof window === 'undefined' ? null : window.localStorage, setup)
    setSaved(true)
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-shuttle-500/40 bg-shuttle-100/50 dark:bg-shuttle-500/10 p-6 sm:p-7" aria-labelledby="enquiry-heading">
      <h2 id="enquiry-heading" className="font-display text-xl sm:text-2xl font-bold text-ink-900 dark:text-shuttle-50">
        Ready to try this setup?
      </h2>
      <p className="mt-1 text-sm text-ink-700/70 dark:text-shuttle-100/70">
        Need {fullName} at {formatKg(tensionKg)} professionally strung? Contact Nick in Heidelberg via WhatsApp or email — no account needed, nothing
        is sent until you tap Send.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Racket model (optional)</span>
          <input
            type="text"
            value={racketModel}
            onChange={(e) => setRacketModel(e.target.value)}
            placeholder="e.g. Yonex Astrox 88D"
            className="focus-ring mt-1 w-full rounded-xl border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Additional note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else worth knowing?"
            className="focus-ring mt-1 w-full rounded-xl border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {whatsAppUrl && (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-center rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
          >
            💬 Send via WhatsApp
          </a>
        )}
        <a
          href={mailtoUrl}
          className={`focus-ring text-center rounded-full font-bold px-6 py-3 transition-colors cursor-pointer ${
            whatsAppUrl ? 'border-2 border-court-900/15 dark:border-white/20 hover:bg-court-900/5 dark:hover:bg-white/5' : 'bg-shuttle-500 hover:bg-shuttle-600 text-court-900'
          }`}
        >
          ✉️ Send via Email
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="focus-ring text-center rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 hover:bg-court-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          {copied ? '✓ Copied' : 'Copy result summary'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="focus-ring text-center rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 hover:bg-court-900/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          {shareCopied ? '✓ Link copied' : '🔗 Share result'}
        </button>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleSaveSetup}
          disabled={saved}
          className="focus-ring text-sm font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline cursor-pointer disabled:no-underline disabled:cursor-default disabled:opacity-70"
        >
          {saved ? '✓ Setup saved for next time' : '💾 Save this setup for next time'}
        </button>
      </div>
    </section>
  )
}
