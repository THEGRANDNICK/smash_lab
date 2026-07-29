// Single source of truth for the 5 performance dimensions shown on every
// string card — shared by StatBars (bars view) and RadarChart (radar view)
// so both visualizations read the exact same axis order, labels, and scale
// from the exact same underlying string data. Neither view stores its own
// copy of the numbers.

import type { StringItem } from '../data/strings.js'

export type PerformanceDimension = 'repulsion' | 'control' | 'durability' | 'hittingSound' | 'shockAbsorption'

export interface PerformanceAxis {
  key: PerformanceDimension
  label: string
  /** Compact label for tight spaces (radar chart axis tips) — kept short so it never overflows the chart. */
  shortLabel: string
  emoji: string
}

export const PERFORMANCE_AXES: PerformanceAxis[] = [
  { key: 'repulsion', label: 'Repulsion', shortLabel: 'Rep', emoji: '🚀' },
  { key: 'control', label: 'Control', shortLabel: 'Ctrl', emoji: '🎯' },
  { key: 'durability', label: 'Durability', shortLabel: 'Dur', emoji: '🧵' },
  { key: 'hittingSound', label: 'Hitting sound', shortLabel: 'Snd', emoji: '🔊' },
  { key: 'shockAbsorption', label: 'Shock absorption', shortLabel: 'Abs', emoji: '🤲' },
]

/** Same 0–11 scale used consistently across every string, so charts can be compared directly. */
export const PERFORMANCE_MAX = 11

export function getPerformanceValues(item: StringItem): Record<PerformanceDimension, number | null> {
  return {
    repulsion: item.repulsion,
    control: item.control,
    durability: item.durability,
    hittingSound: item.hittingSound,
    shockAbsorption: item.shockAbsorption,
  }
}

export interface RadarCompareColor {
  strokeClassName: string
  fillClassName: string
  dotClassName: string
  /** HTML text color matching this series (Tailwind `text-*`) — used for exact numeric values in ordinary HTML markup (overlay bars, the comparison table) so a value's color always ties back to its chip/series. */
  textClassName: string
  /** Solid background color matching this series — used for the overlay-bar fill (distinct from fillClassName, which is a translucent chart-area fill tuned for the radar's own layering). */
  barClassName: string
  /** SVG `fill` color matching this series (Tailwind `fill-*`) — for `<text>` inside RadarChart's SVG, where color comes from `fill`, not `color`/`text-*`. */
  svgTextClassName: string
}

/** A small, reusable palette for comparing 2–3 strings at once. Single-card usage always uses the first color. */
export const RADAR_COMPARE_COLORS: RadarCompareColor[] = [
  {
    strokeClassName: 'stroke-court-700 dark:stroke-shuttle-400',
    fillClassName: 'fill-court-700/20 dark:fill-shuttle-400/25',
    dotClassName: 'bg-court-700 dark:bg-shuttle-400',
    textClassName: 'text-court-700 dark:text-shuttle-400',
    barClassName: 'bg-court-700 dark:bg-shuttle-400',
    svgTextClassName: 'fill-court-700 dark:fill-shuttle-400',
  },
  {
    strokeClassName: 'stroke-sky-600 dark:stroke-sky-400',
    fillClassName: 'fill-sky-600/15 dark:fill-sky-400/20',
    dotClassName: 'bg-sky-600 dark:bg-sky-400',
    textClassName: 'text-sky-600 dark:text-sky-400',
    barClassName: 'bg-sky-600 dark:bg-sky-400',
    svgTextClassName: 'fill-sky-600 dark:fill-sky-400',
  },
  {
    strokeClassName: 'stroke-rose-600 dark:stroke-rose-400',
    fillClassName: 'fill-rose-600/15 dark:fill-rose-400/20',
    dotClassName: 'bg-rose-600 dark:bg-rose-400',
    textClassName: 'text-rose-600 dark:text-rose-400',
    barClassName: 'bg-rose-600 dark:bg-rose-400',
    svgTextClassName: 'fill-rose-600 dark:fill-rose-400',
  },
]
