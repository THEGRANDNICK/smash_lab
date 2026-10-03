// Rule-of-thumb trade-offs for the Tension Picker's slider — qualitative, not measured.
// Source: Badminton Insight (Aug 2026): higher tension → smaller sweet spot, more control with
// consistent centred contact, more demanding timing; lower → more forgiving, easier power;
// thin strings and higher tensions break sooner. Values are 0–1 bar lengths only.

const LOW = 9
const HIGH = 13

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export interface TensionTradeoffs {
  /** Size of the sweet spot / forgiveness. */
  sweetSpot: number
  /** Control and precision — assuming clean, centred contact. */
  control: number
  /** How long the string tends to last. */
  durability: number
}

export function tensionTradeoffs(kg: number, gaugeMm?: number): TensionTradeoffs {
  const t = clamp01((kg - LOW) / (HIGH - LOW))
  // thinner than 0.70 mm costs durability; 0.61 mm costs the most
  const thinness = gaugeMm == null ? 0.3 : clamp01((0.7 - gaugeMm) / 0.09)
  return {
    sweetSpot: clamp01(1 - t * 0.85),
    control: clamp01(0.25 + t * 0.75),
    durability: clamp01(0.95 - t * 0.45 - thinness * 0.35),
  }
}
