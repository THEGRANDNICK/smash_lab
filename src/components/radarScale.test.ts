import { describe, it, expect } from 'vitest'
import { PERFORMANCE_MAX, RADAR_BASELINE, radarRatio } from './performanceAxes'

describe('radar scale', () => {
  it('starts at the baseline and ends at the maximum', () => {
    expect(radarRatio(RADAR_BASELINE)).toBe(0)
    expect(radarRatio(PERFORMANCE_MAX)).toBe(1)
  })
  it('clamps values outside the range and treats unknown as the centre', () => {
    expect(radarRatio(1)).toBe(0)
    expect(radarRatio(20)).toBe(1)
    expect(radarRatio(null)).toBe(0)
  })
  it('spreads typical ratings (6–11) over most of the chart instead of the outer half', () => {
    expect(radarRatio(11) - radarRatio(6)).toBeGreaterThan(0.6)
  })
})
