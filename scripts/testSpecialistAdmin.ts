// Automated tests for Phase 6's specialist profile administration (form
// validation/mapping) and the public read-path's row validation. Plain
// assertions via node:assert/strict, run directly with tsx — matching
// scripts/testCatalogAdmin.ts's style. No network calls: these test the
// pure validation/mapping logic only. The actual Supabase CRUD calls
// (upsertSpecialistProfile/deleteSpecialistProfile/fetchAdminSpecialistList)
// require a real or local Postgres+PostgREST instance and were verified
// separately through manual/integration testing — see the Phase 6 report.
//
// Run: npm run test:specialist-admin

import assert from 'node:assert/strict'
import {
  validateSpecialistInput,
  emptySpecialistFormInput,
  specialistFormInputFromRow,
  type AdminSpecialistRow,
  type SpecialistFormInput,
} from '../src/services/specialistAdminService.js'
import { mapSpecialistProfileRow } from '../src/services/specialistProfileService.js'
import type { Database } from '../src/types/database.js'

type SpecialistProfileRow = Database['public']['Tables']['specialist_profiles']['Row']

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

function validInput(overrides: Partial<SpecialistFormInput> = {}): SpecialistFormInput {
  return {
    ...emptySpecialistFormInput(),
    experienceSource: 'personal',
    confidence: 'high',
    ...overrides,
  }
}

function baseRow(overrides: Partial<SpecialistProfileRow> = {}): SpecialistProfileRow {
  return {
    string_id: 'yonex-bg80',
    feel: null,
    personal_tension_min_kg: null,
    personal_tension_max_kg: null,
    experience_source: 'personal',
    confidence: 'high',
    dimensions: {},
    dimension_confidence: null,
    strengths: null,
    weaknesses: null,
    specialist_tags: null,
    subjective_notes: null,
    reviewer: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

console.log('=== Required-field validation ===')
test('rejects a completely empty input (missing experienceSource/confidence)', () => {
  const result = validateSpecialistInput(emptySpecialistFormInput())
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.experienceSource)
    assert.ok(result.errors.confidence)
  }
})
test('accepts a minimal valid input (only experienceSource + confidence set)', () => {
  const result = validateSpecialistInput(validInput())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.experience_source, 'personal')
    assert.equal(result.update.confidence, 'high')
    assert.equal(result.update.feel, null)
    assert.equal(result.update.reviewer, null)
    assert.deepStrictEqual(result.update.dimensions, {})
  }
})
test('rejects an invalid experienceSource value', () => {
  const result = validateSpecialistInput(validInput({ experienceSource: 'not-a-real-source' }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.experienceSource)
})
test('rejects an invalid confidence value', () => {
  const result = validateSpecialistInput(validInput({ confidence: 'super-duper-sure' }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.confidence)
})
test('accepts a blank feel (optional) but rejects a garbage one', () => {
  const blank = validateSpecialistInput(validInput({ feel: '' }))
  assert.equal(blank.ok, true)
  const garbage = validateSpecialistInput(validInput({ feel: 'crunchy' }))
  assert.equal(garbage.ok, false)
  if (!garbage.ok) assert.ok(garbage.errors.feel)
})

console.log('\n=== Personal tension range ===')
test('rejects min without max', () => {
  const result = validateSpecialistInput(validInput({ personalTensionMinKg: '9' }))
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.personalTensionMinKg)
    assert.ok(result.errors.personalTensionMaxKg)
  }
})
test('rejects min greater than max', () => {
  const result = validateSpecialistInput(validInput({ personalTensionMinKg: '12', personalTensionMaxKg: '9' }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.personalTensionMaxKg)
})
test('accepts a valid min/max pair', () => {
  const result = validateSpecialistInput(validInput({ personalTensionMinKg: '9', personalTensionMaxKg: '11' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.personal_tension_min_kg, 9)
    assert.equal(result.update.personal_tension_max_kg, 11)
  }
})
test('both blank is valid (no personal tension recorded)', () => {
  const result = validateSpecialistInput(validInput())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.personal_tension_min_kg, null)
    assert.equal(result.update.personal_tension_max_kg, null)
  }
})

console.log('\n=== Dimensions (1-5) ===')
test('accepts an in-range dimension value', () => {
  const result = validateSpecialistInput(validInput({ dimensions: { comfort: '4' } }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.update.dimensions?.comfort, 4)
})
test('rejects an out-of-range dimension value', () => {
  const result = validateSpecialistInput(validInput({ dimensions: { comfort: '6' } }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.dimensions?.comfort)
})
test('rejects a non-numeric dimension value', () => {
  const result = validateSpecialistInput(validInput({ dimensions: { comfort: 'high' } }))
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.dimensions?.comfort)
})
test('blank dimension values are skipped, not defaulted', () => {
  const result = validateSpecialistInput(validInput({ dimensions: { comfort: '', value: '3' } }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.dimensions?.comfort, undefined)
    assert.equal(result.update.dimensions?.value, 3)
  }
})
test('multiple invalid dimensions each get their own error', () => {
  const result = validateSpecialistInput(validInput({ dimensions: { comfort: '9', value: '-1' } }))
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.errors.dimensions?.comfort)
    assert.ok(result.errors.dimensions?.value)
  }
})

