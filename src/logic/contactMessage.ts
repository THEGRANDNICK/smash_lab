// Builds the prefilled enquiry message shown after a quiz result — the
// conversion path from "here's your recommendation" to an actual
// stringing request. Two delivery channels share one message body:
// mailto: (always available, since CONTACT.email is always real) and a
// wa.me WhatsApp link (only offered once CONTACT.whatsappNumber is
// filled in — see data/contact.ts). Racket model and the free-text note
// are plain function parameters, never stored anywhere by this module —
// the caller (StringingEnquiry.tsx) keeps them in local component state
// and only ever passes them in here at the moment the player actually
// taps "Send".

import { CONTACT } from '../data/contact.js'
import { formatKg } from './units.js'

export interface EnquiryDetails {
  stringName: string
  tensionKg: number
  /** Absent for setups built by hand in the workshop (there is no ranking score then). */
  matchPercent?: number
  /** Racket balance chosen in the workshop, e.g. "head-heavy". */
  racketBalance?: string
  dataSourceLabel: string
  /** Shown only when the caller opts in (off by default, to match the reference message shape) — e.g. "10.0 kg (easier power) / 11.0 kg (control)". */
  alternativeTensions?: string
  racketModel?: string
  note?: string
  /** Position in the player's ranking; > 1 when they chose another match than the recommendation. */
  rank?: number
  /** Mains and crosses as strung (the stated tension is their average). */
  mainsKg?: number
  crossKg?: number
  /** The racket's maximum if the player entered it; undefined = not checked. */
  racketMaxKg?: number
}

/**
 * The shared, human-readable message body — used both for the WhatsApp/
 * email prefill and for the standalone "Copy result summary" action.
 * Trailing fields (Racket/My question) are
 * left as labelled blanks when not filled in, exactly like a real
 * message a customer would send, so the recipient can see at a glance
 * what still needs an answer.
 */
export function buildResultSummaryText(details: EnquiryDetails): string {
  const { stringName, tensionKg, matchPercent, dataSourceLabel, alternativeTensions, racketModel, note, rank, mainsKg, crossKg, racketMaxKg, racketBalance } = details
  const lines = [
    `Hello ${CONTACT.name},`,
    // Says so when the player picked one of their other matches instead of the recommendation.
    rank != null && rank > 1 ? `I picked my #${rank} match from Smash Lab:` : 'Smash Lab recommended the following setup:',
    '',
    `String: ${stringName}`,
    // Mains and crosses spelled out, so no one has to guess what a single number means.
    ...(mainsKg != null && crossKg != null
      ? [`Tension: mains ${formatKg(mainsKg)} / crosses ${formatKg(crossKg)} (average ${formatKg(tensionKg)})`]
      : [`Tension: ${formatKg(tensionKg)}`]),
    // the maximum is shown exactly (never rounded to half kilos — 12.7 must not become 12.5)
    racketMaxKg != null ? `Racket max: ${racketMaxKg.toFixed(1)} kg / ${Math.round(racketMaxKg / 0.45359237)} lbs (checked)` : 'Racket max: NOT CHECKED — please check before stringing',
  ]
  if (alternativeTensions) lines.push(`Alternative tensions: ${alternativeTensions}`)
  if (racketBalance) lines.push(`Racket balance: ${racketBalance}`)
  if (matchPercent != null) lines.push(`Model score: ${matchPercent} (a ranking score, not a probability)`)
  lines.push(`Data source: ${dataSourceLabel}`, '', `Racket: ${racketModel ?? ''}`, `My question: ${note ?? ''}`)
  return lines.join('\n')
}

export function buildEnquiryMailto(details: EnquiryDetails): string {
  const subject = `Question about my Smash Lab result — ${details.stringName}`
  const body = buildResultSummaryText(details)
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Returns null while CONTACT.whatsappNumber is unset — the caller uses this to hide the WhatsApp option entirely rather than linking to a broken/placeholder number. */
export function buildEnquiryWhatsAppUrl(details: EnquiryDetails): string | null {
  const number = CONTACT.whatsappNumber.trim()
  if (!number) return null
  const text = buildResultSummaryText(details)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

// --- Generic "Request this string" message, used by StringCard.tsx when
// browsing/comparing outside a quiz result (no match%/tension/data-source
// to report, so it doesn't use the structured enquiry shape above). -----

export function buildRequestMessage(stringName: string, tensionKg?: number): string {
  const tensionPart = tensionKg != null ? ` at ${formatKg(tensionKg)}` : ''
  return `Hi Nick! I have a question about ${stringName}${tensionPart}: `
}

export function buildRequestMailto(stringName: string, tensionKg?: number): string {
  const subject = `Question about ${stringName}`
  const body = buildRequestMessage(stringName, tensionKg)
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
