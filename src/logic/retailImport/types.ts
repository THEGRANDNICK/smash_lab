// Phase 13A — Retail Sync foundation. Pure, category-agnostic import-domain
// types. Nothing in this file depends on React, a Supabase-generated row
// type, or badminton strings specifically — the goal (see
// docs/retail-sync-architecture.md) is that a future racket/shoe/bag
// catalog satisfies these same shapes with zero changes here.
//
// Nothing built on top of these types writes to Supabase. The pipeline
// this phase implements stops at an in-memory ImportCandidateDraft; a
// later phase (13C, per the docs) is responsible for persistence.

/** What a future retailer search is being asked to find. catalogType is a free string (e.g. 'string') rather than a fixed union, so a future racket/shoe/bag search query is this exact same shape. */
export interface RetailSearchQuery {
  catalogType: string
  brand?: string
  name?: string
  freeText?: string
  retailerId?: string | number
}

/** One raw hit from an adapter's search() — deliberately opaque. Nothing outside the adapter that produced it ever inspects `raw` directly; only that adapter's own parse() understands its shape. */
export interface RawRetailSearchResult {
  retailerId: string | number
  raw: unknown
}

/** What an adapter's parse() extracts from ONE raw result — the shared, retailer-independent shape every downstream stage (normalization, matching, confidence) reads. Every field but `title` and `sourceRetailerId` is optional, because real retailer pages are inconsistent about what they expose. */
export interface DetectedRetailProduct {
  title: string
  brand?: string
  modelCode?: string
  url?: string
  imageUrl?: string
  price?: number
  currency?: string
  availabilityText?: string
  packageText?: string
  sourceRetailerId: string | number
  sourceLabel?: string
}

/** A catalog entry a detected product can be matched against. Deliberately generic — the matcher (matcher.ts) only ever reads these fields, so a future racket/shoe/bag catalog item satisfies this exact interface with zero matcher changes. A thin, string-specific mapping layer (catalog strings -> CatalogItemRef) is expected to live near the catalog service, not here. */
export interface CatalogItemRef {
  id: string
  catalogType: string
  brand: string
  name: string
  modelCode?: string
  aliases?: string[]
}

export type MatchEvidenceKind =
  | 'exact_model_code'
  | 'exact_name'
  | 'brand_match'
  | 'brand_conflict'
  | 'name_substring'
  | 'token_overlap'
  | 'package_consistency'
  | 'missing_identity'

/** One piece of evidence contributing to (or against) a match. `weight` is the signed score delta it contributed — negative for evidence against the match (e.g. a conflicting brand). Always paired with a human-readable `description` so a match is explainable, never a bare number. */
export interface MatchEvidence {
  kind: MatchEvidenceKind
  description: string
  weight: number
}

/** One catalog item ranked against a detected product, with the evidence that produced its score. `score` is 0-1; matchAgainstCatalog() sorts these best-first. */
export interface CatalogMatchCandidate {
  catalogItem: CatalogItemRef
  score: number
  evidence: MatchEvidence[]
}

export type ImportConfidenceLabel = 'exact' | 'likely' | 'uncertain' | 'no_match'

/** An explainable confidence result — never a bare number. `ambiguous` is true when the top two catalog matches were close enough that a human should double-check before trusting `label`. */
export interface ConfidenceResult {
  score: number
  label: ImportConfidenceLabel
  reasons: string[]
  warnings: string[]
  ambiguous: boolean
}

export type ImportWarningCode =
  | 'missing_price'
  | 'missing_package_length'
  | 'missing_image'
  | 'missing_url'
  | 'unsupported_currency'
  | 'unresolved_catalog_item'
  | 'ambiguous_match'

export interface ImportWarning {
  code: ImportWarningCode
  message: string
}

export type DetectedPackageType = 'set' | 'reel' | 'hybrid' | 'other' | 'unknown'

/** The pure result of package.ts's detectPackage() — never invents a length that wasn't actually found in the text. */
export interface PackageDetectionResult {
  packageType: DetectedPackageType
  packageLengthM: number | null
  confidence: number
  evidence: string[]
  warnings: string[]
}

/**
 * The pure, in-memory result of the whole pipeline for ONE detected
 * product. This is the last stage Phase 13A builds — see
 * docs/retail-sync-architecture.md for why persistence (turning this into
 * a row a human can review across sessions) is deferred to a later phase.
 * Nothing in this codebase writes an ImportCandidateDraft to Supabase, and
 * nothing surfaces it in any admin or public UI in this phase.
 */
export interface ImportCandidateDraft {
  sourceRetailerId: string | number
  detectedTitle: string
  url: string | null
  imageUrl: string | null
  price: number | null
  currency: string | null
  availabilityText: string | null
  package: PackageDetectionResult
  suggestedCatalogItem: CatalogItemRef | null
  matches: CatalogMatchCandidate[]
  confidence: ConfidenceResult
  warnings: ImportWarning[]
  source: string
}

/**
 * The future adapter contract (Phase 13B implements the first real one —
 * see docs). `search()` and `parse()` are required; `normalize()` is
 * optional and should be used ONLY for a genuine retailer-specific
 * extraction quirk (e.g. a site that always prefixes titles with its own
 * store name) — it must never encode matching logic. Matching stays in
 * matcher.ts, which is unconditionally generic regardless of which
 * adapter produced a DetectedRetailProduct.
 */
export interface RetailerAdapter {
  id: string
  label: string
  search(query: RetailSearchQuery): Promise<RawRetailSearchResult[]>
  parse(raw: RawRetailSearchResult): DetectedRetailProduct | null
  normalize?(detected: DetectedRetailProduct): DetectedRetailProduct
}
