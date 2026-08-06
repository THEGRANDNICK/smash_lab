import { useEffect, useState } from 'react'
import { readSavedSetup, clearSavedSetup, type SavedSetup } from '../logic/savedSetup'
import { buildEnquiryMailto, buildEnquiryWhatsAppUrl } from '../logic/contactMessage'
import { formatKg } from '../logic/units'

/**
 * Product feedback: "Save my setup" — a return visitor with a
 * localStorage-saved recommendation gets a one-line shortcut straight
 * back to a stringing enquiry, instead of retaking the whole quiz. Reads
 * on mount only (useEffect, not useState's initializer) so this renders
 * identically on the server-less static build before hydration touches
 * localStorage — avoids a hydration mismatch, not a functional need.
 */
export default function SavedSetupBanner() {
  const [setup, setSetup] = useState<SavedSetup | null>(null)

  useEffect(() => {
    setSetup(readSavedSetup(typeof window === 'undefined' ? null : window.localStorage))
  }, [])

  if (!setup) return null

  const details = {
    stringName: `${setup.stringBrand} ${setup.stringName}`,
    tensionKg: setup.tensionKg,
    matchPercent: setup.matchPercent,
    dataSourceLabel: setup.dataSourceLabel,
    racketModel: setup.racketModel,
  }
  const whatsAppUrl = buildEnquiryWhatsAppUrl(details)
  const mailtoUrl = buildEnquiryMailto(details)

  function handleClear() {
    clearSavedSetup(typeof window === 'undefined' ? null : window.localStorage)
    setSetup(null)
  }

  return (
    <div className="bg-court-900 text-white border-b border-white/10 px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm min-w-0">
          <span className="font-semibold">💾 Your saved setup:</span> {setup.stringBrand} {setup.stringName} · {formatKg(setup.tensionKg)}
          {setup.racketModel && <> · {setup.racketModel}</>}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={whatsAppUrl ?? mailtoUrl}
            target={whatsAppUrl ? '_blank' : undefined}
            rel={whatsAppUrl ? 'noopener noreferrer' : undefined}
            className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-4 py-1.5 text-sm transition-colors cursor-pointer"
          >
            Request this again
          </a>
          <button type="button" onClick={handleClear} className="focus-ring text-xs font-semibold text-white/60 hover:text-white cursor-pointer">
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
