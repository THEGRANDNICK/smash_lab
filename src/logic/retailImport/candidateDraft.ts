// Phase 13A — Part 7: the pure Import Candidate Draft builder. Combines a
// detected product, its package-detection result, its ranked catalog
// matches, and its confidence result into one in-memory
// ImportCandidateDraft.
//
// This function — and everything it calls — never touches Supabase, never
// creates a retailer listing, and never requires a database table. The
// draft it returns does not survive a page reload and is not surfaced in
// any admin or public UI in this phase. See
// docs/retail-sync-architecture.md for why persistence is deferred.

import { computeConfidence } from './confidence.js'
import { matchAgainstCatalog } from './matcher.js'
import { normalizeCurrencyCode, normalizeUrl } from './normalization.js'
import { detectPackage } from './packageDetection.js'
import type { CatalogItemRef, DetectedRetailProduct, ImportCandidateDraft, ImportWarning } from './types.js'

export interface BuildCandidateDraftInput {
  detected: DetectedRetailProduct
  catalog: readonly CatalogItemRef[]
  /** A short label identifying where this candidate came from — typically the adapter's `id` (see types.ts's RetailerAdapter). */
  source: string
}

/**
 * Builds one ImportCandidateDraft from a single detected product. Pure and
 * synchronous: no I/O of any kind. Warnings are collected independently of
 * confidence — a candidate can be an EXACT match with warnings (right
 * product, but no price on the page) just as easily as a LOW-confidence
 * match with none (a fully-priced product that just doesn't resemble
 * anything in the catalog).
 */
export function buildImportCandidateDraft(input: BuildCandidateDraftInput): ImportCandidateDraft {
  const { detected, catalog, source } = input

  const packageText = [detected.title, detected.packageText].filter(Boolean).join(' ')
  const packageResult = detectPackage(packageText)
  const matches = matchAgainstCatalog(detected, catalog, packageResult)
  const confidence = computeConfidence(matches)
  // A top match with a literal zero score carries no actual evidence — it
  // only "won" the sort's deterministic id tie-break — so it is never
  // surfaced as a suggestion, unlike a low-but-nonzero score, which is
  // still a worthwhile (if low-confidence) hint for a human reviewer.
  const suggestedCatalogItem = matches[0] && matches[0].score > 0 ? matches[0].catalogItem : null

  const urlResult = normalizeUrl(detected.url)
  const imageResult = normalizeUrl(detected.imageUrl)
  const currencyResult = normalizeCurrencyCode(detected.currency)
  const price = detected.price ?? null

  const warnings: ImportWarning[] = []
  if (urlResult.warning) warnings.push(urlResult.warning)
  if (imageResult.warning) warnings.push(imageResult.warning)
  if (currencyResult.warning) warnings.push(currencyResult.warning)
  if (price == null) warnings.push({ code: 'missing_price', message: 'No price was detected for this product.' })
  if (packageResult.packageLengthM == null) warnings.push({ code: 'missing_package_length', message: 'No package length was detected for this product.' })
  if (!detected.imageUrl) warnings.push({ code: 'missing_image', message: 'No product image was detected.' })
  if (confidence.label === 'no_match') warnings.push({ code: 'unresolved_catalog_item', message: 'No confident catalog match was found for this product.' })
  if (confidence.ambiguous) warnings.push({ code: 'ambiguous_match', message: 'The top catalog matches were close enough to need a human decision.' })

  return {
    sourceRetailerId: detected.sourceRetailerId,
    detectedTitle: detected.title,
    url: urlResult.value,
    imageUrl: imageResult.value,
    price,
    currency: currencyResult.value,
    availabilityText: detected.availabilityText ?? null,
    package: packageResult,
    suggestedCatalogItem,
    matches,
    confidence,
    warnings,
    source,
  }
}
