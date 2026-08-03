// Phase 13A — Part 6: explainable confidence scoring. Turns a ranked
// CatalogMatchCandidate[] (from matcher.ts) into one 0-100 score, a label,
// and human-readable reasons/warnings. Confidence never claims scientific
// accuracy — it is an explainable heuristic, not a statistical estimate —
// and it never depends on which retailer produced the detected product;
// only the evidence attached to the matches themselves feeds it.

import type { CatalogMatchCandidate, ConfidenceResult, ImportConfidenceLabel } from './types.js'

export const CONFIDENCE_EXACT_THRESHOLD = 90
export const CONFIDENCE_LIKELY_THRESHOLD = 60
export const CONFIDENCE_UNCERTAIN_THRESHOLD = 30

/** How close (in raw 0-1 score) the top two matches must be before the match is flagged ambiguous. */
export const AMBIGUITY_GAP = 0.12
/** Points subtracted from the final 0-100 score when the top two matches are ambiguous — a near-tie is real uncertainty, not something to hide by picking one arbitrarily. */
export const AMBIGUITY_PENALTY = 15

export const CONFIDENCE_LABEL_TEXT: Record<ImportConfidenceLabel, string> = {
  exact: 'Exact product',
  likely: 'Likely match',
  uncertain: 'Uncertain match',
  no_match: 'No match',
}

/**
 * Computes an explainable confidence result from a ranked match list.
 * `matches` is expected already sorted best-first (matchAgainstCatalog's
 * contract). An empty list is a legitimate "no catalog to match against"
 * outcome, not an error, and always produces `no_match`.
 */
export function computeConfidence(matches: readonly CatalogMatchCandidate[]): ConfidenceResult {
  if (matches.length === 0) {
    return {
      score: 0,
      label: 'no_match',
      reasons: ['No catalog items were available to match against.'],
      warnings: ['No catalog match was found — a human will need to identify this product.'],
      ambiguous: false,
    }
  }

  const top = matches[0]
  const second = matches[1]
  const reasons = top.evidence.filter((e) => e.weight !== 0).map((e) => e.description)
  const warnings: string[] = []
  let score = Math.round(top.score * 100)
  let ambiguous = false

  if (second && top.score > 0 && top.score - second.score < AMBIGUITY_GAP) {
    ambiguous = true
    score = Math.max(0, score - AMBIGUITY_PENALTY)
    reasons.push(`Nearly tied with "${second.catalogItem.brand} ${second.catalogItem.name}" — treat this match cautiously.`)
    warnings.push('The top two catalog matches are close in score; confirm this manually before treating it as certain.')
  }

  if (top.score === 0) {
    warnings.push('No structured or fuzzy evidence linked this product to any catalog item.')
  }

  let label: ImportConfidenceLabel
  if (score >= CONFIDENCE_EXACT_THRESHOLD && !ambiguous) label = 'exact'
  else if (score >= CONFIDENCE_LIKELY_THRESHOLD) label = 'likely'
  else if (score >= CONFIDENCE_UNCERTAIN_THRESHOLD) label = 'uncertain'
  else label = 'no_match'

  return { score: Math.max(0, Math.min(100, score)), label, reasons, warnings, ambiguous }
}
