// Smash Lab specialist knowledge — a deliberately SEPARATE layer from the
// factual manufacturer ratings in data/strings.ts.
//
// ARCHITECTURAL RULE (do not blur this):
//   data/strings.ts                      = OFFICIAL DATA
//     repulsion, durability, control, hittingSound, shockAbsorption, gauge,
//     brand, stock, productUrl — manufacturer-derived, factual/display data.
//   data/stringSpecialistProfiles.ts      = SMASH LAB SPECIALIST DATA (this file)
//     play-style fit, feel, hard-hitter/easy-power suitability, control
//     *character* (direct precision vs. shuttle grip vs. net/technical),
//     durability character, mishit tolerance, tension retention, strengths,
//     weaknesses, tags, subjective notes — real-world, subjective, and
//     explicitly provenance-tracked. Never written back into strings.ts,
//     and the numeric scores here are never manufacturer claims.
//
// This file supersedes the earlier, much lighter
// data/stringRecommendationMeta.ts (feel + powerGenerationFit + a single
// expertNote) — that schema couldn't represent the different *kinds* of
// control (direct precision vs. shuttle grip vs. net/technical), couldn't
// track evidence confidence, and only really supported one string (BG80)
// meaningfully. Everything that file captured has been migrated in here.
//
// PROVENANCE IS MANDATORY. Every profile states where it comes from
// (experienceSource) and how much to trust it (confidence). Specific
// dimensions can override the profile-level confidence when the evidence
// for that one dimension is stronger or weaker than the rest (see
// `dimensionConfidence`) — e.g. Nanogy 95 below is high-confidence on
// durability but low-confidence on control, because that's genuinely how
// well-supported each claim is.
//
// Strings with NO entry here simply have no specialist layer — they are
// scored on manufacturer data alone, and are NOT penalized for lacking a
// specialist profile. Never fabricate personal experience for a string
// nobody at Smash Lab has actually used.

export type ExperienceSource = 'personal' | 'club' | 'stringing-observation' | 'manufacturer' | 'community' | 'mixed'

export type Confidence = 'very-high' | 'high' | 'medium' | 'low' | 'unknown'

export type SpecialistFeel = 'hard' | 'medium' | 'soft'

/**
 * Specialist dimensions, scored 1–5 and only where actual evidence
 * supports a score. Sparse by design — omit anything not genuinely known
 * rather than guessing a "reasonable-sounding" number.
 */
export interface SpecialistDimensions {
  /** Suits players who already generate their own power / hit hard. */
  hardHitterFit?: number
  /** Helps players who want the string itself to generate easier power. */
  easyPower?: number
  /** Attacking / smashing performance. */
  attackSmash?: number
  /** Fast doubles suitability. */
  fastDoubles?: number
  /** Flat, low, drive-heavy rallies. */
  flatDriveGame?: number
  /** Direct, crisp precision control — distinct from grip-based control. */
  controlPrecision?: number
  /** Shuttle grip / hold — a rougher or grippier surface that "bites" the shuttle. */
  shuttleGripHold?: number
  /** Technical/net versatility — slices, spin, deceptive touch. */
  netTechnical?: number
  /** General comfort on the arm. */
  comfort?: number
  /** How direct/connected the feedback feels (opposite of muted/soft). */
  directness?: number
  /** How soft/cushioned the string feels. */
  softness?: number
  /** How well it holds its strung tension/playability over time. */
  tensionRetention?: number
  /** Everyday wear durability — NOT the same as mishit tolerance, see below. */
  normalWearDurability?: number
  /** Resistance to sudden breakage from a bad off-centre mishit — a different thing from wear durability. */
  mishitTolerance?: number
  /** How forgiving/approachable it is for newer players. */
  beginnerFriendliness?: number
  /** Performance-per-cost. */
  value?: number
  /** General all-round suitability when a player doesn't have a strong specific need. */
  allRoundSuitability?: number
}

export type SpecialistDimensionKey = keyof SpecialistDimensions

export interface StringSpecialistProfile {
  /** Characteristic feel, set only when the evidence below actually describes it. */
  feel?: SpecialistFeel
  /** Personal tension range the stringer has actually played this string at, kg — an anecdotal reference point, not a recommendation. */
  personalTensionKg?: { min: number; max: number }
  dimensions: SpecialistDimensions
  /** Per-dimension confidence override, only set where it genuinely differs from the profile-level `confidence`. */
  dimensionConfidence?: Partial<Record<SpecialistDimensionKey, Confidence>>
  strengths?: string[]
  weaknesses?: string[]
  specialistTags?: string[]
  /** Free-text context — the stringer's own read, always attributable via experienceSource/confidence. */
  subjectiveNotes?: string
  experienceSource: ExperienceSource
  confidence: Confidence
}

