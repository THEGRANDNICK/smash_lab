// Plain-language provenance for hands-on data: who rated it, how sure, how much of it there is.
import type { Confidence, ExperienceSource, StringSpecialistProfile } from '../data/stringSpecialistProfiles'

/** Number of hands-on properties a string can be rated on. */
export const HANDS_ON_PROPERTY_COUNT = 15
/** Below this many rated properties a pick is called "mostly manufacturer data". */
export const THIN_HANDS_ON = 5

const SOURCE_LABEL: Record<ExperienceSource, string> = {
  personal: 'played by the stringer',
  club: 'club players’ feedback',
  'stringing-observation': 'seen while stringing',
  manufacturer: 'manufacturer information',
  community: 'community research',
  mixed: 'stringer + club experience',
}
const CONFIDENCE_LABEL: Record<Confidence, string> = { 'very-high': 'very sure', high: 'sure', medium: 'fairly sure', low: 'unsure', unknown: 'unknown certainty' }

export interface Provenance {
  ratedCount: number
  source: string | null
  confidence: string | null
  thin: boolean
}

export function provenanceOf(profile: StringSpecialistProfile | undefined): Provenance {
  const ratedCount = profile ? Object.values(profile.dimensions).filter((v) => typeof v === 'number').length : 0
  return {
    ratedCount,
    source: profile ? SOURCE_LABEL[profile.experienceSource] ?? null : null,
    confidence: profile ? CONFIDENCE_LABEL[profile.confidence] ?? null : null,
    thin: ratedCount < THIN_HANDS_ON,
  }
}
