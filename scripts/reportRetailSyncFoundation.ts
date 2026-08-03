// Phase 13A — Part 9: a development-only diagnostic script. Demonstrates
// the full pure pipeline (search -> parse -> match -> confidence ->
// candidate draft) end to end using the deterministic fixture adapter and
// fixture catalog. Makes NO network request and NO database write, and is
// not imported by any production UI — it only prints to the console.
//
// Run: npm run report:retail-sync-foundation

import { runRetailImportPipeline } from '../src/logic/retailImport/pipeline.js'
import { fixtureAdapter } from '../src/logic/retailImport/fixtures/fixtureAdapter.js'
import { FIXTURE_CATALOG } from '../src/logic/retailImport/fixtures/fixtureCatalog.js'
import { previewPricePerMetre } from '../src/logic/retailImport/pricePerMetrePreview.js'
import { CONFIDENCE_LABEL_TEXT } from '../src/logic/retailImport/confidence.js'

const query = { catalogType: 'string', freeText: 'yonex string' }

console.log('=== Phase 13A Retail Sync foundation — pipeline demo (fixture data, no network, no database) ===\n')
console.log(`Input query: ${JSON.stringify(query)}`)
console.log(`Adapter: ${fixtureAdapter.label}`)
console.log(`Catalog size: ${FIXTURE_CATALOG.length} items\n`)

const drafts = await runRetailImportPipeline(fixtureAdapter, query, FIXTURE_CATALOG)

for (const [index, draft] of drafts.entries()) {
  console.log(`--- Candidate ${index + 1} of ${drafts.length} ---`)
  console.log(`Detected title:     ${draft.detectedTitle}`)
  console.log(`Price / currency:   ${draft.price != null ? draft.price : '(none detected)'} ${draft.currency ?? ''}`.trim())
  console.log(`Package:            type=${draft.package.packageType}, lengthM=${draft.package.packageLengthM ?? '(none detected)'}, confidence=${draft.package.confidence}`)
  if (draft.package.evidence.length > 0) console.log(`  package evidence:  ${draft.package.evidence.join(' | ')}`)
  if (draft.package.warnings.length > 0) console.log(`  package warnings:  ${draft.package.warnings.join(' | ')}`)

  console.log('Top catalog matches:')
  for (const match of draft.matches.slice(0, 3)) {
    console.log(`  - ${match.catalogItem.brand} ${match.catalogItem.name} (${match.catalogItem.id}): score=${match.score.toFixed(2)}`)
    for (const evidence of match.evidence) console.log(`      [${evidence.kind}] ${evidence.description} (weight ${evidence.weight >= 0 ? '+' : ''}${evidence.weight})`)
  }

  console.log(`Confidence: ${draft.confidence.score}/100 — ${CONFIDENCE_LABEL_TEXT[draft.confidence.label]}${draft.confidence.ambiguous ? ' (ambiguous)' : ''}`)
  for (const reason of draft.confidence.reasons) console.log(`  reason:   ${reason}`)
  for (const warning of draft.confidence.warnings) console.log(`  warning:  ${warning}`)

  console.log(`Suggested catalog item: ${draft.suggestedCatalogItem ? `${draft.suggestedCatalogItem.brand} ${draft.suggestedCatalogItem.name} (${draft.suggestedCatalogItem.id})` : '(none)'}`)

  if (draft.warnings.length > 0) {
    console.log('Candidate warnings:')
    for (const warning of draft.warnings) console.log(`  [${warning.code}] ${warning.message}`)
  }

  const preview = previewPricePerMetre(draft, 'Fixture Retailer')
  console.log(`Price-per-metre preview (via the EXISTING describeBestPricePerMetre()): ${preview ? `${preview.formatted} — ${preview.sourceDescription}` : '(not available — missing price or package length)'}`)

  console.log('')
}

console.log(`Done. ${drafts.length} in-memory candidate draft(s) produced. Nothing was written to Supabase; nothing was persisted.`)
