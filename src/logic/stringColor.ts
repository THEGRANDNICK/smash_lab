// Phase 8 polish — a single, deterministic mapping from the catalog's own
// existing `StringItem.colors` free-text list (see data/strings.ts and the
// admin "Colors" field in CatalogStringForm.tsx) to a displayable swatch.
//
// Deliberately reads ONLY StringItem.colors, never inventory data:
// inventory rows also carry their own per-row `color` field (see
// services/inventoryService.ts), but mergeInventoryIntoCatalog() doesn't
// currently pass it onto the merged StringItem, and plumbing it through
// would mean changing inventory-merge logic — explicitly out of scope for
// this UI-only polish phase. See the README's "String-color data source"
// note for the full explanation and the suggested follow-up.
//
// Never invents a color: a name with no entry below simply produces no
// swatch (see resolveStringColor's doc comment) rather than guessing.

export interface StringColorSwatch {
  /** Human-readable label, capitalized from the original catalog text (e.g. "Neon Yellow"). */
  label: string
  /** CSS color value for the swatch fill. */
  hex: string
  /** Tailwind ring classes tuned per-color for visibility against both light and dark, and against the dark hero background. */
  ringClassName: string
}

interface ColorDefinition {
  hex: string
  ringClassName: string
}

const SUBTLE_RING = 'ring-1 ring-black/10 dark:ring-white/25'
const STRONG_RING = 'ring-1 ring-black/30 dark:ring-white/50'

/** Keys are lowercase, trimmed color names. Add more here as real catalog data uses them — never guessed ad hoc in a component. */
const COLOR_DEFINITIONS: Record<string, ColorDefinition> = {
  yellow: { hex: '#f5d90a', ringClassName: STRONG_RING },
  'neon yellow': { hex: '#e3ff00', ringClassName: STRONG_RING },
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
  turquoise: { hex: '#14b8a6', ringClassName: SUBTLE_RING },
  lime: { hex: '#84cc16', ringClassName: SUBTLE_RING },
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
 * Resolves one catalog color name to a swatch, or undefined if the name
 * isn't in the known table — callers must render no swatch in that case
 * rather than a misleading neutral placeholder.
 */
export function resolveStringColor(name: string | undefined | null): StringColorSwatch | undefined {
  if (!name) return undefined
  const def = COLOR_DEFINITIONS[normalize(name)]
  if (!def) return undefined
  return { label: titleCase(name), hex: def.hex, ringClassName: def.ringClassName }
}

/**
 * The single "primary" swatch for a string — the first recognized color in
 * its existing `colors` list (deterministic: list order as entered by the
 * admin), or undefined if the string has no colors or none are recognized.
 */
export function primaryStringColor(colors: readonly string[] | undefined): StringColorSwatch | undefined {
  if (!colors || colors.length === 0) return undefined
  for (const name of colors) {
    const swatch = resolveStringColor(name)
    if (swatch) return swatch
  }
  return undefined
}

/**
 * Up to `max` recognized swatches, in list order, deduplicated by resolved
 * color (so e.g. "Yellow" and "yellow" don't both render) — for contexts
 * with room to show more than one (catalog cards), never for compact ones
 * (comparison table headings, hero) which should use primaryStringColor.
 */
export function allStringColors(colors: readonly string[] | undefined, max = 3): StringColorSwatch[] {
  if (!colors || colors.length === 0) return []
  const seen = new Set<string>()
  const result: StringColorSwatch[] = []
  for (const name of colors) {
    const swatch = resolveStringColor(name)
    if (!swatch || seen.has(swatch.hex)) continue
    seen.add(swatch.hex)
    result.push(swatch)
    if (result.length >= max) break
  }
  return result
}
