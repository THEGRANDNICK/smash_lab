import { describe, it, expect } from 'vitest'
import { tensionTradeoffs } from './tensionTradeoffs'

describe('tension trade-offs (rule of thumb)', () => {
  it('higher tension: smaller sweet spot, more control, shorter life', () => {
    const low = tensionTradeoffs(10, 0.68)
    const high = tensionTradeoffs(12, 0.68)
    expect(high.sweetSpot).toBeLessThan(low.sweetSpot)
    expect(high.control).toBeGreaterThan(low.control)
    expect(high.durability).toBeLessThan(low.durability)
  })
  it('a thinner string lasts less at the same tension', () => {
    expect(tensionTradeoffs(11, 0.63).durability).toBeLessThan(tensionTradeoffs(11, 0.7).durability)
  })
  it('bars always stay between 0 and 1', () => {
    for (const kg of [6, 9, 11, 13, 16]) for (const v of Object.values(tensionTradeoffs(kg, 0.61))) expect(v >= 0 && v <= 1).toBe(true)
  })
})