export const STRING_SPECIALIST_PROFILES: Record<string, StringSpecialistProfile> = {
  'yonex-bg80': {
    feel: 'hard',
    personalTensionKg: { min: 11, max: 12.5 },
    experienceSource: 'mixed', // personal (main string pre-injury) + club observation
    confidence: 'very-high',
    dimensions: {
      hardHitterFit: 5,
      attackSmash: 5,
      controlPrecision: 5,
      shuttleGripHold: 5,
      netTechnical: 5,
      easyPower: 4,
      directness: 5,
      normalWearDurability: 4,
      mishitTolerance: 4,
      tensionRetention: 4.5,
    },
    strengths: [
      'Excellent attacking control and placement',
      'Strong shuttle grip — rough texture helps slices, drops and technical control',
      'Good durability for a performance string; some hard hitters get 2–3 months out of it',
      'Better tension retention than Exbolt 63/65 in my experience',
    ],
    weaknesses: ['Harder, more direct feel — less forgiving than softer strings', 'Not as durable as BG65 or Nanogy 99'],
    specialistTags: ['hard-hitter', 'attacking-control', 'direct-feedback', 'precision', 'technical-control', 'own-power-player', 'good-durability', 'good-tension-retention'],
    subjectiveNotes:
      'Was my main string before a shoulder injury, at 11–12.5 kg — still my personal benchmark for hard, direct attacking control. A good, cheaper alternative with a similar character but less grip/control is Li-Ning No.1.',
  },

  'yonex-exbolt-65': {
    feel: 'medium',
    personalTensionKg: { min: 11.5, max: 11.5 },
    experienceSource: 'personal',
    confidence: 'high',
    dimensions: {
      allRoundSuitability: 5,
      easyPower: 4.5,
      attackSmash: 4,
      controlPrecision: 4.5,
      netTechnical: 4,
      normalWearDurability: 3,
      mishitTolerance: 4,
      tensionRetention: 2.5,
      beginnerFriendliness: 4.5,
    },
    strengths: [
      'Excellent mix of repulsion, control and sound when freshly strung — possibly the best all-rounder by a small margin at that point',
      'A genuinely easy, safe recommendation when a player isn\'t sure what they want',
      'Handles mishits reasonably well',
    ],
    weaknesses: ['Loses tension/playability relatively quickly — the main weakness', 'Not a durability specialist, though okay for normal wear'],
    specialistTags: ['premium-all-rounder', 'easy-recommendation', 'balanced', 'accessible-performance'],
    subjectiveNotes:
      "Tested personally on a Nanoflare 700 Pro around 11.5 kg. This should genuinely keep winning many balanced, all-round profiles — that's not the algorithm over-favoring it, it really is that good fresh.",
  },

  'yonex-exbolt-63': {
    feel: 'hard',
    personalTensionKg: { min: 11.5, max: 11.5 },
    experienceSource: 'personal',
    confidence: 'medium',
    dimensions: {
      fastDoubles: 5,
      attackSmash: 4,
      controlPrecision: 2.75,
      netTechnical: 3,
      normalWearDurability: 2.5,
      directness: 5,
    },
    strengths: ['Best raw repulsion I\'ve personally experienced', 'Excellent, crisp sound', 'Great for drives and fast doubles'],
    weaknesses: ['Control is harder to find because of how lively/fast it is', 'Durability clearly below BG80, BG65 and Exbolt 65'],
    specialistTags: ['maximum-repulsion', 'fast-doubles', 'drives', 'speed', 'great-sound'],
    subjectiveNotes:
      'Extremely lively — a great fit for a player chasing maximum shuttle speed, but that same liveliness makes fine control harder. Wanting easy/maximum power is a different need from already hitting hard and wanting direct control — this string suits the former much more than the latter.',
  },

  'yonex-exbolt-68': {
    feel: 'medium',
    experienceSource: 'mixed', // personal play + repeated stringing observations
    confidence: 'high',
    dimensions: {
      attackSmash: 4,
      controlPrecision: 4,
      normalWearDurability: 4.5,
      mishitTolerance: 1.75,
      tensionRetention: 3.5,
      allRoundSuitability: 4,
    },
    strengths: [
      'Good long-term wear durability if it survives early mishits',
      'Comparable performance territory to BG80, though less direct',
      'Good control',
    ],
    weaknesses: [
      'Significant mishit vulnerability — one or two bad mishits can break it, sometimes surprisingly early',
      'More mishit-sensitive than Exbolt 65 in my experience',
    ],
    specialistTags: ['performance-durability-hybrid', 'medium-feel', 'control', 'good-wear-durability', 'modern-performance', 'mishit-sensitive'],
    subjectiveNotes:
      'Wear durability and mishit tolerance are different things here: great for players who rarely mishit and want durability plus performance, much less suited to players who often break strings from bad mishits.',
  },

  'yonex-nanogy-99': {
    feel: 'medium',
    personalTensionKg: { min: 11, max: 11 },
    experienceSource: 'mixed', // current main string + two other club players
    confidence: 'very-high',
    dimensions: {
      controlPrecision: 4,
      shuttleGripHold: 5,
      netTechnical: 5,
      attackSmash: 4,
      comfort: 4.5,
      normalWearDurability: 5,
      mishitTolerance: 4.75,
      tensionRetention: 5,
      hardHitterFit: 4,
    },
    strengths: [
      'Exceptional shuttle grip and hold',
      'Outstanding control for placement, net and technical shots',
      'Very durable — I have personally never broken one',
      'Excellent tension retention',
      'Comfortable enough to be the string I switched to after a shoulder injury (BG80 felt too hard)',
    ],
    weaknesses: ['Somewhat less raw repulsion than dedicated power strings'],
    specialistTags: ['shuttle-grip-hold', 'exceptional-control', 'comfort', 'tension-stability', 'durability', 'technical-play', 'still-attack-capable'],
    subjectiveNotes:
      "My current main string, at 11 kg. Don't pigeonhole this as only a defensive/control string — it should be able to win control+durability, softer-feel+control, tension retention, shuttle grip, technical, and even some aggressive profiles that still value control and durability. Two other club players, including smash-oriented ones, now also use it.",
  },

  'yonex-bg65': {
    experienceSource: 'mixed', // playing/stringing/club knowledge
    confidence: 'high',
    dimensions: {
      normalWearDurability: 5,
      mishitTolerance: 5,
      value: 5,
      beginnerFriendliness: 4,
      controlPrecision: 2.5,
    },
    strengths: ['My pure durability benchmark', 'Cheap and long-lasting', 'Great value'],
    weaknesses: ['Can feel plastic-like/dull compared with better performance strings', 'Mediocre repulsion', 'Control nothing special'],
    specialistTags: ['maximum-durability', 'value', 'reliability', 'string-breaker', 'simple-workhorse'],
    subjectiveNotes:
      'Players can obviously adapt and play with almost anything, so this isn\'t "bad" — its whole strength is maximum durability and value. For someone who just wants something that lasts, this should realistically be able to beat Exbolt 68.',
  },

  'yonex-nanogy-95': {
    experienceSource: 'stringing-observation',
    confidence: 'high', // for the durability claim specifically — see dimensionConfidence for the softer claims
    dimensionConfidence: { controlPrecision: 'low' },
    dimensions: {
      normalWearDurability: 5,
      mishitTolerance: 5,
      controlPrecision: 3.75,
    },
    strengths: [
      "Excellent durability and mishit tolerance — held up far longer than the breakage pattern I'd normally expect",
      'Somewhat better control and repulsion than BG65 (general understanding, not direct personal play)',
    ],
    weaknesses: ['Exact feel and tension retention are not something I can speak to directly — left unknown rather than guessed'],
    specialistTags: ['durability-first', 'hard-hitter-frequent-breaker', 'good-mishit-tolerance', 'better-performance-than-bg65'],
    subjectiveNotes:
      'A hard-hitting club player with frequent mishits and high tension who normally broke strings roughly every other week has had this hold up far longer — still holding, to my knowledge, at time of writing. Feel and tension retention are deliberately left unscored: I haven\'t played it myself.',
  },

  'yonex-skyarc': {
    feel: 'soft',
    experienceSource: 'mixed', // tested by me and others
    confidence: 'high', // for playability; durability is unknown, not low-confidence — we simply don't have data
    dimensions: {
      softness: 5,
      comfort: 5,
      directness: 1,
      easyPower: 1.5,
    },
    strengths: ['Genuine ultra-soft, maximum-comfort niche option', 'Maximum shock absorption'],
    weaknesses: [
      'In Smash Lab testing, it absorbed too much energy for the "easy power" effect it\'s often marketed around',
      'Multiple players struggled to hit clears to the back of the court',
      'Durability unknown — we removed it from testing quickly, so there is no wear data',
    ],
    specialistTags: ['ultra-soft', 'high-absorption', 'niche', 'maximum-comfort-niche', 'disappointing-easy-power-in-testing'],
    subjectiveNotes:
      "Intended to be strung lower for a trampoline/easy-power effect, but in our own testing that didn't translate into easier distance — AeroBite, Nanogy 99, and even Nanogy 95 felt better to us overall. Still a legitimate pick for someone who wants maximum softness above all else — it just shouldn't win broadly on the strength of its manufacturer shock-absorption number alone.",
  },

  'yonex-aerobite': {
    experienceSource: 'personal',
    confidence: 'high', // for feel/performance
    dimensionConfidence: { normalWearDurability: 'medium', mishitTolerance: 'medium' }, // lower confidence specifically on long-term durability
    dimensions: {
      controlPrecision: 5,
      attackSmash: 5,
      netTechnical: 5,
      allRoundSuitability: 5,
      mishitTolerance: 3.25,
      normalWearDurability: 2.75,
    },
    strengths: [
      'Excellent repulsion and control together',
      'Strong technical versatility — comfortable playing any shot',
      'Very good attacking ability despite being control-focused',
    ],
    weaknesses: ['Durability is not great'],
    specialistTags: ['technical-versatility', 'control', 'repulsion', 'net-play', 'attacking-control', 'premium-performance', 'durability-trade-off'],
    subjectiveNotes:
      'Should have a genuine path to #1 for advanced, control+repulsion, technical/net, and attacking profiles where durability isn\'t the top priority.',
  },

  'lining-no1': {
    feel: 'hard',
    experienceSource: 'personal', // comparative experience vs. BG80
    confidence: 'high',
    dimensions: {
      attackSmash: 4.75,
      controlPrecision: 4,
      shuttleGripHold: 3.5,
      fastDoubles: 4.5,
      normalWearDurability: 4,
      value: 5,
    },
    strengths: ['Very good value BG80-style alternative', 'Strong aggressive play and repulsion', 'Good durability, roughly similar territory to BG80 in my experience'],
    weaknesses: ['Less rough/grippy than BG80 — slices and drops are a bit easier with BG80 specifically', 'Control slightly below BG80'],
    specialistTags: ['value-bg80-alternative', 'aggressive', 'repulsion', 'fast-play', 'good-durability', 'less-technical-grip-than-bg80'],
    subjectiveNotes: 'For aggressive/fast play plus value, this can sometimes beat BG80 outright. For maximum grip and control on slices, BG80 should usually still win.',
  },

  'yonex-bg66-ultimax': {
    feel: 'medium',
    experienceSource: 'mixed', // personal + observations from others
    confidence: 'high',
    dimensions: {
      fastDoubles: 5,
      flatDriveGame: 5,
      controlPrecision: 4.5,
      attackSmash: 4.5,
      normalWearDurability: 2.75,
    },
    strengths: [
      'Excellent repulsion for drives, flat/low game and fast doubles',
      'Still allows strong control and placement',
      'Backcourt smashes still feel good',
      'Very well liked by players generally',
    ],
    weaknesses: ['Main weakness is durability — hard hitters in particular break these quite often'],
    specialistTags: ['fast-but-controlled', 'drives', 'flat-game', 'fast-doubles', 'crisp', 'repulsive', 'versatile-speed-string', 'durability-trade-off'],
    subjectiveNotes:
      'Think of these as different points on the same spectrum: Exbolt 63 = maximum raw repulsion/very lively. BG66 Ultimax = fast + controlled. Exbolt 65 = best all-round balance.',
  },
}

export function getSpecialistProfile(id: string): StringSpecialistProfile | undefined {
  return STRING_SPECIALIST_PROFILES[id]
}

/**
 * NOT ADDED: Victor VBS-63 "Dragon Ball". This string isn't currently in
 * the string catalog (data/strings.ts only has Victor VBS-66 Nano). Adding
 * it would require official repulsion/durability/control/hitting-sound/
 * shock-absorption numbers on the same 0–11 scale used everywhere else,
 * and no reliable source for those was available — inventing them would
 * violate "don't invent technical specifications." If you can supply
 * Victor's official specs (or explicitly approve an estimate with clearly
 * flagged low confidence), it can be added as a full catalog entry plus a
 * specialist profile using the description already on file:
 * "very similar to Exbolt 63 — extremely repulsive/fast, better durability
 * than Exbolt 63 in my experience" (personal, medium confidence).
 */
