import { describe, it, expect } from 'vitest'
import { EMPTY_FEEDBACK, buildFeedbackRow, canSendFeedback, markFeedbackSent } from './feedback'

const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('string feedback', () => {
  it('an empty form is not sent', () => {
    expect(buildFeedbackRow('yonex-bg80', EMPTY_FEEDBACK).ok).toBe(false)
  })
  it('any single field is enough; the rest stays empty', () => {
    const r = buildFeedbackRow('yonex-bg80', { ...EMPTY_FEEDBACK, racketBalance: 'headHeavy' })
    expect(r.ok && r.row).toMatchObject({ string_id: 'yonex-bg80', racket_balance: 'headHeavy', tension_kg: null, comment: null })
  })
  it('converts lbs to kg and rejects impossible tensions', () => {
    const lbs = buildFeedbackRow('yonex-bg80', { ...EMPTY_FEEDBACK, tension: '26', tensionUnit: 'lbs' })
    expect(lbs.ok && lbs.row.tension_kg).toBe(11.8)
    expect(buildFeedbackRow('yonex-bg80', { ...EMPTY_FEEDBACK, tension: '50' }).ok).toBe(false)
  })
  it('keeps ratings within 1–5 and trims texts to the database limits', () => {
    const r = buildFeedbackRow('yonex-bg80', { ...EMPTY_FEEDBACK, ratings: { power: 4, control: 9 }, comment: 'x'.repeat(900) })
    expect(r.ok && r.row.rating_power).toBe(4)
    expect(r.ok && r.row.rating_control).toBeNull()
    expect(r.ok && r.row.comment?.length).toBe(500)
  })
  it('a filled-in honeypot is treated as spam', () => {
    const r = buildFeedbackRow('yonex-bg80', { ...EMPTY_FEEDBACK, comment: 'great', website: 'http://spam' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.spam).toBe(true)
  })
  it('one feedback per string per day on this device', () => {
    const s = mem()
    expect(canSendFeedback(s, 'yonex-bg80', 0)).toBe(true)
    markFeedbackSent(s, 'yonex-bg80', 0)
    expect(canSendFeedback(s, 'yonex-bg80', 1000)).toBe(false)
    expect(canSendFeedback(s, 'yonex-bg65', 1000)).toBe(true)
    expect(canSendFeedback(s, 'yonex-bg80', 25 * 60 * 60 * 1000)).toBe(true)
  })
})
