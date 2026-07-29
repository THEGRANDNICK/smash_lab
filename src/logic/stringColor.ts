// Phase 8 introduced the first version of this module reading only the
// catalog's `StringItem.colors` free-text list. Phase 9 investigated why
// swatches were never actually visible in the live app and found two
// causes (see README's "String color investigation" section for the full
// writeup):
//   1. No real catalog string had `colors` populated yet (an admin-data
//      gap, not a code gap).
//   2. Inventory rows have always carried their own single `color` field
//      (services/inventoryService.ts, editable via the Inventory admin
//      page), but mergeInventoryIntoCatalog() silently dropped it instead
//      of passing it onto the merged StringItem the UI actually renders.
//      That's now fixed (see inventoryService.ts's Phase 9 comment) —
//      this module reads the result via StringItem.inventoryColor.
//
// Display ordering (the "priority"): the inventory color(s) — the
// colors of the stock actually on hand, and only when that stock is NOT
// `unavailable` — come first, followed by any remaining catalog `colors`
// not already shown, deduplicated case-insensitively and alphabetically
// tie-broken. Catalog colors are always shown as a general
// fallback/supplement, never fully replaced by an inventory color. Never
// invents a color: an unrecognized name, or no data at all, always
// resolves to no swatch rather than a guessed placeholder.
//
// Phase 9 fix (real Supabase testing): `public.inventory` still has one
// row per string (`string_id` is its primary key — see README's "Real
// Supabase cleanup" section for why this module doesn't assume multiple
// rows), so a stringer entering more than one currently-available color
// has nowhere to put them except that single free-text field. This
// module now safely splits that field on commas/semicolons
// (logic/colorParsing.ts) so "White, Red" or "White; Red" render as two
// swatches instead of one unresolved blob. A bare slash ("Black/Yellow")
// is never guessed as two ordinary colors — it's only ever treated as a
// hybrid main/cross pair (see buildColorPreview's hybrid branch), and
// flagged in diagnostics otherwise.

import type { HybridStringMeta, StringItem } from '../data/strings.js'
import { splitColorList, parseLegacyHybridPair } from './colorParsing.js'

export interface StringColorSwatch {
  /** Human-readable label, capitalized from the original catalog/inventory text (e.g. "Neon Yellow"). */
  label: string
  /** CSS color value for the swatch fill (may include an alpha channel, e.g. Transparent's). */
  hex: string
  /** Tailwind ring classes tuned per-color for visibility against both light and dark, and against the dark hero background. */
  ringClassName: string
}

interface ColorDefinition {
  hex: string
  ringClassName: string
}

/** For colors that read fine against both a light card and the dark hero without extra help. */
const SUBTLE_RING = 'ring-1 ring-black/10 dark:ring-white/25'
/** For colors that disappear into one background or the other without a firmer edge — white, black, silver, natural, transparent, neon yellow. */
const STRONG_RING = 'ring-1 ring-black/30 dark:ring-white/50'

/** Keys are lowercase, trimmed color names. Add more here as real catalog/inventory data uses them — never guessed ad hoc in a component. */
const COLOR_DEFINITIONS: Record<string, ColorDefinition> = {
  yellow: { hex: '#f5d90a', ringClassName: STRONG_RING },
  'neon yellow': { hex: '#e3ff00', ringClassName: STRONG_RING },
  'neon green': { hex: '#39ff14', ringClassName: STRONG_RING },
  white: { hex: '#ffffff', ringClassName: STRONG_RING },
  black: { hex: '#15161a', ringClassName: STRONG_RING },
  red: { hex: '#dc2626', ringClassName: SUBTLE_RING },
  blue: { hex: '#2563eb', ringClassName: SUBTLE_RING },
  green: { hex: '#16a34a', ringClassName: SUBTLE_RING },
  orange: { hex: '#ea580c', ringClassName: SUBTLE_RING },
  pink: { hex: '#ec4899', ringClassName: SUBTLE_RING },
  purple: { hex: '#9333ea', ringClassName: SUBTLE_RING },
  silver: { hex: '#c3c6cc', ringClassName: STRONG_RING },
  grey: { hex: '#9ca3af', ringClassName: SUBTLE_RING },
  gray: { hex: '#9ca3af', ringClassName: SUBTLE_RING },
  natural: { hex: '#f2ead8', ringClassName: STRONG_RING },
  transparent: { hex: '#e7ecefcc', ringClassName: STRONG_RING },
  turquoise: { hex: '#14b8a6', ringClassName: SUBTLE_RING },
  lime: { hex: '#84cc16', ringClassName: SUBTLE_RING },
  navy: { hex: '#1e3a8a', ringClassName: SUBTLE_RING },
  'sky blue': { hex: '#38bdf8', ringClassName: SUBTLE_RING },
  'royal blue': { hex: '#2452e8', ringClassName: SUBTLE_RING },
  mint: { hex: '#6ee7b7', ringClassName: STRONG_RING },
  coral: { hex: '#fb7360', ringClassName: SUBTLE_RING },
  violet: { hex: '#7c3aed', ringClassName: SUBTLE_RING },
  'cosmic gold': { hex: '#c9a227', ringClassName: SUBTLE_RING },
}

