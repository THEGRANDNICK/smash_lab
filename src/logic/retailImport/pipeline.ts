// Phase 13A — orchestration. Wires search -> parse -> normalize ->
// candidate-draft together for any RetailerAdapter. Nothing here writes
// to Supabase or persists anything — the returned drafts are plain,
// in-memory data.

import { buildImportCandidateDraft } from './candidateDraft.js'
import type { CatalogItemRef, ImportCandidateDraft, RetailerAdapter, RetailSearchQuery } from './types.js'

/**
 * Runs the full pure pipeline for one adapter + query: search() for raw
 * results, parse() each one (skipping any that return null — one
 * unparsable result never fails the whole run), apply the adapter's
 * optional normalize() hook, then build an ImportCandidateDraft for each
 * survivor. Never calls anything beyond the adapter and the pure
 * matching/confidence/draft stages — no network access happens here
 * beyond whatever the adapter's own search() does.
 */
export async function runRetailImportPipeline(adapter: RetailerAdapter, query: RetailSearchQuery, catalog: readonly CatalogItemRef[]): Promise<ImportCandidateDraft[]> {
  const rawResults = await adapter.search(query)
  const drafts: ImportCandidateDraft[] = []

  for (const raw of rawResults) {
    const parsed = adapter.parse(raw)
    if (!parsed) continue
    const normalized = adapter.normalize ? adapter.normalize(parsed) : parsed
    drafts.push(buildImportCandidateDraft({ detected: normalized, catalog, source: adapter.id }))
  }

  return drafts
}
