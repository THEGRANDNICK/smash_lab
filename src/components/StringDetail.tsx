import { useState } from 'react'
import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { writePendingComparisonSelection } from '../logic/pendingComparisonSelection'
import StringCard from './StringCard'
import StringBasics from './StringBasics'

interface StringDetailProps {
  stringId: string
  strings: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  retailerListingsByStringId?: Record<string, RetailerListing[]>
  onBrowse: () => void
  onCompare: () => void
  onQuiz: () => void
}

/**
 * One string on its own shareable URL (#string/<id>) — so a stringer can
 * send "here's BG80" and a player can bookmark the string they're
 * considering. Built from the same card as the lineup, so the two can't
 * drift apart.
 */
export default function StringDetail({ stringId, strings, specialistProfiles, retailerListingsByStringId, onBrowse, onCompare, onQuiz }: StringDetailProps) {
  const item = strings.find((s) => s.id === stringId)
  const [copied, setCopied] = useState(false)

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

  function compareWithOthers() {
    writePendingComparisonSelection(typeof window === 'undefined' ? null : window.sessionStorage, [item!.id])
    onCompare()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — the URL bar still has the link.
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <button type="button" onClick={onBrowse} className="focus-ring text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer">
        ← All strings
      </button>
      <h1 className="sr-only">
        {item.brand} {item.name}
      </h1>

      <div className="mt-4">
        <StringCard item={item} specialistProfiles={specialistProfiles} retailerListings={retailerListingsByStringId?.[item.id]} headingLevel="h2" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={compareWithOthers} className="focus-ring rounded-full bg-court-800 hover:bg-court-700 text-white font-semibold px-5 py-2.5 cursor-pointer">
          Compare with other strings
        </button>
        <button type="button" onClick={onQuiz} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-5 py-2.5 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-500 cursor-pointer">
          Does it suit me? Take the quiz
        </button>
        <button type="button" onClick={copyLink} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-5 py-2.5 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-500 cursor-pointer" aria-live="polite">
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>

      <StringBasics className="mt-8" />
    </div>
  )
}
