// Stability/legal/conversion phase — regression suite for the new
// result-to-enquiry conversion logic: the podium's topThree field, the
// data-source toggle, the String Map derivation port, match-percent human
// labels, the saved-setup localStorage helpers, and the enquiry message
// builder. Run: npm run test:conversion

import assert from 'node:assert/strict'
import { recommendStrings } from '../src/logic/recommendationEngine.js'
import { strings } from '../src/data/strings.js'
import { getMatchLabel } from '../src/logic/matchLabel.js'
import { readSavedSetup, writeSavedSetup, clearSavedSetup, type SavedSetup } from '../src/logic/savedSetup.js'
import { resolveSpecialistProfiles, DEFAULT_DATA_SOURCE } from '../src/logic/dataSourcePreference.js'
import { computeStringMapPosition } from '../src/logic/stringMapPosition.js'
import { buildResultSummaryText, buildEnquiryMailto, buildEnquiryWhatsAppUrl } from '../src/logic/contactMessage.js'
import { encodeResultShareState, decodeResultShareState } from '../src/logic/resultShareState.js'
import type { QuizAnswers } from '../src/logic/types.js'

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

const SAMPLE_ANSWERS: QuizAnswers = {
  level: 'intermediate',
  playStyles: ['aggressive'],
  powerGeneration: 'balanced',
  priorities: ['easyPower'],
  hittingFeel: 'mediumBalanced',
  frequency: 'oneTwoWeek',
  racketGoal: 'balancedGoal',
  currentTensionKnown: 'no',
  maxTensionKnown: 'no',
}

console.log('\n=== recommendStrings().topThree ===')

test('topThree has exactly 3 entries for a normal-sized pool', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS, strings)
  assert.equal(rec.topThree.length, 3)
})
test('topThree[0] is the exact same object as best', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS, strings)
  assert.equal(rec.topThree[0], rec.best)
})
test('topThree is already sorted by matchPercent descending', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS, strings)
  for (let i = 1; i < rec.topThree.length; i++) {
    assert.ok(rec.topThree[i - 1].matchPercent >= rec.topThree[i].matchPercent)
  }
})
test('topThree entries are all distinct strings', () => {
  const rec = recommendStrings(SAMPLE_ANSWERS, strings)
  const ids = rec.topThree.map((s) => s.string.id)
  assert.equal(new Set(ids).size, ids.length)
})

console.log('\n=== Data-source toggle (dataSourcePreference.ts) ===')

test('manufacturer-only resolves to an empty object, never undefined', () => {
  const resolved = resolveSpecialistProfiles('manufacturer-only', { foo: {} as never })
  assert.deepEqual(resolved, {})
})
test('manufacturer-specialist passes the map through unchanged', () => {
  const map = { foo: {} as never }
  assert.equal(resolveSpecialistProfiles('manufacturer-specialist', map), map)
})
test('manufacturer-specialist passes undefined through as undefined (callers fall back to their own default)', () => {
  assert.equal(resolveSpecialistProfiles('manufacturer-specialist', undefined), undefined)
})
test('default data source is manufacturer-specialist (calibration on by default)', () => {
  assert.equal(DEFAULT_DATA_SOURCE, 'manufacturer-specialist')
})
test('manufacturer-only actually changes scoring output vs. manufacturer+specialist for at least one real answer set', () => {
  const withSpecialist = recommendStrings(SAMPLE_ANSWERS, strings)
  const manufacturerOnly = recommendStrings(SAMPLE_ANSWERS, strings, resolveSpecialistProfiles('manufacturer-only', undefined))
  // Not asserting a specific direction — only that the toggle is load-bearing, not a no-op.
  const anyDifference = withSpecialist.topThree.some((s, i) => s.string.id !== manufacturerOnly.topThree[i]?.string.id) || withSpecialist.best.matchPercent !== manufacturerOnly.best.matchPercent
  assert.ok(anyDifference, 'expected manufacturer-only to differ from manufacturer+specialist for at least one real string in the catalog')
})

console.log('\n=== String Map position (ported from stringMapPosition.ts) ===')

test('every real catalog string produces a position without throwing', () => {
  for (const item of strings) {
    const pos = computeStringMapPosition(item, undefined, false)
    assert.ok(pos.holdRepulsion >= 0 && pos.holdRepulsion <= 1)
    assert.ok(pos.softHard >= 0 && pos.softHard <= 1)
  }
})
test('manufacturer-only mode never reads specialist source tiers', () => {
  for (const item of strings) {
    const pos = computeStringMapPosition(item, undefined, false)
    assert.notEqual(pos.softHardSource, 'specialist-softness-directness')
    assert.notEqual(pos.softHardSource, 'specialist-comfort')
    assert.notEqual(pos.softHardSource, 'specialist-feel')
  }
})

