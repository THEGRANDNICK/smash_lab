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
  /** Reuses CONTACT.whatsappNumber, formatted for display (data/contact.ts is the source of truth for the raw wa.me digits). */
  phone: string
  /** Street + house number. Only fill in if the owner wants a full postal address published — a city-level location (see addressLine2) is what's currently supplied. Empty is a valid, intentional state: the page simply omits this line rather than showing a placeholder. */
  addressLine1: string
  /** City (and postal code, once supplied). Reuses CONTACT.location for a single source of truth. */
  addressLine2: string
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
  phone: '+49 177 4204564',
  addressLine1: '',
  addressLine2: CONTACT.location,
  vatId: '',
  registrationNumber: '',
  registrationAuthority: '',
  euOdrUrl: 'https://ec.europa.eu/consumers/odr',
  lastUpdated: '2026-08-06',
}
