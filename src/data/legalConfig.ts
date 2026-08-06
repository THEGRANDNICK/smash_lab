// Legal/company details for the Impressum and Datenschutzerklärung pages.
// Deliberately separate from data/contact.ts's informal contact info —
// this file exists so every legally-required field has ONE place to fill
// in, and so it's obvious at a glance which fields are still placeholders.
//
// RULE: nothing here is invented. Fields already publicly stated
// elsewhere in this repository (the copyright notice's legal name) are
// reused; everything else starts empty with a comment describing exactly
// what's expected, until the site owner fills it in. See
// docs/legal-setup.md for the full pre-launch checklist this file feeds.

import { CONTACT } from './contact'

export interface LegalConfig {
  /** Full legal name of the person/entity responsible for this site. Already public in COPYRIGHT.md / the footer notice, so reusing it here is not "inventing" — update if that ever changes. */
  legalName: string
  /** The public-facing trading name, if different from legalName. */
  tradingAs: string
  /** Reuses CONTACT.email (data/contact.ts) — the site's one source of truth for the contact address. */
  email: string
  /** REQUIRED before production use — street + house number. Left empty deliberately; never guessed. */
  addressLine1: string
  /** REQUIRED before production use — postal code + city. Left empty deliberately; never guessed. */
  addressLine2: string
  /** REQUIRED before production use if this counts as a commercial/business offering under § 5 TMG — a phone number for the person/entity responsible. */
  phone: string
  /** OPTIONAL — only applicable if VAT-registered (Umsatzsteuer-Identifikationsnummer). Leave empty if not applicable. */
  vatId: string
  /** OPTIONAL — only applicable if formally registered as a business (Gewerbe/Handelsregister). */
  registrationNumber: string
  /** OPTIONAL — the authority that issued registrationNumber, only if registrationNumber is set. */
  registrationAuthority: string
  /** Standard EU Online Dispute Resolution platform link — a fixed, published URL (not site-specific data), required disclosure under EU Regulation 524/2013 for traders operating in the EU who deal with consumers. */
  euOdrUrl: string
  /** ISO date string — update whenever this page's content meaningfully changes. */
  lastUpdated: string
}

export const LEGAL: LegalConfig = {
  legalName: 'Nicolas Vogt',
  tradingAs: 'Smash Lab',
  email: CONTACT.email,
  addressLine1: '',
  addressLine2: '',
  phone: '',
  vatId: '',
  registrationNumber: '',
  registrationAuthority: '',
  euOdrUrl: 'https://ec.europa.eu/consumers/odr',
  lastUpdated: '2026-08-06',
}

/** True once every field § 5 TMG realistically requires for an individual offering a paid service is filled in — used to show a visible "still a placeholder" notice rather than silently shipping an incomplete legal page. */
export function isImpressumComplete(legal: LegalConfig = LEGAL): boolean {
  return Boolean(legal.legalName && legal.addressLine1 && legal.addressLine2 && legal.email)
}
