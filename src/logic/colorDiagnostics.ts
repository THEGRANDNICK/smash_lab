// Admin-only diagnostics for the existing /debug/supabase surface (see
// components/SupabaseDebugPage.tsx). Deliberately not a new dashboard: just
// a summary object the debug page renders inside its existing layout,
// mirroring the established pattern of retailerPriceService.ts's
// summarizeRetailerDiagnostics().
//
// Public physical-color rendering was removed (see logic/stringColor.ts's
// header comment and the README's "Public color display deferred"
// section) after real-world testing found it too inconsistent to trust.
// This module is kept specifically because it's still useful for
// progressively cleaning up real Supabase color data by hand — which raw
// values resolve automatically and which don't, which hybrid strings have
// a usable pair vs. only one side, which aliases are in use — ahead of a
// possible future, properly normalized color model. None of this drives
// any public rendering.

import type { StringItem } from '../data/strings.js'
import { resolveColor, hybridColorSource, buildColorPreview, type ColorResolutionSource } from './stringColor.js'
import { containsUnambiguousDelimiter, containsSlash, parseLegacyHybridPair } from './colorParsing.js'

export interface ColorDiagnosticsSummary {
  withInventoryColor: number
  withCatalogColors: number
  withNeither: number
  /** Strings that had SOME raw color text entered somewhere, but none of it resolved via any tier — distinct from withNeither, which also includes strings with no color data at all. */
  omittedDueToUnresolvedColor: number
  /** Raw, as-entered values that don't resolve via any tier — kept for admin diagnostics. */
  unknownColorValues: string[]
  /** One entry per string whose own `colors` list contains the same color more than once under different casing, e.g. "yonex-bg80: Yellow, yellow". */
  duplicateCaseInsensitiveColors: string[]
  /** Hybrid strings missing a main and/or cross color entirely (after considering any legacy fallback) — string ids. */
  hybridMissingColors: string[]
  /** Hybrid strings with only ONE side known (structured-partial or a single legacy value) — string ids. Distinct from hybridMissingColors, which is BOTH sides missing. */
  partialHybridPairs: string[]
  /** Strings with an inventoryColor that's currently excluded from consideration because the string is out of stock. */
  hiddenDueToUnavailableInventory: number
  /** Distinct resolved colors (by rendered CSS value) across the whole catalog — inventory, catalog, and hybrid sides combined. */
  totalUniqueMappedColors: number
  /** "id: raw value" pairs where the inventory `color` field contains a comma/semicolon — i.e. more than one color packed into the single free-text field. */
  inventoryValuesWithDelimiters: string[]
  /** "id: raw value" pairs containing a bare "/" that did NOT resolve as a clean hybrid main/cross pair — ambiguous data that needs a human to interpret (two colors? a typo? something else). */
  ambiguousSlashValues: string[]
  /** "id: raw → canonical" pairs for every alias match found (e.g. "yonex-exbolt-68: Turquois → Turquoise") — surfaces legacy/misspelled values actually in use without ever rewriting the stored data automatically. */
  canonicalizedAliasesUsed: string[]
  /** Strings with more than one available inventory color (from a delimited or otherwise multi-token field). */
  stringsWithMultipleAvailableInventoryColors: number
  /** Hybrid strings whose colors would come from the catalog admin's structured main/cross fields. */
  hybridsUsingStructuredColors: number
  /** Hybrid strings whose colors would come from parsing a legacy combined inventory value (e.g. "White/Red") because no structured color was set. */
  hybridsUsingLegacyFallback: number
  /** Count of every raw color value seen, grouped by which resolution tier produced it — a quick read on how automatic vs. manual the current data is. */
  resolutionSourceCounts: Record<ColorResolutionSource, number>
  /** Deduplicated "raw name → inferred base color" pairs for every value resolved via automatic tokenized inference (e.g. "Fire Orange → orange"). */
  inferredColorNames: string[]
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

const EMPTY_SOURCE_COUNTS: Record<ColorResolutionSource, number> = {
  explicit_css: 0,
  css_named_color: 0,
  inferred_keyword: 0,
  alias: 0,
  unresolved: 0,
}

export function summarizeColorDiagnostics(items: readonly StringItem[]): ColorDiagnosticsSummary {
  let withInventoryColor = 0
  let withCatalogColors = 0
  let withNeither = 0
  let omittedDueToUnresolvedColor = 0
  let hiddenDueToUnavailableInventory = 0
  let stringsWithMultipleAvailableInventoryColors = 0
  let hybridsUsingStructuredColors = 0
  let hybridsUsingLegacyFallback = 0

  const unknownSeen = new Set<string>()
  const unknownColorValues: string[] = []
  const duplicateCaseInsensitiveColors: string[] = []
  const hybridMissingColors: string[] = []
  const partialHybridPairs: string[] = []
  const uniqueMappedValues = new Set<string>()
  const inventoryValuesWithDelimiters: string[] = []
  const ambiguousSlashValues: string[] = []
  const canonicalizedAliasesUsed: string[] = []
  const resolutionSourceCounts: Record<ColorResolutionSource, number> = { ...EMPTY_SOURCE_COUNTS }
  const inferredSeen = new Set<string>()
  const inferredColorNames: string[] = []

  function trackResolution(raw: string) {
    const resolution = resolveColor(raw)
    resolutionSourceCounts[resolution.source]++
    if (resolution.cssColor) {
      uniqueMappedValues.add(resolution.cssColor)
    } else {
      const key = normalizeKey(raw)
      if (!unknownSeen.has(key)) {
        unknownSeen.add(key)
        unknownColorValues.push(raw)
      }
    }
    if (resolution.source === 'alias') {
      canonicalizedAliasesUsed.push(`${raw} → ${resolution.displayName}`)
    }
    if (resolution.source === 'inferred_keyword') {
      const key = normalizeKey(raw)
      if (!inferredSeen.has(key)) {
        inferredSeen.add(key)
        inferredColorNames.push(`${raw} → ${resolution.canonicalKey}`)
      }
    }
  }

  for (const item of items) {
    if (item.inventoryColor) withInventoryColor++
    if (item.colors && item.colors.length > 0) withCatalogColors++
    const preview = buildColorPreview(item)
    if (preview.kind === 'none') {
      withNeither++
      if (rawColorValues(item).length > 0) omittedDueToUnresolvedColor++
    }
    if (item.inventoryColor && item.stock === 'unavailable') hiddenDueToUnavailableInventory++

    if (item.inventoryColor && item.stock !== 'unavailable') {
      const availableCount = preview.kind === 'solid' ? preview.visible.length : 0
      if (!item.isHybrid && availableCount > 1) stringsWithMultipleAvailableInventoryColors++
    }

    if (item.isHybrid) {
      const source = hybridColorSource(item)
      if (source.kind === 'structured-both' || source.kind === 'structured-partial') hybridsUsingStructuredColors++
      if (source.kind === 'legacy-pair' || source.kind === 'legacy-solid') hybridsUsingLegacyFallback++
      if (source.kind === 'structured-partial' || source.kind === 'legacy-solid') partialHybridPairs.push(item.id)
      if (source.kind === 'none') hybridMissingColors.push(item.id)
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

    for (const raw of rawColorValues(item)) trackResolution(raw)
  }

  return {
    withInventoryColor,
    withCatalogColors,
    withNeither,
    omittedDueToUnresolvedColor,
    unknownColorValues,
    duplicateCaseInsensitiveColors,
    hybridMissingColors,
    partialHybridPairs,
    hiddenDueToUnavailableInventory,
    totalUniqueMappedColors: uniqueMappedValues.size,
    inventoryValuesWithDelimiters,
    ambiguousSlashValues,
    canonicalizedAliasesUsed,
    stringsWithMultipleAvailableInventoryColors,
    hybridsUsingStructuredColors,
    hybridsUsingLegacyFallback,
    resolutionSourceCounts,
    inferredColorNames,
  }
}
