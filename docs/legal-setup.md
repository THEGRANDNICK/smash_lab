# Legal setup checklist

This project ships an Impressum (`src/components/legal/Impressum.tsx`) and a
Datenschutzerklärung (`src/components/legal/Datenschutz.tsx`), both driven by
`src/data/legalConfig.ts`. **Nothing in this codebase invents personal,
legal, tax, registration, or business information.** A field the site owner
hasn't supplied is simply left empty in the config — the rendered page skips
that line entirely rather than showing a placeholder or an incomplete-page
warning. Placeholders (if any) only ever live inside `legalConfig.ts` itself,
never on the page a visitor sees.

This document is not legal advice. It documents what the code actually does
and what a real deployment still needs before the pages can be relied on.

## Currently configured (`src/data/legalConfig.ts`)

| Field | Value | Notes |
|---|---|---|
| `legalName` | Nicolas Vogt | Reused from the existing public copyright notice — not invented. |
| `tradingAs` | Smash Lab | |
| `email` | Reused from `src/data/contact.ts` | |
| `phone` | +49 177 4204564 | Same number as the WhatsApp contact button. |
| `addressLine1` (street) | *(empty)* | Not currently published — see "Optional full address" below. |
| `addressLine2` (city) | Reused from `CONTACT.location` (Heidelberg, Germany) | |
| `vatId` / `registrationNumber` | *(empty)* | Only applicable if VAT-registered / formally registered as a business. |

`euOdrUrl` is a fixed, published EU disclosure link (`https://ec.europa.eu/consumers/odr`)
required for traders dealing with EU consumers — not site-specific data, so
it's pre-filled.

## Optional: full street address

§ 5 TMG's "ladungsfähige Anschrift" requirement is most safely satisfied by a
full street address, not a city name alone. If the site owner wants to
publish one, fill in `addressLine1` (street + house number) and extend
`addressLine2` with a postal code in `legalConfig.ts` — the Impressum page
will pick it up automatically, no component changes needed.

## What the Datenschutzerklärung actually covers

Audited directly against this codebase (see `Datenschutz.tsx`'s own section
numbering):

1. Responsible party (Impressum)
2. GitHub Pages hosting (technical access logs, outside this app's control)
3. Fonts — self-hosted, no external font requests
4. Cookies, analytics, advertising, profiling — explicitly none of any of these
5. Quiz answers — processed client-side only, never sent to a server
6. `localStorage`/`sessionStorage` — comparison-view preference, optional "My setup", and (admin-only) the Supabase Auth session
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

The Impressum page renders cleanly with the fields currently configured
above — no "not yet complete" banner or placeholder text appears on the
page. A full street address (see "Optional" above) can be added later
without any code changes beyond editing `legalConfig.ts`.
