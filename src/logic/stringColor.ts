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
// Display ordering (the "priority"): the inventory color — the one
// specific color of the stock actually on hand, and only when that stock
// is NOT `unavailable` (public.inventory has one row per string, so
// there's only ever zero or one of these, never several "variants") —
// comes first, followed by any remaining catalog `colors` not already
// shown, deduplicated case-insensitively and alphabetically tie-broken.
// Catalog colors are always shown as a general fallback/supplement, not
// fully replaced by an inventory color the way earlier Phase 8/9 drafts
// of this module did — the inventory color is the more specific, more
// current fact, but the catalog range is still useful context. Never
// invents a color: an unrecognized name, or no data at all, always
// resolves to no swatch rather than a guessed placeholder.

import type { HybridStringMeta, StringItem } from '../data/strings.js'

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
 * the known table — callers must render no swatch in that case rather
 * than a misleading neutral placeholder.
 */
export function resolveStringColor(name: string | undefined | null): StringColorSwatch | undefined {
  if (!name) return undefined
  const def = COLOR_DEFINITIONS[normalize(name)]
  if (!def) return undefined
  return { label: titleCase(name), hex: def.hex, ringClassName: def.ringClassName }
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

/** A stock of `'unavailable'` means the inventory row's color no longer represents something a customer can actually get — see buildColorPreview's doc comment. */
function isInventoryColorAvailable(item: Pick<StringItem, 'inventoryColor' | 'stock'>): boolean {
  return Boolean(item.inventoryColor) && item.stock !== 'unavailable'
}

/**
 * The single entry point every color-swatch-rendering component should
 * use.
 *
 * Hybrid strings: only render the true two-tone split when BOTH main and
 * cross colors are known (never inventing one side to pair with a known
 * other side — a single known side renders as an ordinary solid swatch
 * instead, since a "half known / half invented" split would misrepresent
 * the string).
 *
 * Non-hybrid strings: the inventory color (the one specific color of
 * stock actually on hand) is shown first, but ONLY when that stock isn't
 * `unavailable` — an inventory color on a string that's out of stock is
 * not "currently available from the stringing service" and is silently
 * excluded here (see logic/colorDiagnostics.ts for surfacing that on the
 * debug page instead of hiding it entirely). Any catalog `colors` not
 * already covered by the inventory color are appended after it,
 * deduplicated case-insensitively and sorted alphabetically by label —
 * catalog colors are a supplementary fallback, not simply discarded just
 * because a more specific inventory color exists. Never fabricates a
 * color for a name this module doesn't recognize.
 */
export function buildColorPreview(item: Pick<StringItem, 'isHybrid' | 'mainString' | 'crossString' | 'inventoryColor' | 'colors' | 'stock'>, maxVisible = 3): ColorPreview {
  if (item.isHybrid) {
    const main = hybridSideColor(item.mainString)
    const cross = hybridSideColor(item.crossString)
    if (main && cross) return { kind: 'hybrid', main, cross }
    if (main) return { kind: 'solid', visible: [main], overflow: [] }
    if (cross) return { kind: 'solid', visible: [cross], overflow: [] }
    return { kind: 'none' }
  }

  const inventorySwatch = isInventoryColorAvailable(item) ? resolveStringColor(item.inventoryColor) : undefined

  const catalogSwatches = resolveAllColors(item.colors ?? [])
    .filter((s) => !inventorySwatch || s.hex !== inventorySwatch.hex)
    .sort((a, b) => a.label.localeCompare(b.label))

  const swatches = inventorySwatch ? [inventorySwatch, ...catalogSwatches] : catalogSwatches
  if (swatches.length === 0) return { kind: 'none' }
  return { kind: 'solid', visible: swatches.slice(0, maxVisible), overflow: swatches.slice(maxVisible) }
}
