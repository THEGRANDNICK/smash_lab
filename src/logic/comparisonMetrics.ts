// Phase 8 — compact comparison-table rows for StringComparison.tsx. Reads
// only already-existing data (manufacturer ratings from data/strings.ts,
// specialist dimensions from data/stringSpecialistProfiles.ts, retailer
// listings from services/retailerPriceService.ts) and reshapes it into
// small, deterministic "dot" or text indicators. Never scores, ranks, or
// filters strings — purely a display transform, safe to reuse anywhere.

import type { StringItem } from '../data/strings.js'
import type { StringSpecialistProfile, SpecialistDimensionKey } from '../data/stringSpecialistProfiles.js'
import { orderRetailerListings, AVAILABILITY_LABELS, PACKAGE_TYPE_LABELS, type RetailerListing } from '../services/retailerPriceService.js'

export type ComparisonIndicatorKind = 'dots' | 'text'

export interface ComparisonRow {
  key: string
  label: string
  kind: ComparisonIndicatorKind
  /** Present when kind === 'dots'. */
  dots?: { filled: number; of: number }
  /** Always present — the human-readable value, used as the visible text for 'text' rows and as the accessible label for 'dots' rows. */
  text: string
}

const DOT_MAX = 5
const MANUFACTURER_MAX = 11
const SPECIALIST_MAX = 5

function dotsFromScale(value: number | null | undefined, max: number): { filled: number; of: number } | undefined {
  if (value == null) return undefined
  const filled = Math.max(0, Math.min(DOT_MAX, Math.round((value / max) * DOT_MAX)))
  return { filled, of: DOT_MAX }
}

function manufacturerRow(key: string, label: string, value: number | null | undefined): ComparisonRow {
  return {
    key,
    label,
    kind: 'dots',
    dots: dotsFromScale(value, MANUFACTURER_MAX),
    text: value == null ? 'Not rated' : `${value} / ${MANUFACTURER_MAX}`,
  }
}

function specialistDimensionAverage(profile: StringSpecialistProfile | undefined, keys: readonly SpecialistDimensionKey[]): number | undefined {
  if (!profile) return undefined
  const values = keys.map((k) => profile.dimensions[k]).filter((v): v is number => v != null)
  if (values.length === 0) return undefined
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function specialistRow(key: string, label: string, value: number | undefined): ComparisonRow {
  return {
    key,
    label,
    kind: 'dots',
    dots: value != null ? dotsFromScale(value, SPECIALIST_MAX) : undefined,
    text: value == null ? 'Not rated' : `${Math.round(value * 10) / 10} / ${SPECIALIST_MAX}`,
  }
}

const FEEL_LABEL: Record<NonNullable<StringSpecialistProfile['feel']>, string> = {
  hard: 'Hard / direct',
  medium: 'Medium',
  soft: 'Soft / forgiving',
}

const POWER_DIMENSIONS: SpecialistDimensionKey[] = ['easyPower', 'hardHitterFit', 'attackSmash']

/**
 * Builds the full set of compact comparison rows for one string, in display
 * order: Repulsion, Control, Durability, Feel, Tension retention, Hitting
 * sound, Power, Comfort, Overall specialist rating, Retail availability,
 * Package options, Retailer count.
 */
export function buildComparisonRows(
  item: StringItem,
  specialistProfile: StringSpecialistProfile | undefined,
  listings: readonly RetailerListing[] | undefined,
): ComparisonRow[] {
  const rows: ComparisonRow[] = []

  rows.push(manufacturerRow('repulsion', 'Repulsion', item.repulsion))
  rows.push(manufacturerRow('control', 'Control', item.control))
  rows.push(manufacturerRow('durability', 'Durability', item.durability))

  rows.push({
    key: 'feel',
    label: 'Feel',
    kind: 'text',
    text: specialistProfile?.feel ? FEEL_LABEL[specialistProfile.feel] : 'Not rated',
  })

  rows.push(specialistRow('tensionRetention', 'Tension Retention', specialistProfile?.dimensions.tensionRetention))
  rows.push(manufacturerRow('hittingSound', 'Hitting Sound', item.hittingSound))
  rows.push(specialistRow('power', 'Power', specialistDimensionAverage(specialistProfile, POWER_DIMENSIONS)))

  const comfortValue = specialistProfile?.dimensions.comfort ?? (item.shockAbsorption != null ? (item.shockAbsorption / MANUFACTURER_MAX) * SPECIALIST_MAX : undefined)
  rows.push(specialistRow('comfort', 'Comfort', comfortValue))

  const allDimensionValues = specialistProfile ? Object.values(specialistProfile.dimensions).filter((v): v is number => v != null) : []
  const overallSpecialist = allDimensionValues.length > 0 ? allDimensionValues.reduce((sum, v) => sum + v, 0) / allDimensionValues.length : undefined
  rows.push(specialistRow('overallSpecialist', 'Overall Specialist Rating', overallSpecialist))

  const visibleListings = listings ?? []
  const ordered = orderRetailerListings(visibleListings)
  rows.push({
    key: 'availability',
    label: 'Retail Availability',
    kind: 'text',
    text: ordered.length > 0 ? AVAILABILITY_LABELS[ordered[0].availabilityStatus] : 'No retailers listed',
  })

  const packageTypes = Array.from(new Set(visibleListings.map((l) => l.packageType)))
  rows.push({
    key: 'packageOptions',
    label: 'Package Options',
    kind: 'text',
    text: packageTypes.length > 0 ? packageTypes.map((t) => PACKAGE_TYPE_LABELS[t]).join(', ') : '—',
  })

  const retailerCount = new Set(visibleListings.map((l) => l.retailerId)).size
  rows.push({
    key: 'retailerCount',
    label: 'Retailer Count',
    kind: 'text',
    text: String(retailerCount),
  })

  return rows
}
