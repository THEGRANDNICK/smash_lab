// Deleting hands-on data in the database must remove it from the recommendations: on the live site
// (Supabase configured) the built-in copy in the code never stands in.
import { describe, it, expect } from 'vitest'
import { getLocalFallbackSpecialistProfiles } from './specialistProfileService'
import { STRING_SPECIALIST_PROFILES } from '../data/stringSpecialistProfiles'

describe('built-in hands-on copy', () => {
  it('is never used on the live site (Supabase configured): no data means no data', () => {
    expect(getLocalFallbackSpecialistProfiles(true)).toEqual({})
  })
  it('is only used for local development without a database', () => {
    expect(getLocalFallbackSpecialistProfiles(false)).toBe(STRING_SPECIALIST_PROFILES)
  })
})
