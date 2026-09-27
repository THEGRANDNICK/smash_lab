import { describe, it, expect } from 'vitest'
import { applyMapPlacement, deriveDimensions, derivedConfidence, isValidPlacement } from './mapPlacement'
import { computeStringMapPosition } from './stringMapPosition'
import { mapSpecialistProfileRow } from '../services/specialistProfileService'
import { strings } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'

const hardHold = { holdRepulsion: 0.3, softHard: 0.9 }
const softLively = { holdRepulsion: 0.9, softHard: 0.15 }

describe('deriveDimensions', () => {
  it('reads hard + hold as a direct, precise hard-hitter string', () => {
    const d = deriveDimensions(hardHold)
    expect(d.directness).toBeGreaterThanOrEqual(4.5)
    expect(d.hardHitterFit).toBeGreaterThanOrEqual(4.5)
    expect(d.controlPrecision).toBeGreaterThanOrEqual(4)
    expect(d.comfort).toBeLessThanOrEqual(1.5)
    expect(d.easyPower!).toBeLessThan(d.hardHitterFit!)
  })

  it('reads soft + lively as easy power and comfort', () => {
    const d = deriveDimensions(softLively)
    expect(d.easyPower).toBeGreaterThanOrEqual(4.5)
    expect(d.comfort).toBeGreaterThanOrEqual(4.5)
    expect(d.shuttleGripHold).toBeLessThanOrEqual(1.5)
  })

  it('keeps every derived score inside 1–5 at the extreme corners', () => {
    for (const holdRepulsion of [0, 1]) {
      for (const softHard of [0, 1]) {
        for (const v of Object.values(deriveDimensions({ holdRepulsion, softHard, durability: 5, mishit: 'robust' }))) {
          expect(v).toBeGreaterThanOrEqual(1)
          expect(v).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('centre of the map = all-rounder', () => {
    expect(deriveDimensions({ holdRepulsion: 0.5, softHard: 0.5 }).allRoundSuitability).toBe(5)
    expect(deriveDimensions({ holdRepulsion: 1, softHard: 1 }).allRoundSuitability).toBe(1)
  })

  it('only sets durability dimensions when answered, and never guesses tension retention or value', () => {
    const bare = deriveDimensions(hardHold)
    expect(bare.normalWearDurability).toBeUndefined()
    expect(bare.mishitTolerance).toBeUndefined()
    expect(bare.tensionRetention).toBeUndefined()
    expect(bare.value).toBeUndefined()

    const full = deriveDimensions({ ...hardHold, durability: 5, mishit: 'sensitive' })
    expect(full.normalWearDurability).toBe(5)
    expect(full.mishitTolerance).toBe(1.5)
  })
})

describe('applyMapPlacement', () => {
  const base: StringSpecialistProfile = { experienceSource: 'personal', confidence: 'very-high', dimensions: { directness: 2 } }

  it('never overrides a hand-typed value', () => {
    const out = applyMapPlacement({ ...base, mapPlacement: hardHold })
    expect(out.dimensions.directness).toBe(2)
    expect(out.dimensionConfidence?.directness).toBeUndefined()
    expect(out.dimensions.hardHitterFit).toBeGreaterThan(4)
  })

  it('trusts derived values less than the profile itself, capped at medium', () => {
    const out = applyMapPlacement({ ...base, mapPlacement: hardHold })
    expect(out.dimensionConfidence?.hardHitterFit).toBe('medium')
    expect(derivedConfidence('medium')).toBe('low')
    expect(derivedConfidence('unknown')).toBe('unknown')
  })

  it('leaves profiles without a placement untouched', () => {
    expect(applyMapPlacement(base)).toBe(base)
  })
})

describe('map + read path', () => {
  it('shows a placed string exactly where it was dropped', () => {
    const pos = computeStringMapPosition(strings[0], { ...{ experienceSource: 'personal', confidence: 'high', dimensions: {} }, mapPlacement: hardHold }, true)
    expect(pos.holdRepulsion).toBe(0.3)
    expect(pos.softHard).toBe(0.9)
    expect(pos.softHardSource).toBe('specialist-map-placement')
  })

  it('validates placements', () => {
    expect(isValidPlacement(hardHold)).toBe(true)
    expect(isValidPlacement({ holdRepulsion: 1.2, softHard: 0.5 })).toBe(false)
    expect(isValidPlacement({ ...hardHold, mishit: 'sometimes' })).toBe(false)
  })

  it('fills dimensions from map_placement when reading a Supabase row', () => {
    const result = mapSpecialistProfileRow({
      string_id: 'yonex-bg65',
      feel: null,
      personal_tension_min_kg: null,
      personal_tension_max_kg: null,
      experience_source: 'club',
      confidence: 'high',
      dimensions: {},
      dimension_confidence: null,
      strengths: null,
      weaknesses: null,
      specialist_tags: null,
      subjective_notes: null,
      reviewer: null,
      map_placement: { holdRepulsion: 0.45, softHard: 0.4, durability: 5, mishit: 'robust' },
      updated_at: '2026-09-27T00:00:00Z',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile.dimensions.normalWearDurability).toBe(5)
      expect(result.profile.dimensions.mishitTolerance).toBe(5)
      expect(result.profile.dimensions.allRoundSuitability).toBeGreaterThan(3)
    }
  })

  it('rejects a broken map_placement instead of crashing', () => {
    const result = mapSpecialistProfileRow({
      string_id: 'x',
      feel: null,
      personal_tension_min_kg: null,
      personal_tension_max_kg: null,
      experience_source: 'club',
      confidence: 'high',
      dimensions: {},
      dimension_confidence: null,
      strengths: null,
      weaknesses: null,
      specialist_tags: null,
      subjective_notes: null,
      reviewer: null,
      map_placement: { holdRepulsion: 7, softHard: 0.4 },
      updated_at: '2026-09-27T00:00:00Z',
    })
    expect(result.ok).toBe(false)
  })
})
