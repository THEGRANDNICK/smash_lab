// Phase 13A — Part 5: the generic catalog matcher. Compares one
// DetectedRetailProduct against a list of CatalogItemRefs and returns them
// ranked, with explainable evidence for every contributing signal.
//
// Deliberately generic: it only ever reads brand/name/modelCode/aliases
// off CatalogItemRef and title/brand/modelCode off DetectedRetailProduct —
// there is no retailer-specific rule anywhere in this file (no "if this
// came from retailer X, parse differently"), and nothing here assumes
// badminton strings specifically.
//
// Structured evidence (exact model code, exact normalized name, brand
// agreement/conflict) is evaluated FIRST and weighted highest; fuzzy
// token-overlap similarity is only a fallback for when no structured
// signal fired at all — see docs/retail-sync-architecture.md.

import { extractModelCodes, normalizeBrand, normalizeText, significantTokens } from './normalization.js'
import type { CatalogItemRef, CatalogMatchCandidate, DetectedRetailProduct, MatchEvidence, PackageDetectionResult } from './types.js'

const EXACT_MODEL_CODE_WEIGHT = 0.4
const EXACT_NAME_WEIGHT = 0.4
const NAME_SUBSTRING_WEIGHT = 0.3
const BRAND_MATCH_WEIGHT = 0.2
const BRAND_SUBSTRING_WEIGHT = 0.12
const BRAND_CONFLICT_PENALTY = -0.3
const TOKEN_OVERLAP_WEIGHT = 0.3
const PACKAGE_CONSISTENCY_WEIGHT = 0.05

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) if (!b.has(item)) return false
  return true
}

