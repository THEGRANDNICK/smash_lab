// Gauge display formatting — separate from the recommendation engine since
// it's presentation-only. A hybrid string (see StringItem.isHybrid in
// data/strings.ts) has no single overall gauge, so it displays as
// "main / cross mm" instead of one number; this is purely a display
// concern and never affects scoring.

import type { StringItem } from '../data/strings.js'

/** Returns e.g. "0.65mm" for a normal string, "0.67 / 0.61mm" for a hybrid with both gauges known, or null if nothing to show. */
export function formatGauge(item: StringItem): string | null {
  if (item.isHybrid) {
    const main = item.mainString?.gauge
    const cross = item.crossString?.gauge
    if (main != null && cross != null) return `${main} / ${cross}mm`
    if (main != null) return `${main}mm (main)`
    if (cross != null) return `${cross}mm (cross)`
    return null
  }
  return item.tension?.gauge != null ? `${item.tension.gauge}mm` : null
}