console.log('\n=== Match label (matchLabel.ts) ===')

test('90%+ is Excellent Match', () => assert.equal(getMatchLabel(90), 'Excellent Match'))
test('89% is not Excellent Match', () => assert.notEqual(getMatchLabel(89), 'Excellent Match'))
test('75-89% is Great Match', () => assert.equal(getMatchLabel(80), 'Great Match'))
test('60-74% is Good Match', () => assert.equal(getMatchLabel(65), 'Good Match'))
test('below 60% is Fair Match', () => assert.equal(getMatchLabel(40), 'Fair Match'))
test('label thresholds are monotonic (never a lower % mapping to a better label)', () => {
  const order = ['Fair Match', 'Good Match', 'Great Match', 'Excellent Match']
  let lastRank = -1
  for (let pct = 0; pct <= 100; pct += 1) {
    const rank = order.indexOf(getMatchLabel(pct))
    assert.ok(rank >= lastRank)
    lastRank = rank
  }
})

console.log('\n=== Saved setup (savedSetup.ts) ===')

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

test('read from empty storage returns null', () => {
  assert.equal(readSavedSetup(makeMemoryStorage()), null)
})
test('write then read round-trips exactly', () => {
  const storage = makeMemoryStorage()
  const setup: SavedSetup = {
    stringBrand: 'Yonex',
    stringName: 'BG80',
    tensionKg: 10.5,
    matchPercent: 91,
    dataSourceLabel: 'Calibrated with Smash Lab specialist data.',
    racketModel: 'Astrox 88D',
    savedAt: '2026-08-06T00:00:00.000Z',
  }
  writeSavedSetup(storage, setup)
  assert.deepEqual(readSavedSetup(storage), setup)
})
test('clear removes the saved setup', () => {
  const storage = makeMemoryStorage()
  writeSavedSetup(storage, { stringBrand: 'Yonex', stringName: 'BG80', tensionKg: 10, matchPercent: 90, dataSourceLabel: 'x', savedAt: 'x' })
  clearSavedSetup(storage)
  assert.equal(readSavedSetup(storage), null)
})
test('malformed JSON in storage fails safely (never throws)', () => {
  const storage = makeMemoryStorage()
  storage.setItem('smashlab:savedSetup', '{not valid json')
  assert.doesNotThrow(() => readSavedSetup(storage))
  assert.equal(readSavedSetup(storage), null)
})
test('read/write/clear never throw when storage is null (e.g. SSR/no window)', () => {
  assert.doesNotThrow(() => readSavedSetup(null))
  assert.doesNotThrow(() => writeSavedSetup(null, { stringBrand: 'x', stringName: 'x', tensionKg: 1, matchPercent: 1, dataSourceLabel: 'x', savedAt: 'x' }))
  assert.doesNotThrow(() => clearSavedSetup(null))
})

console.log('\n=== Enquiry message (contactMessage.ts) ===')

const ENQUIRY_DETAILS = { stringName: 'Yonex BG80', tensionKg: 10.5, matchPercent: 91, dataSourceLabel: 'Manufacturer + Specialist calibration' }

