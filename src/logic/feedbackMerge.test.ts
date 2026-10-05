import { describe, it, expect } from 'vitest'
import { changedDimensions, proposeMerge } from './feedbackMerge'

const fb = (p: number | null, c: number | null = null, co: number | null = null, d: number | null = null) => ({ rating_power: p, rating_control: c, rating_comfort: co, rating_durability: d })

describe('folding feedback into hands-on ratings', () => {
  it('one feedback only nudges an existing value (it counts 1 vote against 3)', () => {
    const power = proposeMerge({ easyPower: 4 }, [fb(1)]).find((l) => l.dimension === 'easyPower')!
    expect(power.proposed).toBe(3.5) // (4×3 + 1) / 4 = 3.25 → 3.5 (half points, rounded up): 4 → 3.5, a nudge
  })
  it('many agreeing feedbacks move it clearly', () => {
    const power = proposeMerge({ easyPower: 4 }, [fb(2), fb(2), fb(2), fb(2), fb(2), fb(2)]).find((l) => l.dimension === 'easyPower')!
    expect(power.proposed).toBe(2.5) // (12 + 12) / 9 = 2.67 → 2.5
  })
  it('without an existing value the feedback average is used', () => {
    expect(proposeMerge({}, [fb(null, 4), fb(null, 5)]).find((l) => l.dimension === 'controlPrecision')!.proposed).toBe(4.5)
  })
  it('properties nobody rated in the feedback stay untouched', () => {
    const lines = proposeMerge({ comfort: 2 }, [fb(5)])
    expect(lines.find((l) => l.dimension === 'comfort')!.proposed).toBe(2)
    expect(changedDimensions(lines)).toEqual({ easyPower: 5 })
  })
})
