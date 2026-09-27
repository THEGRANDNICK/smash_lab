// Vitest port of scripts/testFaq.ts (Part 9 — first suite migrated off the
// plain-assert scripts/*.ts pattern; see docs/testing.md). Same assertions,
// same coverage — nothing dropped in the migration.

import { describe, it, expect } from 'vitest'
import { FAQS, GROUP_LABEL } from './faqContent.js'

describe('FAQ content — required questions (max 5; Smash Lab is a guide, not a service)', () => {
  const REQUIRED_TOPICS: { name: string; pattern: RegExp }[] = [
    { name: 'how the recommendation works', pattern: /how does the recommendation work/i },
    { name: 'what tension to choose', pattern: /what tension should i choose/i },
    { name: 'what Smash Lab is (and is not)', pattern: /is smash lab a shop/i },
    { name: 'where the hands-on ratings come from', pattern: /where do the hands-on ratings come from/i },
    { name: 'how to ask a question', pattern: /can i ask you about a string/i },
  ]

  for (const topic of REQUIRED_TOPICS) {
    it(`covers: ${topic.name}`, () => {
      expect(FAQS.some((f) => topic.pattern.test(f.q))).toBe(true)
    })
  }
})

describe('FAQ content — content principles', () => {
  it('has at most 5 questions (Part 14 limit)', () => {
    expect(FAQS.length).toBeLessThanOrEqual(5)
  })

  it('frames tension guidance as a starting point, not a fixed rule', () => {
    const item = FAQS.find((f) => /what tension should i choose/i.test(f.q))
    expect(item).toBeDefined()
    expect(item!.a.toLowerCase()).toMatch(/starting point/)
  })

  it('mentions the racket maximum safety limit in tension guidance', () => {
    const item = FAQS.find((f) => /what tension should i choose/i.test(f.q))
    expect(item).toBeDefined()
    expect(item!.a.toLowerCase()).toMatch(/maximum/)
  })

  it('never lets an answer read as a long wall of text (each stays under ~500 characters)', () => {
    for (const f of FAQS) {
      expect(f.a.length).toBeLessThan(500)
    }
  })

  it('never overstates recommendations as guarantees', () => {
    for (const f of FAQS) {
      expect(f.a.toLowerCase()).not.toMatch(/guarantee|perfect match|100% accurate/)
    }
  })

  it('never invents a service Smash Lab does not offer (no checkout/ordering/cart language)', () => {
    for (const f of FAQS) {
      expect(f.a.toLowerCase()).not.toMatch(/add to cart|checkout|buy now from smash lab/)
    }
  })
})

describe('FAQ content — structure', () => {
  it('every item belongs to a known, labeled group', () => {
    for (const f of FAQS) {
      expect(GROUP_LABEL[f.group]).toBeTruthy()
    }
  })

  it('every question and answer is non-empty', () => {
    for (const f of FAQS) {
      expect(f.q.trim().length).toBeGreaterThan(0)
      expect(f.a.trim().length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate questions', () => {
    const seen = new Set<string>()
    for (const f of FAQS) {
      expect(seen.has(f.q)).toBe(false)
      seen.add(f.q)
    }
  })
})
