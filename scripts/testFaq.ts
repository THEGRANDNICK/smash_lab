// Phase 12 — FAQ content regression suite (Part 23). Checks against the
// plain data file (data/faqContent.ts) rather than the .tsx component,
// since scripts/ run under nodenext resolution with no JSX support (same
// reason AdminSection lives in adminDashboardService.ts, not AdminApp.tsx).
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

function findByKeyword(keyword: RegExp) {
  return FAQS.find((f) => keyword.test(f.q) || keyword.test(f.a))
}

console.log('\n=== Required questions present (Part 17) ===')

const REQUIRED_TOPICS: { name: string; pattern: RegExp }[] = [
  { name: 'which string to choose', pattern: /which string should i choose/i },
  { name: 'what tension to use', pattern: /what tension should i use/i },
  { name: 'is higher tension better', pattern: /is higher tension always better/i },
  { name: 'repulsion/control/durability difference', pattern: /difference between repulsion, control, and durability/i },
  { name: 'why highest-rated string is not always the recommendation', pattern: /isn't the highest-rated string always the recommendation/i },
  { name: 'how recommendations are calculated', pattern: /how are smash lab recommendations calculated/i },
  { name: 'what match percentage means', pattern: /what does match percentage mean/i },
  { name: 'cross-brand rating comparability', pattern: /are manufacturer ratings directly comparable across brands/i },
  { name: 'restring frequency', pattern: /how often should i restring/i },
  { name: 'string gauge', pattern: /what does string gauge change/i },
  { name: 'hybrid string setup', pattern: /what is a hybrid string setup/i },
  { name: 'unavailable string still recommended', pattern: /why might an unavailable string still be recommended/i },
  { name: 'retailer price comparison', pattern: /how are retailer prices compared/i },
  { name: 'price per metre and shipping', pattern: /does "price per metre" include shipping/i },
  { name: 'whether Smash Lab sells strings/rackets', pattern: /does smash lab sell strings or string rackets/i },
]

for (const topic of REQUIRED_TOPICS) {
  test(`FAQ covers: ${topic.name}`, () => {
    assert.ok(FAQS.some((f) => topic.pattern.test(f.q)), `no question matched ${topic.pattern}`)
  })
}

console.log('\n=== Content principles (Part 18) ===')

test('cross-brand caveat is present and does not overclaim (no "scientifically standardized" language)', () => {
  const item = findByKeyword(/comparable across brands/i)
  assert.ok(item)
  assert.doesNotMatch(item!.a.toLowerCase(), /scientifically standard/)
})
test('price-per-metre caveat explicitly excludes shipping', () => {
  const item = findByKeyword(/price per metre.*include shipping/i)
  assert.ok(item)
  assert.match(item!.a.toLowerCase(), /does not include shipping/)
})
test('tension guidance frames it as a starting point, not a fixed rule', () => {
  const item = FAQS.find((f) => /what tension should i use/i.test(f.q))
  assert.ok(item)
  assert.match(item!.a.toLowerCase(), /starting point/)
})
test('unavailable-recommendation explanation clarifies availability is shown separately from fit', () => {
  const item = findByKeyword(/unavailable string still be recommended/i)
  assert.ok(item)
  assert.match(item!.a.toLowerCase(), /separately/)
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
test('the recommendations group appears before the service group (logical reading order)', () => {
  const firstServiceIndex = FAQS.findIndex((f) => f.group === 'service')
  const lastRecommendationsIndex = FAQS.map((f) => f.group).lastIndexOf('recommendations')
  assert.ok(lastRecommendationsIndex < firstServiceIndex)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
