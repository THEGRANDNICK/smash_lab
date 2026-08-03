// Phase 13A — Part 3: pure normalization helpers for retail-product
// matching. Every function here is a plain string -> string (or -> data)
// transform with no side effects, so the matcher (matcher.ts) can be
// tested and reasoned about without any network or database involved.
//
// Reuses the codebase's EXISTING safe-URL rule (SAFE_URL_PATTERN) and
// EXISTING supported-currency list (RETAILER_CURRENCIES) rather than
// inventing a second copy of either — see docs/retail-sync-architecture.md.

import { SAFE_URL_PATTERN } from '../../services/catalogService.js'
import { RETAILER_CURRENCIES } from '../../services/retailerPriceService.js'
import type { ImportWarning } from './types.js'

/** Generic retail vocabulary that describes PACKAGING or marketing, never product identity — stripped before two titles/names are compared for "is this the same product", so "Yonex BG80 Badminton String Set" and "Yonex BG80" compare as identical products. Package words are still read separately, from the ORIGINAL (un-stripped) text, by packageDetection.ts — stripping them here never loses that information. */
const GENERIC_RETAIL_WORDS = new Set([
  'badminton',
  'string',
  'strings',
  'racket',
  'racquet',
  'set',
  'reel',
  'roll',
  'spool',
  'pack',
  'package',
  'packaging',
  'new',
  'original',
  'genuine',
  'official',
  'the',
  'a',
  'an',
  'of',
  'for',
  'with',
  'and',
  'm',
  'metre',
  'metres',
  'meter',
  'meters',
])

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
}

/** Decodes the handful of HTML entities that actually turn up in scraped retail titles ("Fischer &amp; Sons" style ampersands, stray &nbsp;). Anything not in the small known table is left untouched rather than guessed. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity)
}

export function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** NFKD-decomposes and strips combining diacritics, then lowercases — "Ø" behaves like "o", "É" like "e", so titles from different retailer locales compare the same way without a hardcoded accent table. */
export function normalizeUnicodeCase(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Joins a short letter-run immediately adjacent to a digit-run (separated by nothing, a hyphen, or whitespace) into one token, so "BG 80", "BG-80", and "BG80" all preserve the identical model code instead of the code being torn into two tokens ("bg", "80") or discarded. Meaningful model numbers are never removed — only their separators are normalized away. */
export function preserveModelCodes(text: string): string {
  return text.replace(/\b([a-z]+)[\s-]+(\d+[a-z]*)\b/gi, '$1$2')
}

/** The full pure normalization pipeline for one piece of retail text (a title, a brand, a catalog name): HTML-entity cleanup, unicode/case fold, model-code joining, punctuation-to-space, whitespace collapse. Never removes a digit or letter — only reshapes separators, case, and accents. */
export function normalizeText(text: string): string {
  const decoded = decodeHtmlEntities(text)
  const folded = normalizeUnicodeCase(decoded)
  const modelJoined = preserveModelCodes(folded)
  const punctuationStripped = modelJoined.replace(/[^a-z0-9]+/g, ' ')
  return normalizeWhitespace(punctuationStripped)
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text)
  return normalized === '' ? [] : normalized.split(' ')
}

/** Tokens with generic retail/packaging vocabulary removed — see GENERIC_RETAIL_WORDS. Model codes (already joined by preserveModelCodes inside tokenize()) are never in that list, so they always survive. */
export function removeGenericRetailWords(tokens: readonly string[]): string[] {
  return tokens.filter((t) => !GENERIC_RETAIL_WORDS.has(t))
}

/** The token set actually used for product-identity comparison: normalized, tokenized, stripped of packaging/marketing words, and stripped of bare quantity tokens (pure digits with no letters — e.g. the "10" in "10 m" or "200" in "200m reel"). Package quantities are read separately, from the ORIGINAL text, by packageDetection.ts — a real model code always carries a letter (see extractModelCodes), so this never discards actual product identity. This is what the matcher compares — never the raw title. */
export function significantTokens(text: string): string[] {
  return removeGenericRetailWords(tokenize(text)).filter((token) => !/^\d+$/.test(token))
}

export function normalizeBrand(brand: string): string {
  return normalizeText(brand)
}

/** Extracts every model-code-shaped token (a run containing BOTH a letter and a digit, e.g. "bg80", "exbolt63") from a piece of text, after normalization — used by the matcher's top-tier "exact model code" evidence, which runs before any fuzzy similarity. Order of appearance is preserved; duplicates are not removed (callers compare via Set). */
export function extractModelCodes(text: string): string[] {
  return tokenize(text).filter((token) => /[a-z]/.test(token) && /\d/.test(token))
}

export type NormalizedFieldResult<T> = { value: T | null; warning: ImportWarning | null }

/** Reuses the EXISTING safe-URL rule (src/services/catalogService.ts's SAFE_URL_PATTERN — the same rule catalog and retailer-listing admin forms already enforce) rather than a second regex. A present-but-unsafe URL is dropped with a warning instead of being silently kept or thrown. */
export function normalizeUrl(raw: string | undefined): NormalizedFieldResult<string> {
  if (raw == null) return { value: null, warning: null }
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, warning: null }
  if (!SAFE_URL_PATTERN.test(trimmed)) {
    return { value: null, warning: { code: 'missing_url', message: `"${trimmed}" is not a safe http(s) URL and was discarded.` } }
  }
  return { value: trimmed, warning: null }
}

/** Reuses the EXISTING supported-currency list (retailerPriceService.ts's RETAILER_CURRENCIES — currently just EUR) rather than a second list, so a detected currency this codebase can't yet price is flagged instead of silently accepted. */
export function normalizeCurrencyCode(raw: string | undefined): NormalizedFieldResult<string> {
  if (raw == null) return { value: null, warning: null }
  const upper = raw.trim().toUpperCase()
  if (upper === '') return { value: null, warning: null }
  if (!(RETAILER_CURRENCIES as readonly string[]).includes(upper)) {
    return { value: null, warning: { code: 'unsupported_currency', message: `Currency "${upper}" is not supported yet (only ${RETAILER_CURRENCIES.join(', ')}).` } }
  }
  return { value: upper, warning: null }
}
