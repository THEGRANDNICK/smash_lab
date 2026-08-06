// FAQ content regression suite. Checks against the plain data file
// (data/faqContent.ts) rather than the .tsx component, since scripts/ run
// under nodenext resolution with no JSX support (same reason AdminSection
// lives in adminDashboardService.ts, not AdminApp.tsx).
//
// Run: npm run test:faq

import assert from 'node:assert/strict'
import { FAQS, GROUP_LABEL } from '../src/data/faqContent.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log('\n=== Required questions present (Part 14: max 5, unblock a real enquiry) ===')

const REQUIRED_TOPICS: { name: string; pattern: RegExp }[] = [
  { name: 'how the recommendation works', pattern: /how does the recommendation work/i },
  { name: 'what tension to choose', pattern: /what tension should i choose/i },
  { name: 'how long stringing takes', pattern: /how long does stringing take/i },
  { name: 'bringing your own string', pattern: /can i bring my own string/i },
  { name: 'how to request the recommended setup', pattern: /how do i request the recommended setup/i },
]

for (const topic of REQUIRED_TOPICS) {
  test(`FAQ covers: ${topic.name}`, () => {
    assert.ok(FAQS.some((f) => topic.pattern.test(f.q)), `no question matched ${topic.pattern}`)
  })
}

console.log('\n=== Content principles ===')

test('at most 5 questions (Part 14 limit)', () => {
  assert.ok(FAQS.length <= 5, `FAQ has ${FAQS.length} entries, limit is 5`)
})
test('tension guidance frames it as a starting point, not a fixed rule', () => {
  const item = FAQS.find((f) => /what tension should i choose/i.test(f.q))
  assert.ok(item)
  assert.match(item!.a.toLowerCase(), /starting point/)
})
test('tension guidance mentions the racket maximum safety limit', () => {
  const item = FAQS.find((f) => /what tension should i choose/i.test(f.q))
  assert.ok(item)
  assert.match(item!.a.toLowerCase(), /maximum/)
})
test('no answer reads as a long wall of text (each stays under ~500 characters)', () => {
  for (const f of FAQS) {
    assert.ok(f.a.length < 500, `"${f.q}" answer is ${f.a.length} chars`)
  }
})
test('recommendations are not overstated as guarantees (no "guaranteed" / "perfect match" language)', () => {
  for (const f of FAQS) {
    assert.doesNotMatch(f.a.toLowerCase(), /guarantee|perfect match|100% accurate/)
  }
})
test('does not invent a service Smash Lab does not offer (no checkout/ordering/cart language)', () => {
  for (const f of FAQS) {
    assert.doesNotMatch(f.a.toLowerCase(), /add to cart|checkout|buy now from smash lab/)
  }
})

console.log('\n=== Structure ===')

test('every FAQ item belongs to a known, labeled group', () => {
  for (const f of FAQS) {
    assert.ok(GROUP_LABEL[f.group], `unknown group "${f.group}" on "${f.q}"`)
  }
})
test('every question and answer is non-empty', () => {
  for (const f of FAQS) {
    assert.ok(f.q.trim().length > 0)
    assert.ok(f.a.trim().length > 0)
  }
})
test('no duplicate questions', () => {
  const seen = new Set<string>()
  for (const f of FAQS) {
    assert.ok(!seen.has(f.q), `duplicate question: "${f.q}"`)
    seen.add(f.q)
  }
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