/**
 * Legacy/misspelled real-world values mapped to a canonical
 * COLOR_DEFINITIONS key — e.g. real Supabase data has "Turquois" where
 * "Turquoise" was meant. Keys and values are both normalized (lowercase,
 * single-spaced) `normalize()` output. Centralized here rather than
 * guessed ad hoc in a component; add more as real data surfaces them.
 */
const COLOR_ALIASES: Record<string, string> = {
  turquois: 'turquoise',
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * Resolves one color name to a swatch, or undefined if the name isn't in
 * the known table (after alias canonicalization) — callers must render
 * no swatch in that case rather than a misleading neutral placeholder.
 * An alias hit (e.g. "Turquois") displays the *canonical* label
 * ("Turquoise"), fixing the misspelling for display without ever
 * rewriting the stored raw value.
 */
export function resolveStringColor(name: string | undefined | null): StringColorSwatch | undefined {
  if (!name) return undefined
  const normalized = normalize(name)
  const canonicalKey = COLOR_ALIASES[normalized] ?? normalized
  const def = COLOR_DEFINITIONS[canonicalKey]
  if (!def) return undefined
  return { label: titleCase(canonicalKey), hex: def.hex, ringClassName: def.ringClassName }
}

/** For admin diagnostics only: if `name` matches a known alias (e.g. "Turquois"), returns the raw text and the canonical label it resolves to ("Turquoise"); undefined if `name` isn't an alias (whether or not it's otherwise a recognized color). */
export function describeColorAlias(name: string | undefined | null): { raw: string; canonical: string } | undefined {
  if (!name) return undefined
  const normalized = normalize(name)
  const canonicalKey = COLOR_ALIASES[normalized]
  if (!canonicalKey) return undefined
  return { raw: name, canonical: titleCase(canonicalKey) }
}

/** Recognized swatches from a name list, in order, deduplicated by resolved color (so "Yellow" and "yellow" don't both render). Unrecognized names are silently skipped, never guessed. */
function resolveAllColors(names: readonly string[]): StringColorSwatch[] {
  const seen = new Set<string>()
  const result: StringColorSwatch[] = []
  for (const name of names) {
    const swatch = resolveStringColor(name)
    if (!swatch || seen.has(swatch.hex)) continue
    seen.add(swatch.hex)
    result.push(swatch)
  }
  return result
}

/** @deprecated Superseded by buildColorPreview()'s inventory→catalog priority and hybrid handling — kept only as a thin wrapper for callers/tests still using the single-swatch Phase 8 API. */
export function primaryStringColor(colors: readonly string[] | undefined): StringColorSwatch | undefined {
  if (!colors) return undefined
  return resolveAllColors(colors)[0]
}

/** @deprecated Superseded by buildColorPreview() — kept only as a thin wrapper for callers/tests still using the Phase 8 API. */
export function allStringColors(colors: readonly string[] | undefined, max = 3): StringColorSwatch[] {
  if (!colors) return []
  return resolveAllColors(colors).slice(0, max)
}

export interface HybridColorPreview {
  kind: 'hybrid'
  main: StringColorSwatch
  cross: StringColorSwatch
}

export interface SolidColorPreview {
  kind: 'solid'
  /** Swatches to render immediately, up to the caller's `maxVisible`. */
  visible: StringColorSwatch[]
  /** Remaining recognized swatches beyond `maxVisible`, shown after a "+N" control is activated. */
  overflow: StringColorSwatch[]
}

export interface NoColorPreview {
  kind: 'none'
}

export type ColorPreview = HybridColorPreview | SolidColorPreview | NoColorPreview

function hybridSideColor(side: HybridStringMeta | undefined): StringColorSwatch | undefined {
  return resolveStringColor(side?.color)
}

/** A stock of `'unavailable'` means the inventory row's color(s) no longer represent something a customer can actually get — see buildColorPreview's doc comment. */
function isInventoryColorAvailable(item: Pick<StringItem, 'inventoryColor' | 'stock'>): boolean {
  return Boolean(item.inventoryColor) && item.stock !== 'unavailable'
}

/**
 * Recognized swatches from the inventory's single free-text `color`
 * field, in entry order — split on commas/semicolons only (see
 * logic/colorParsing.ts), so "White, Red" yields two swatches while a
 * bare slash is left untouched here (that's only ever a hybrid
 * main/cross signal, handled separately in buildColorPreview). Empty
 * when the row is out of stock (see isInventoryColorAvailable).
 */
function resolveInventoryColors(item: Pick<StringItem, 'inventoryColor' | 'stock'>): StringColorSwatch[] {
  if (!isInventoryColorAvailable(item)) return []
  return resolveAllColors(splitColorList(item.inventoryColor))
}

export type HybridColorSource =
  | { kind: 'structured-both'; main: StringColorSwatch; cross: StringColorSwatch }
  | { kind: 'structured-partial'; known: StringColorSwatch; missingSide: 'main' | 'cross' }
  | { kind: 'legacy-pair'; main: StringColorSwatch; cross: StringColorSwatch }
  | { kind: 'none' }

/**
 * Determines where a hybrid string's color(s) come from, in priority
 * order — used by buildColorPreview and by colorDiagnostics.ts (which
 * needs to know *which* path was used, not just the resulting swatches):
 *   1. Structured `mainString.color`/`crossString.color` metadata (the
 *      catalog admin's dedicated hybrid fields) — 'structured-both' when
 *      both resolve, 'structured-partial' when only one does (never
 *      inventing the other side).
 *   2. If NEITHER structured side is known, the inventory row's raw text
 *      ONLY if it parses unambiguously as a "Main/Cross" pair
 *      (logic/colorParsing.ts's parseLegacyHybridPair) — e.g. real data
 *      like "White/Red" for AeroBite entered before the catalog admin's
 *      hybrid color fields were used. A hybrid never falls back to its
 *      own top-level `colors` list (that would misrepresent which side
 *      is which).
 *   3. 'none' otherwise.
 */
export function hybridColorSource(item: Pick<StringItem, 'mainString' | 'crossString' | 'inventoryColor' | 'stock'>): HybridColorSource {
  const structuredMain = hybridSideColor(item.mainString)
  const structuredCross = hybridSideColor(item.crossString)
  if (structuredMain && structuredCross) return { kind: 'structured-both', main: structuredMain, cross: structuredCross }
  if (structuredMain) return { kind: 'structured-partial', known: structuredMain, missingSide: 'cross' }
  if (structuredCross) return { kind: 'structured-partial', known: structuredCross, missingSide: 'main' }

  const legacySource = isInventoryColorAvailable(item) ? item.inventoryColor : undefined
  const pair = parseLegacyHybridPair(legacySource)
  if (pair) {
    const legacyMain = resolveStringColor(pair.main)
    const legacyCross = resolveStringColor(pair.cross)
    if (legacyMain && legacyCross) return { kind: 'legacy-pair', main: legacyMain, cross: legacyCross }
  }
  return { kind: 'none' }
}

/**
 * The single entry point every color-swatch-rendering component should
 * use. See hybridColorSource() for the hybrid priority order. Non-hybrid
 * strings: the inventory row's color(s) — split safely on
 * commas/semicolons, in entry order — are shown first, but ONLY when
 * that stock isn't `unavailable` (see logic/colorDiagnostics.ts for
 * surfacing hidden colors on the debug page instead of hiding them
 * entirely). Any catalog `colors` not already covered by an inventory
 * color are appended after, deduplicated case-insensitively and sorted
 * alphabetically by label. Never fabricates a color for a name this
 * module doesn't recognize.
 */
export function buildColorPreview(item: Pick<StringItem, 'isHybrid' | 'mainString' | 'crossString' | 'inventoryColor' | 'colors' | 'stock'>, maxVisible = 3): ColorPreview {
  if (item.isHybrid) {
    const source = hybridColorSource(item)
    switch (source.kind) {
      case 'structured-both':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'structured-partial':
        return { kind: 'solid', visible: [source.known], overflow: [] }
      case 'legacy-pair':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'none':
        return { kind: 'none' }
    }
  }

  const inventorySwatches = resolveInventoryColors(item)
  const inventoryHexes = new Set(inventorySwatches.map((s) => s.hex))

  const catalogSwatches = resolveAllColors(item.colors ?? [])
    .filter((s) => !inventoryHexes.has(s.hex))
    .sort((a, b) => a.label.localeCompare(b.label))

  const swatches = [...inventorySwatches, ...catalogSwatches]
  if (swatches.length === 0) return { kind: 'none' }
  return { kind: 'solid', visible: swatches.slice(0, maxVisible), overflow: swatches.slice(maxVisible) }
}
