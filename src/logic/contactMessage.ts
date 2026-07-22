// Builds a prefilled contact message for "Request this" / "Choose This
// Setup" actions, so players don't have to retype their recommendation.
// Uses a mailto: link against the existing placeholder contact email —
// once that placeholder is replaced with a real address, these links work
// immediately with no other changes needed.
//
// NOTE: a one-tap prefilled WhatsApp link (wa.me/<number>?text=...) would
// need a real WhatsApp number in international format to replace the
// current placeholder in data/contact.ts — intentionally not wired up
// against the placeholder, since it currently contains no real digits.

import { CONTACT } from '../data/contact'
import { formatKg } from './units'

export function buildRequestMessage(stringName: string, tensionKg?: number): string {
  const tensionPart = tensionKg != null ? ` at ${formatKg(tensionKg)}` : ''
  return `Hi! I used the Smash Lab String Finder and got ${stringName}${tensionPart} as my recommendation. I'd like to get my racket restrung — when could I drop it off?`
}

export function buildRequestMailto(stringName: string, tensionKg?: number): string {
  const subject = `Restringing request — ${stringName}`
  const body = buildRequestMessage(stringName, tensionKg)
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
