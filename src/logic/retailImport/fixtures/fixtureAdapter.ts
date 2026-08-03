// Phase 13A — Part 8: a deterministic, offline fixture/demo adapter. This
// is NOT a real retailer integration and performs no network access at
// all — search() always returns the same fixed, hand-authored list
// regardless of the query. It exists purely to prove the pipeline works
// end to end, for scripts/reportRetailSyncFoundation.ts (Part 9) and
// scripts/testRetailSyncFoundation.ts (Part 16).
//
// It is never imported by src/App.tsx, any component under src/components,
// or any admin surface — so it ships in zero production bundles. See
// docs/retail-sync-architecture.md's "how Phase 13B adds a real adapter"
// section for what replaces this later, with zero changes required
// anywhere else in the pipeline.

import type { DetectedRetailProduct, RawRetailSearchResult, RetailerAdapter, RetailSearchQuery } from '../types.js'

interface FixtureRaw {
  title: string
  brand?: string
  url?: string
  imageUrl?: string
  price?: number
  currency?: string
  availabilityText?: string
}

export const FIXTURE_RETAILER_ID = 'fixture-retailer'

const FIXTURE_RESULTS: readonly FixtureRaw[] = [
  {
    title: 'Yonex BG80 Badminton String Set',
    brand: 'Yonex',
    url: 'https://example-retailer.test/yonex-bg80-set',
    imageUrl: 'https://example-retailer.test/img/bg80.jpg',
    price: 14.99,
    currency: 'EUR',
    availabilityText: 'In stock',
  },
  {
    title: 'Yonex Exbolt 63 200m Reel',
    brand: 'Yonex',
    url: 'https://example-retailer.test/yonex-exbolt-63-reel',
    price: 189.0,
    currency: 'EUR',
    availabilityText: '3 left',
  },
  {
    title: 'Yonex BG65 Ti Hybrid Set 10 m',
    brand: 'Yonex',
    url: 'https://example-retailer.test/yonex-bg65ti-hybrid',
    price: 12.5,
    currency: 'EUR',
    availabilityText: 'Out of stock',
  },
  {
    // Deliberately unbranded and unresolvable — a realistic "no confident
    // catalog match" case, so the demo script and tests both exercise the
    // low end of the confidence scale, not just the high end.
    title: 'Mystery Unbranded String 200 metre spool',
    price: 79.0,
    currency: 'EUR',
  },
]

/**
 * The fixture adapter. `search()` ignores its query entirely (there is no
 * real search to demonstrate yet) and returns the fixed list above.
 * `parse()` decodes one fixture entry into a DetectedRetailProduct, or
 * `null` for a structurally invalid one (proving the pipeline's "one bad
 * result is skipped, not a failure" contract even with fixture data).
 */
export const fixtureAdapter: RetailerAdapter = {
  id: 'fixture-demo',
  label: 'Fixture demo adapter (offline, deterministic — not a real retailer)',

  async search(_query: RetailSearchQuery): Promise<RawRetailSearchResult[]> {
    return FIXTURE_RESULTS.map((raw) => ({ retailerId: FIXTURE_RETAILER_ID, raw }))
  },

  parse(raw: RawRetailSearchResult): DetectedRetailProduct | null {
    const fixture = raw.raw as FixtureRaw
    if (!fixture || typeof fixture.title !== 'string' || fixture.title.trim() === '') return null
    return {
      title: fixture.title,
      brand: fixture.brand,
      url: fixture.url,
      imageUrl: fixture.imageUrl,
      price: fixture.price,
      currency: fixture.currency,
      availabilityText: fixture.availabilityText,
      sourceRetailerId: raw.retailerId,
      sourceLabel: 'Fixture demo adapter',
    }
  },
}
