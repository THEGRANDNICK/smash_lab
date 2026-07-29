// Phase 9 — pure diagnostics for the existing /debug/supabase surface (see
// components/SupabaseDebugPage.tsx). Deliberately not a new dashboard: just
// a summary object the debug page renders inside its existing layout,
// mirroring the established pattern of retailerPriceService.ts's
// summarizeRetailerDiagnostics().
//
// Phase 9 fix (real Supabase testing): extended with fields that help
// clean up real, messy free-text color data by hand — delimiter-bearing
// inventory values, ambiguous slash values, aliases actually in use, and
// how each hybrid string's colors were resolved (structured fields vs. a
// legacy combined value vs. missing).

import type { StringItem } from '../data/strings.js'
import { resolveStringColor, buildColorPreview, describeColorAlias, hybridColorSource } from './stringColor.js'
import { containsUnambiguousDelimiter, containsSlash, parseLegacyHybridPair } from './colorParsing.js'

export interface ColorDiagnosticsSummary {
  withInventoryColor: number
  withCatalogColors: number
  withNeither: number
  /** Raw, as-entered values that don't resolve to a known color — kept for admin diagnostics, never rendered as a swatch. */
  unknownColorValues: string[]
  /** One entry per string whose own `colors` list contains the same color more than once under different casing, e.g. "yonex-bg80: Yellow, yellow". */
  duplicateCaseInsensitiveColors: string[]
  /** Hybrid strings missing a main and/or cross color (after considering any legacy combined-value fallback) — string ids. */
  hybridMissingColors: string[]
  /** Strings with an inventoryColor that's currently excluded from display because the string is out of stock. */
  hiddenDueToUnavailableInventory: number
  /** Distinct resolved colors (by hex) across the whole catalog — inventory, catalog, and hybrid sides combined. */
  totalUniqueMappedColors: number
  /** "id: raw value" pairs where the inventory `color` field contains a comma/semicolon — i.e. more than one color packed into the single free-text field. Informational, not an error: this app parses them safely, but a real inventory-variant model (see README) would represent them more cleanly. */
  inventoryValuesWithDelimiters: string[]
  /** "id: raw value" pairs containing a bare "/" that did NOT resolve as a clean hybrid main/cross pair — ambiguous data that needs a human to interpret (two colors? a typo? something else). */
  ambiguousSlashValues: string[]
  /** "id: raw → canonical" pairs for every alias match found (e.g. "yonex-exbolt-68: Turquois → Turquoise") — surfaces legacy/misspelled values actually in use without ever rewriting the stored data automatically. */
  canonicalizedAliasesUsed: string[]
  /** Strings currently showing more than one available inventory color (from a delimited or otherwise multi-token field). */
  stringsWithMultipleAvailableInventoryColors: number
  /** Hybrid strings whose split swatch (or single known side) comes from the catalog admin's structured main/cross fields. */
  hybridsUsingStructuredColors: number
  /** Hybrid strings whose split swatch comes from parsing a legacy combined inventory value (e.g. "White/Red") because no structured color was set. */
  hybridsUsingLegacyFallback: number
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Raw color-bearing values on one item — every place a color name can be entered. */
function rawColorValues(item: StringItem): string[] {
  const values: string[] = []
  if (item.inventoryColor) values.push(item.inventoryColor)
  if (item.colors) values.push(...item.colors)
  if (item.mainString?.color) values.push(item.mainString.color)
  if (item.crossString?.color) values.push(item.crossString.color)
  return values
}

export function summarizeColorDiagnostics(items: readonly StringItem[]): ColorDiagnosticsSummary {
  let withInventoryColor = 0
  let withCatalogColors = 0
  let withNeither = 0
  let hiddenDueToUnavailableInventory = 0
  let stringsWithMultipleAvailableInventoryColors = 0
  let hybridsUsingStructuredColors = 0
  let hybridsUsingLegacyFallback = 0

  const unknownSeen = new Set<string>()
  const unknownColorValues: string[] = []
  const duplicateCaseInsensitiveColors: string[] = []
  const hybridMissingColors: string[] = []
  const uniqueMappedHexes = new Set<string>()
  const inventoryValuesWithDelimiters: string[] = []
  const ambiguousSlashValues: string[] = []
  const canonicalizedAliasesUsed: string[] = []

  for (const item of items) {
    if (item.inventoryColor) withInventoryColor++
    if (item.colors && item.colors.length > 0) withCatalogColors++
    if (buildColorPreview(item).kind === 'none') withNeither++
    if (item.inventoryColor && item.stock === 'unavailable') hiddenDueToUnavailableInventory++

    if (item.inventoryColor && item.stock !== 'unavailable') {
      const preview = buildColorPreview(item)
      const availableCount = preview.kind === 'solid' ? preview.visible.length + preview.overflow.length : 0
      if (!item.isHybrid && availableCount > 1) stringsWithMultipleAvailableInventoryColors++
    }

    if (item.isHybrid) {
      const source = hybridColorSource(item)
      if (source.kind === 'structured-both' || source.kind === 'structured-partial') hybridsUsingStructuredColors++
      else if (source.kind === 'legacy-pair') hybridsUsingLegacyFallback++
      if (source.kind !== 'structured-both' && source.kind !== 'legacy-pair') hybridMissingColors.push(item.id)
    }

    if (item.inventoryColor) {
      if (containsUnambiguousDelimiter(item.inventoryColor)) {
        inventoryValuesWithDelimiters.push(`${item.id}: ${item.inventoryColor}`)
      }
      if (containsSlash(item.inventoryColor)) {
        const resolvedAsHybridPair = item.isHybrid && parseLegacyHybridPair(item.inventoryColor) != null
        if (!resolvedAsHybridPair) ambiguousSlashValues.push(`${item.id}: ${item.inventoryColor}`)
      }
    }

    if (item.colors && item.colors.length > 1) {
      const byKey = new Map<string, Set<string>>()
      for (const raw of item.colors) {
        const key = normalizeKey(raw)
        const group = byKey.get(key) ?? new Set<string>()
        group.add(raw)
        byKey.set(key, group)
      }
      for (const group of byKey.values()) {
        if (group.size > 1) duplicateCaseInsensitiveColors.push(`${item.id}: ${[...group].join(', ')}`)
      }
    }

    for (const raw of rawColorValues(item)) {
      const swatch = resolveStringColor(raw)
      if (swatch) {
        uniqueMappedHexes.add(swatch.hex)
      } else {
        const key = normalizeKey(raw)
        if (!unknownSeen.has(key)) {
          unknownSeen.add(key)
          unknownColorValues.push(raw)
        }
      }

      const alias = describeColorAlias(raw)
      if (alias) canonicalizedAliasesUsed.push(`${item.id}: ${alias.raw} → ${alias.canonical}`)
    }
  }

  return {
    withInventoryColor,
    withCatalogColors,
    withNeither,
    unknownColorValues,
    duplicateCaseInsensitiveColors,
    hybridMissingColors,
    hiddenDueToUnavailableInventory,
    totalUniqueMappedColors: uniqueMappedHexes.size,
    inventoryValuesWithDelimiters,
    ambiguousSlashValues,
    canonicalizedAliasesUsed,
    stringsWithMultipleAvailableInventoryColors,
    hybridsUsingStructuredColors,
    hybridsUsingLegacyFallback,
  }
}