console.log('\n=== Text handling ===')
test('trims reviewer and subjectiveNotes', () => {
  const result = validateSpecialistInput(validInput({ reviewer: '  Alex  ', subjectiveNotes: '  plays great  ' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.reviewer, 'Alex')
    assert.equal(result.update.subjective_notes, 'plays great')
  }
})
test('blank reviewer/subjectiveNotes become null, not empty strings', () => {
  const result = validateSpecialistInput(validInput({ reviewer: '   ', subjectiveNotes: '' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.reviewer, null)
    assert.equal(result.update.subjective_notes, null)
  }
})
test('parses strengths/weaknesses as one item per line, trimmed, blanks dropped', () => {
  const result = validateSpecialistInput(validInput({ strengths: '  Repulsion \n\n Durability ', weaknesses: 'Comfort' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepStrictEqual(result.update.strengths, ['Repulsion', 'Durability'])
    assert.deepStrictEqual(result.update.weaknesses, ['Comfort'])
  }
})
test('blank strengths/weaknesses become null, not empty arrays', () => {
  const result = validateSpecialistInput(validInput({ strengths: '', weaknesses: '   \n  ' }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.update.strengths, null)
    assert.equal(result.update.weaknesses, null)
  }
})
test('parses specialistTags as comma-separated, trimmed, blanks dropped', () => {
  const result = validateSpecialistInput(validInput({ specialistTags: ' aggressive , doubles ,,  ' }))
  assert.equal(result.ok, true)
  if (result.ok) assert.deepStrictEqual(result.update.specialist_tags, ['aggressive', 'doubles'])
})
test('blank specialistTags becomes null, not an empty array', () => {
  const result = validateSpecialistInput(validInput({ specialistTags: '' }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.update.specialist_tags, null)
})

console.log('\n=== Row -> form input round-trip (used to populate the edit form) ===')
test('specialistFormInputFromRow round-trips through validateSpecialistInput back to equivalent update values', () => {
  const row: AdminSpecialistRow = {
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    hasProfile: true,
    feel: 'medium',
    experienceSource: 'personal',
    confidence: 'high',
    reviewer: 'Alex',
    subjectiveNotes: 'Plays great for control players.',
    strengths: ['Repulsion', 'Durability'],
    weaknesses: ['Comfort'],
    specialistTags: ['aggressive', 'doubles'],
    personalTensionMinKg: 9,
    personalTensionMaxKg: 11,
    dimensions: { comfort: 4, value: 3 },
    updatedAt: '2026-01-01T00:00:00Z',
  }
  const formInput = specialistFormInputFromRow(row)
  const result = validateSpecialistInput(formInput)
  assert.equal(result.ok, true)
  if (result.ok) {
    const u = result.update
    assert.equal(u.feel, row.feel)
    assert.equal(u.experience_source, row.experienceSource)
    assert.equal(u.confidence, row.confidence)
    assert.equal(u.reviewer, row.reviewer)
    assert.equal(u.subjective_notes, row.subjectiveNotes)
    assert.deepStrictEqual(u.strengths, row.strengths)
    assert.deepStrictEqual(u.weaknesses, row.weaknesses)
    assert.deepStrictEqual(u.specialist_tags, row.specialistTags)
    assert.equal(u.personal_tension_min_kg, row.personalTensionMinKg)
    assert.equal(u.personal_tension_max_kg, row.personalTensionMaxKg)
    assert.deepStrictEqual(u.dimensions, row.dimensions)
  }
})
test('a row with no profile round-trips to a minimal-but-invalid form (blank experienceSource/confidence)', () => {
  const row: AdminSpecialistRow = {
    stringId: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    hasProfile: false,
    feel: null,
    experienceSource: null,
    confidence: null,
    reviewer: null,
    subjectiveNotes: null,
    strengths: null,
    weaknesses: null,
    specialistTags: null,
    personalTensionMinKg: null,
    personalTensionMaxKg: null,
    dimensions: {},
    updatedAt: null,
  }
  const formInput = specialistFormInputFromRow(row)
  const result = validateSpecialistInput(formInput)
  assert.equal(result.ok, false, 'a blank profile is not itself a valid save — the editor must require a source and confidence before creating one')
})

console.log('\n=== Public read-path row validation (mapSpecialistProfileRow) — must reject exactly what the admin editor would never produce ===')
test('accepts a well-formed row', () => {
  const result = mapSpecialistProfileRow(baseRow({ feel: 'hard', dimensions: { comfort: 4 } }))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.stringId, 'yonex-bg80')
    assert.equal(result.profile.feel, 'hard')
    assert.equal(result.profile.dimensions.comfort, 4)
  }
})
test('rejects an empty string_id', () => {
  const result = mapSpecialistProfileRow(baseRow({ string_id: '  ' }))
  assert.equal(result.ok, false)
})
test('rejects an invalid confidence value that could not come from the admin editor', () => {
  const result = mapSpecialistProfileRow(baseRow({ confidence: 'super-sure' as SpecialistProfileRow['confidence'] }))
  assert.equal(result.ok, false)
})
test('rejects a dimension value out of the 1-5 range', () => {
  const result = mapSpecialistProfileRow(baseRow({ dimensions: { comfort: 9 } }))
  assert.equal(result.ok, false)
})
test('rejects a personal tension range with only one bound set', () => {
  const result = mapSpecialistProfileRow(baseRow({ personal_tension_min_kg: 9, personal_tension_max_kg: null }))
  assert.equal(result.ok, false)
})
test('carries reviewer through to the mapped profile', () => {
  const result = mapSpecialistProfileRow(baseRow({ reviewer: 'Alex' }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.profile.reviewer, 'Alex')
})
test('a row with no reviewer produces a profile with no reviewer field (not an empty string)', () => {
  const result = mapSpecialistProfileRow(baseRow({ reviewer: null }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.profile.reviewer, undefined)
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