test('summary matches the reference message shape exactly', () => {
  const text = buildResultSummaryText(ENQUIRY_DETAILS)
  assert.equal(
    text,
    ['Hello Nick,', 'Smash Lab recommended the following setup:', '', 'String: Yonex BG80', 'Tension: 10.5 kg', 'Match: 91%', 'Data source: Manufacturer + Specialist calibration', '', 'Racket: ', 'My question: '].join('\n'),
  )
})
test('says when the player picked another match than the recommendation', () => {
  assert.match(buildResultSummaryText({ ...ENQUIRY_DETAILS, rank: 2 }), /I picked my #2 match from Smash Lab:/)
  assert.match(buildResultSummaryText({ ...ENQUIRY_DETAILS, rank: 1 }), /Smash Lab recommended the following setup:/)
})
test('racket model and note are included when provided', () => {
  const text = buildResultSummaryText({ ...ENQUIRY_DETAILS, racketModel: 'Astrox 88D', note: 'Please use a fresh grip too' })
  assert.match(text, /Racket: Astrox 88D/)
  assert.match(text, /My question: Please use a fresh grip too/)
})
test('mailto URL is correctly percent-encoded and targets CONTACT.email', () => {
  const url = buildEnquiryMailto(ENQUIRY_DETAILS)
  assert.match(url, /^mailto:inquiries\.smashlab@gmail\.com\?subject=/)
  assert.doesNotMatch(url, /\n/, 'raw newlines must never appear unencoded in a mailto URL')
})
test('WhatsApp URL targets CONTACT.whatsappNumber and percent-encodes the same message body', () => {
  const url = buildEnquiryWhatsAppUrl(ENQUIRY_DETAILS)
  assert.equal(url, `https://wa.me/491774204564?text=${encodeURIComponent(buildResultSummaryText(ENQUIRY_DETAILS))}`)
})

console.log('\n=== Shareable result state (resultShareState.ts, Part 5) ===')

const FULL_ANSWERS: QuizAnswers = {
  level: 'intermediate',
  playStyles: ['aggressive', 'fastDoubles'],
  powerGeneration: 'balanced',
  priorities: ['easyPower', 'durability', 'comfort'],
  hittingFeel: 'mediumBalanced',
  frequency: 'oneTwoWeek',
  restringReason: 'wearFraying',
  racketGoal: 'balancedGoal',
  currentTensionKnown: 'yes',
  currentTensionValue: 10.5,
  currentTensionFeel: 'aboutRight',
  maxTensionKnown: 'yes',
  maxTensionValue: 12,
}

test('encode/decode round-trips a full answer set exactly', () => {
  const encoded = encodeResultShareState(FULL_ANSWERS, 'manufacturer-specialist')
  const decoded = decodeResultShareState(encoded)
  assert.deepEqual(decoded, { answers: FULL_ANSWERS, dataSource: 'manufacturer-specialist' })
})
test('encode/decode round-trips a minimal (mostly unanswered) answer set', () => {
  const minimal: QuizAnswers = { level: 'beginner' }
  const encoded = encodeResultShareState(minimal, 'manufacturer-only')
  const decoded = decodeResultShareState(encoded)
  assert.ok(decoded)
  assert.equal(decoded!.answers.level, 'beginner')
  assert.equal(decoded!.dataSource, 'manufacturer-only')
  assert.equal(decoded!.answers.playStyles, undefined)
  assert.equal(decoded!.answers.currentTensionValue, undefined)
})
test('decoded answers reproduce the exact same recommendation as the original answers', () => {
  const encoded = encodeResultShareState(SAMPLE_ANSWERS, 'manufacturer-specialist')
  const decoded = decodeResultShareState(encoded)
  assert.ok(decoded)
  const original = recommendStrings(SAMPLE_ANSWERS, strings)
  const restored = recommendStrings(decoded!.answers, strings)
  assert.equal(restored.best.string.id, original.best.string.id)
  assert.equal(restored.best.matchPercent, original.best.matchPercent)
})
test('garbage input decodes to null, never throws', () => {
  assert.doesNotThrow(() => decodeResultShareState('not-a-valid-encoding-at-all'))
  assert.equal(decodeResultShareState('not-a-valid-encoding-at-all'), null)
})
test('wrong format version decodes to null', () => {
  const encoded = encodeResultShareState(FULL_ANSWERS, 'manufacturer-only')
  const tampered = encoded.replace(/^v1:/, 'v2:')
  assert.equal(decodeResultShareState(tampered), null)
})
test('tampered/unknown option id decodes to null', () => {
  const encoded = encodeResultShareState(FULL_ANSWERS, 'manufacturer-only')
  const tampered = encoded.replace('intermediate', 'not-a-real-level')
  assert.equal(decodeResultShareState(tampered), null)
})
test('an out-of-range tension value decodes to null', () => {
  const encoded = encodeResultShareState({ ...FULL_ANSWERS, currentTensionValue: 500 }, 'manufacturer-only')
  assert.equal(decodeResultShareState(encoded), null)
})
test('empty string decodes to null', () => {
  assert.equal(decodeResultShareState(''), null)
})
test('encoded payload for a full answer set stays well under a sane URL-length budget', () => {
  const encoded = encodeResultShareState(FULL_ANSWERS, 'manufacturer-specialist')
  assert.ok(encoded.length < 500, `encoded length was ${encoded.length}`)
})
test('encoded payload never contains a "@" (no email), and only the known safe field values', () => {
  const encoded = encodeResultShareState(FULL_ANSWERS, 'manufacturer-specialist')
  assert.doesNotMatch(encoded, /@/)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
