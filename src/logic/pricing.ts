// Service pricing logic — kept separate from string data so prices can change independently.

export const STRINGING_SERVICE_FEE = 15

export interface PriceBreakdown {
  stringCost: number | null
  serviceFee: number
  total: number | null
}

export function calculateTotal(stringCost: number | null): PriceBreakdown {
  return {
    stringCost,
    serviceFee: STRINGING_SERVICE_FEE,
    total: stringCost == null ? null : Math.round((stringCost + STRINGING_SERVICE_FEE) * 100) / 100,
  }
}

export function formatEuro(amount: number | null): string {
  if (amount == null) return 'Price on request'
  return `€${amount.toFixed(2).replace(/\.00$/, '')}`
}
