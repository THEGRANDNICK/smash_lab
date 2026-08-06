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
  matchPercent: number
  dataSourceLabel: string
  /** Shown only when the caller opts in (off by default, to match the reference message shape) — e.g. "10.0 kg (easier power) / 11.0 kg (control)". */
  alternativeTensions?: string
  racketModel?: string
  note?: string
}

/**
 * The shared, human-readable message body — used both for the WhatsApp/
 * email prefill and for the standalone "Copy result summary" action.
 * Trailing fields (Racket/Preferred drop-off time/Additional note) are
 * left as labelled blanks when not filled in, exactly like a real
 * message a customer would send, so the recipient can see at a glance
 * what still needs an answer.
 */
export function buildResultSummaryText(details: EnquiryDetails): string {
  const { stringName, tensionKg, matchPercent, dataSourceLabel, alternativeTensions, racketModel, note } = details
  const lines = [
    `Hello ${CONTACT.name},`,
    'Smash Lab recommended the following setup:',
    '',
    `String: ${stringName}`,
    `Tension: ${formatKg(tensionKg)}`,
  ]
  if (alternativeTensions) lines.push(`Alternative tensions: ${alternativeTensions}`)
  lines.push(`Match: ${matchPercent}%`, `Data source: ${dataSourceLabel}`, '', `Racket: ${racketModel ?? ''}`, 'Preferred drop-off time: ', `Additional note: ${note ?? ''}`)
  return lines.join('\n')
}

export function buildEnquiryMailto(details: EnquiryDetails): string {
  const subject = `Stringing enquiry — ${details.stringName}`
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
  return `Hi! I used the Smash Lab String Finder and got ${stringName}${tensionPart} as my recommendation. I'd like to get my racket restrung — when could I drop it off?`
}

export function buildRequestMailto(stringName: string, tensionKg?: number): string {
  const subject = `Restringing request — ${stringName}`
  const body = buildRequestMessage(stringName, tensionKg)
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
