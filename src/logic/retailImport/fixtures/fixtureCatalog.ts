// Phase 13A — a small, dev/test-only catalog of REAL string ids from
// src/data/strings.ts, mapped to the generic CatalogItemRef shape. This is
// the "thin string-specific mapping layer" Part 2 allows the core matcher
// to stay agnostic of — it exists only so scripts/reportRetailSyncFoundation.ts
// and scripts/testRetailSyncFoundation.ts have something realistic to
// match against. It is never imported by src/App.tsx, any component, or
// any admin surface.

import type { CatalogItemRef } from '../types.js'

export const FIXTURE_CATALOG: readonly CatalogItemRef[] = [
  { id: 'yonex-bg80', catalogType: 'string', brand: 'Yonex', name: 'BG80' },
  { id: 'yonex-bg80-power', catalogType: 'string', brand: 'Yonex', name: 'BG80 Power' },
  { id: 'yonex-exbolt-63', catalogType: 'string', brand: 'Yonex', name: 'Exbolt 63' },
  { id: 'yonex-exbolt-65', catalogType: 'string', brand: 'Yonex', name: 'Exbolt 65' },
  { id: 'yonex-bg65-titanium', catalogType: 'string', brand: 'Yonex', name: 'BG65 Titanium', aliases: ['BG65 Ti'] },
  { id: 'yonex-aerobite', catalogType: 'string', brand: 'Yonex', name: 'AeroBite' },
  { id: 'yonex-aerobite-boost', catalogType: 'string', brand: 'Yonex', name: 'AeroBite Boost' },
]
