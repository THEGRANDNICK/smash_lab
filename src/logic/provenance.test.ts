import { describe, it, expect } from 'vitest'
import { provenanceOf, THIN_HANDS_ON } from './provenance'
import { STRING_SPECIALIST_PROFILES } from '../data/stringSpecialistProfiles'

describe('provenance of hands-on data', () => {
  it('counts rated properties and names source and certainty in plain words', () => {
    const p = provenanceOf(STRING_SPECIALIST_PROFILES['yonex-bg80'])
    expect(p.ratedCount).toBeGreaterThanOrEqual(THIN_HANDS_ON)
    expect(p.thin).toBe(false)
    expect(p.source).toBeTruthy()
  })
  it('a string without hands-on data is "thin" and has no source', () => {
    const p = provenanceOf(undefined)
    expect(p).toEqual({ ratedCount: 0, source: null, confidence: null, thin: true })
  })
})
