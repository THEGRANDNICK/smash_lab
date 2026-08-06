# Legal setup checklist

This project ships an Impressum (`src/components/legal/Impressum.tsx`) and a
Datenschutzerklärung (`src/components/legal/Datenschutz.tsx`), both driven by
`src/data/legalConfig.ts`. **Nothing in this codebase invents personal,
legal, tax, registration, or business information.** Fields the site owner
hasn't supplied are rendered as a visible `[... — not yet provided]`
placeholder, and the Impressum page shows a standing notice while any
required field is empty.

This document is not legal advice. It documents what the code actually does
and what a real deployment still needs before the pages can be relied on.

## Required before production use

Edit `src/data/legalConfig.ts`:

| Field | Required? | Notes |
|---|---|---|
| `legalName` | Already set | Reused from the existing public copyright notice — not invented. Update if incorrect. |
| `addressLine1` / `addressLine2` | **Required** (§ 5 TMG) | Street + house number, postal code + city. |
| `phone` | **Required** if this counts as a commercial offering under § 5 TMG | A reachable phone number for the responsible party. |
| `email` | Already set | Reused from `src/data/contact.ts`. |
| `vatId` | Optional | Only if VAT-registered (Umsatzsteuer-ID). |
| `registrationNumber` / `registrationAuthority` | Optional | Only if formally registered as a business (Gewerbe/Handelsregister). |

`euOdrUrl` is a fixed, published EU disclosure link (`https://ec.europa.eu/consumers/odr`)
required for traders dealing with EU consumers — not site-specific data, so
it's pre-filled.

## What the Datenschutzerklärung actually covers

Audited directly against this codebase (see `Datenschutz.tsx`'s own section
numbering):

1. Responsible party (Impressum)
2. GitHub Pages hosting (technical access logs, outside this app's control)
3. Fonts — self-hosted, no external font requests
4. Analytics/tracking — none present
5. Quiz answers — processed client-side only, never sent to a server
6. `localStorage`/`sessionStorage` — comparison-view preference, optional "My setup"
7. WhatsApp/email enquiry links — user-initiated, goes directly to WhatsApp/the user's mail client, not through a Smash Lab server
8. Shared result links — non-personal quiz-preference state only, recomputed client-side
9. Supabase — public read-only catalog/inventory/price data; Supabase Auth for the admin login only
10. External retailer links/images — third-party, their own privacy policy applies
11. Data-subject rights — scoped to what's actually stored (local device data only)

## Recommended (not implemented in this phase)

- A named **Datenschutzbeauftragter** (data protection officer) contact, if legally required for this scale of operation — likely not required for a small individual service, but not assessed here.
- A formal legal review by a qualified professional before relying on these pages for compliance, especially if the business scope changes (e.g. adding e-commerce checkout, adding real analytics, adding a booking system that stores customer data server-side).
- If real analytics/tracking or Supabase-side enquiry storage is added later, the Datenschutzerklärung's sections 4/5/7 must be updated to match — they're written to describe the current, tracking-free, client-side-only design and will become inaccurate if that changes.

## Confirmation

As of this phase, `isImpressumComplete()` (`src/data/legalConfig.ts`) returns
`false` until `addressLine1`/`addressLine2` are filled in — the Impressum
page will keep showing its "not yet complete" notice until then. This is
intentional: it's a visible reminder rather than a silently-incomplete legal
page.
