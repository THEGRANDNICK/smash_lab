import { describe, it, expect } from 'vitest'
import { inTheRunning, MIN_IN_RUNNING, RUNNING_GAP } from './inTheRunning'
import { recommendStrings } from './recommendationEngine'
import { strings } from '../data/strings'

describe('strings in the running (live feel map)', () => {
  it('before the first answer nothing is decided: every string is in, no leader', () => {
    const s = inTheRunning({})
    expect(s.inIds.size).toBe(strings.length)
    expect(s.leaderId).toBeNull()
  })

  it('the leader is exactly the string the quiz would recommend right now', () => {
    const answers = { level: 'advanced', playStyles: ['aggressive'] }
    expect(inTheRunning(answers).leaderId).toBe(recommendStrings(answers).best.string.id)
  })

  it('in the running = within the gap of the leader, never fewer than the minimum', () => {
    const answers = { level: 'intermediate', playStyles: ['control'], priorities: ['directPrecision', 'shuttleGrip'], hittingFeel: 'hardCrisp' }
    const rec = recommendStrings(answers)
    const s = inTheRunning(answers)
    expect(s.inIds.size).toBeGreaterThanOrEqual(MIN_IN_RUNNING)
    for (const r of rec.ranked) {
      const shouldBeIn = rec.ranked.indexOf(r) < MIN_IN_RUNNING || r.matchPercent >= rec.best.matchPercent - RUNNING_GAP
      expect(s.inIds.has(r.string.id), r.string.id).toBe(shouldBeIn)
    }
  })

  it('answers narrow the field, and changing an answer can bring strings back', () => {
    const one = inTheRunning({ level: 'beginner' }).inIds.size
    const more = inTheRunning({ level: 'beginner', priorities: ['durability'], hittingFeel: 'softComfortable' }).inIds.size
    expect(more).toBeLessThan(strings.length)
    expect(one).toBeGreaterThanOrEqual(MIN_IN_RUNNING)
    // recomputed from scratch: dropping the extra answers returns to the earlier field
    expect(inTheRunning({ level: 'beginner' }).inIds.size).toBe(one)
  })
})
