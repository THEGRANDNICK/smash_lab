// Tension unit conversion helpers. Internally, tension is always stored in kg.

export const KG_TO_LBS = 2.20462

export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS
}

export function lbsToKg(lbs: number): number {
  return lbs / KG_TO_LBS
}

export function formatKg(kg: number): string {
  return `${roundToHalf(kg).toFixed(1)} kg`
}

export function formatLbs(kg: number): string {
  return `${Math.round(kgToLbs(kg) * 10) / 10} lbs`
}

export function formatBoth(kg: number): string {
  return `${formatKg(kg)} / ${formatLbs(kg)}`
}

/** Round to the nearest practical stringing increment (0.5 kg). */
export function roundToHalf(kg: number): number {
  return Math.round(kg * 2) / 2
}
