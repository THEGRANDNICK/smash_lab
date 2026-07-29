// Compact five-metric overlay-bar comparison (components/ComparisonOverlayBars.tsx)
// and the shared exact-value formatting it uses. Reads the same 5 core
// manufacturer metrics as RadarChart/StatBars (PERFORMANCE_AXES) — no new
// data, no scoring, purely a display transform.

import { PERFORMANCE_AXES, PERFORMANCE_MAX, getPerformanceValues } from '../components/performanceAxes.js'
import type { StringItem } from '../data/strings.js'

/** One decimal place preserved exactly as entered (ratings are validated to at most one decimal place elsewhere) — never rounds a value like 9.5 down to 9 or up to 10. "—" for an unrated metric. */
export function formatMetricValue(value: number | null): string {
  if (value == null) return '—'
  return String(value)
}

export interface OverlayBarSeriesValue {
  id: string
  label: string
  value: number | null
  /** 0–100, clamped — this metric's value as a percentage of PERFORMANCE_MAX, for the bar's rendered width/height. 0 for an unrated metric (never negative, never fabricated). */
  percent: number
  displayText: string
}

export interface OverlayBarRow {
  key: string
  label: string
  series: OverlayBarSeriesValue[]
}

function percentOf(value: number | null): number {
  if (value == null) return 0
  return Math.max(0, Math.min(100, (value / PERFORMANCE_MAX) * 100))
}

/** Builds one row per core performance axis (Repulsion, Control, Durability, Hitting sound, Shock absorption), each carrying every compared string's value in the same order as `items` — so callers can zip this 1:1 with the comparison chips/legend. */
export function buildOverlayBarRows(items: readonly StringItem[]): OverlayBarRow[] {
  return PERFORMANCE_AXES.map((axis) => ({
    key: axis.key,
    label: axis.label,
    series: items.map((item) => {
      const value = getPerformanceValues(item)[axis.key]
      return {
        id: item.id,
        label: item.name,
        value,
        percent: percentOf(value),
        displayText: formatMetricValue(value),
      }
    }),
  }))
}
