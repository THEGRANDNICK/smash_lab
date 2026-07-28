import { useEffect, useState } from 'react'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles.js'
import { getLocalFallbackSpecialistProfiles, fetchSpecialistProfilesFromSupabase } from '../services/specialistProfileService.js'

/**
 * Returns the current specialist-profile map — starts synchronously from
 * the local fallback file (identical first paint to before Phase 6), then
 * replaces it with the live Supabase result once fetched, unless that fetch
 * fails outright (see specialistProfileService.ts for the fallback rule).
 * Deliberately thin, mirroring useStringPool.ts: all fetching/validation/
 * fallback logic lives in the service, not here.
 */
export function useSpecialistProfiles(): Record<string, StringSpecialistProfile> {
  const [profiles, setProfiles] = useState<Record<string, StringSpecialistProfile>>(getLocalFallbackSpecialistProfiles)

  useEffect(() => {
    let cancelled = false

    fetchSpecialistProfilesFromSupabase().then((result) => {
      if (cancelled) return
      setProfiles(result.profiles)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return profiles
}
