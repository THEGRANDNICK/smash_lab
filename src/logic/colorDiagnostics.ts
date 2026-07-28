// Phase 9 — pure diagnostics for the existing /debug/supabase surface (see
// components/SupabaseDebugPage.tsx). Deliberately not a new dashboard: just
// a summary object the debug page renders inside its existing layout,
// mirroring the established pattern of retailerPriceService.ts's
// summarizeRetailerDiagnostics().

import type { StringItem } from '../data/strings.js'
import { resolveStringColor, buildColorPreview } from './stringColor.js'

export interface ColorDiagnosticsSummary {
  withInventoryColor: number
  withCatalogColors: number
  withNeither: number
  /** Raw, as-entered values that don't resolve to a known color — kept for admin diagnostics, never rendered as a swatch. */
  unknownColorValues: string[]
  /** One entry per string whose own `colors` list contains the same color more than once under different casing, e.g. "yonex-bg80: Yellow, yellow". */
  duplicateCaseInsensitiveColors: string[]
  /** Hybrid strings missing a main and/or cross color — string ids. */
  hybridMissingColors: string[]
  /** Strings with an inventoryColor that's currently excluded from display because the string is out of stock. */
  hiddenDueToUnavailableInventory: number
  /** Distinct resolved colors (by hex) across the whole catalog — inventory, catalog, and hybrid sides combined. */
  totalUniqueMappedColors: number
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

  const unknownSeen = new Set<string>()
  const unknownColorValues: string[] = []
  const duplicateCaseInsensitiveColors: string[] = []
  const hybridMissingColors: string[] = []
  const uniqueMappedHexes = new Set<string>()

  for (const item of items) {
    if (item.inventoryColor) withInventoryColor++
    if (item.colors && item.colors.length > 0) withCatalogColors++
    if (buildColorPreview(item).kind === 'none') withNeither++
    if (item.inventoryColor && item.stock === 'unavailable') hiddenDueToUnavailableInventory++

    if (item.isHybrid && !(item.mainString?.color && item.crossString?.color)) {
      hybridMissingColors.push(item.id)
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
  }
}