/** Jaccard (intersection / union) similarity over token sets — symmetric, bounded 0-1, unaffected by word order or duplicated words. Used only as a fallback once no exact/substring signal was found. */
function tokenSetSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const t of setA) if (setB.has(t)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function namesOf(catalogItem: CatalogItemRef): string[] {
  return [catalogItem.name, ...(catalogItem.aliases ?? [])]
}

/**
 * Scores one (detected, catalogItem) pair. Exported separately from
 * matchAgainstCatalog so tests (and a future "explain this specific
 * match" admin surface, if Phase 13C adds one) can call it directly on a
 * single pair. Never mutates its inputs, never throws.
 */
export function scoreCandidateMatch(detected: DetectedRetailProduct, catalogItem: CatalogItemRef, packageResult?: PackageDetectionResult): CatalogMatchCandidate {
  const evidence: MatchEvidence[] = []
  const detectedTokens = significantTokens(detected.title)

  if (detectedTokens.length === 0) {
    evidence.push({ kind: 'missing_identity', description: 'The detected title has no significant words left after removing packaging/marketing terms.', weight: 0 })
    return { catalogItem, score: 0, evidence }
  }

  let score = 0
  const titleNorm = normalizeText(detected.title)

  // --- Tier 1: exact model code (strongest structured evidence) ---
  const detectedModelCodes = new Set([...extractModelCodes(detected.title), ...(detected.modelCode ? extractModelCodes(detected.modelCode) : [])])
  const catalogModelCodes = new Set([
    ...namesOf(catalogItem).flatMap((n) => extractModelCodes(n)),
    ...(catalogItem.modelCode ? extractModelCodes(catalogItem.modelCode) : []),
  ])
  const sharedModelCode = [...detectedModelCodes].find((code) => catalogModelCodes.has(code))
  if (sharedModelCode) {
    score += EXACT_MODEL_CODE_WEIGHT
    evidence.push({ kind: 'exact_model_code', description: `Model code "${sharedModelCode}" matches exactly`, weight: EXACT_MODEL_CODE_WEIGHT })
  }

  // --- Tier 2: exact normalized name. Compared as "brand + name" (and "brand + alias") against the detected title's own tokens, since a real retailer title almost always includes the brand ("Yonex BG80 ..."), and a catalog item's name alone never does. ---
  let exactNameLabel: string | null = null
  for (const candidateName of namesOf(catalogItem)) {
    const candidateTokens = significantTokens(`${catalogItem.brand} ${candidateName}`)
    if (candidateTokens.length > 0 && setsEqual(new Set(detectedTokens), new Set(candidateTokens))) {
      exactNameLabel = candidateName
      break
    }
  }
  if (exactNameLabel) {
    score += EXACT_NAME_WEIGHT
    evidence.push({ kind: 'exact_name', description: `Title matches "${exactNameLabel}" exactly once packaging words are ignored`, weight: EXACT_NAME_WEIGHT })
  }

  // --- Tier 3: brand agreement / conflict ---
  const detectedBrandNorm = detected.brand ? normalizeBrand(detected.brand) : null
  const catalogBrandNorm = normalizeBrand(catalogItem.brand)
  if (detectedBrandNorm) {
    if (detectedBrandNorm === catalogBrandNorm) {
      score += BRAND_MATCH_WEIGHT
      evidence.push({ kind: 'brand_match', description: `Detected brand "${detected.brand}" matches catalog brand "${catalogItem.brand}" exactly`, weight: BRAND_MATCH_WEIGHT })
    } else {
      score += BRAND_CONFLICT_PENALTY
      evidence.push({ kind: 'brand_conflict', description: `Detected brand "${detected.brand}" conflicts with catalog brand "${catalogItem.brand}"`, weight: BRAND_CONFLICT_PENALTY })
    }
  } else if (catalogBrandNorm !== '' && titleNorm.includes(catalogBrandNorm)) {
    score += BRAND_SUBSTRING_WEIGHT
    evidence.push({ kind: 'brand_match', description: `Title contains the brand "${catalogItem.brand}"`, weight: BRAND_SUBSTRING_WEIGHT })
  }

  // --- Tier 4: name substring, then (only as a fallback) fuzzy token overlap ---
  if (!exactNameLabel) {
    let substringLabel: string | null = null
    for (const candidateName of namesOf(catalogItem)) {
      const candidateNorm = normalizeText(candidateName)
      if (candidateNorm !== '' && titleNorm.includes(candidateNorm)) {
        substringLabel = candidateName
        break
      }
    }
    if (substringLabel) {
      score += NAME_SUBSTRING_WEIGHT
      evidence.push({ kind: 'name_substring', description: `Title contains the catalog name "${substringLabel}"`, weight: NAME_SUBSTRING_WEIGHT })
    } else {
      let bestTokenScore = 0
      let bestLabel = catalogItem.name
      for (const candidateName of namesOf(catalogItem)) {
        const overlap = tokenSetSimilarity(detectedTokens, significantTokens(candidateName))
        if (overlap > bestTokenScore) {
          bestTokenScore = overlap
          bestLabel = candidateName
        }
      }
      if (bestTokenScore > 0) {
        const weight = Math.round(TOKEN_OVERLAP_WEIGHT * bestTokenScore * 100) / 100
        score += weight
        evidence.push({ kind: 'token_overlap', description: `Title shares ${Math.round(bestTokenScore * 100)}% of its significant words with "${bestLabel}"`, weight })
      } else {
        evidence.push({ kind: 'token_overlap', description: `No meaningful word overlap with "${catalogItem.name}"`, weight: 0 })
      }
    }
  }

  // --- Tier 5: package consistency — a narrow, generic signal. Packaging words like "set"/"reel" describe packaging, not product identity, and are excluded from matching entirely (they're already stripped by significantTokens). "hybrid" is the one exception: some catalog products are themselves named as hybrids, so it can also be genuine identity evidence. ---
  if (packageResult?.packageType === 'hybrid' && significantTokens(catalogItem.name).includes('hybrid')) {
    score += PACKAGE_CONSISTENCY_WEIGHT
    evidence.push({ kind: 'package_consistency', description: 'Detected "hybrid" packaging is consistent with a hybrid product name', weight: PACKAGE_CONSISTENCY_WEIGHT })
  }

  return { catalogItem, score: Math.min(1, Math.max(0, score)), evidence }
}

/**
 * Scores a detected product against every catalog item, sorted best match
 * first (ties broken by catalog id, for a fully deterministic result
 * regardless of which retailer/adapter produced the detected product).
 * Never mutates its inputs, never throws. An empty catalog produces an
 * empty result — callers (see confidence.ts) treat "no matches" as a
 * legitimate outcome, not an error.
 */
export function matchAgainstCatalog(detected: DetectedRetailProduct, catalog: readonly CatalogItemRef[], packageResult?: PackageDetectionResult): CatalogMatchCandidate[] {
  return catalog
    .map((item) => scoreCandidateMatch(detected, item, packageResult))
    .sort((a, b) => b.score - a.score || a.catalogItem.id.localeCompare(b.catalogItem.id))
}
