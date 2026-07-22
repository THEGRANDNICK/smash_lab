// Recommendation-only metadata — an experienced stringer's contextual read
// on how a string plays in practice, layered ON TOP of (never mixed into)
// the factual manufacturer ratings in data/strings.ts.
//
// ARCHITECTURAL RULE:
//   data/strings.ts            = factual/display data (manufacturer ratings)
//   data/stringRecommendationMeta.ts = expert/contextual interpretation
//
// This file is consumed only by the quiz's scoring engine
// (logic/recommendationEngine.ts) to add a small, capped fit bonus and to
// write more natural result explanations. It is never rendered as if it
// were a raw manufacturer spec, and it never changes the numbers in
// strings.ts. Entries are added conservatively — only where there's a
// reasonably well-established, real-world read on the string; strings with
// no entry simply get no metadata-driven bonus.

export type StringFeel = 'soft' | 'medium' | 'hard'

/**
 * Which player power-generation profile a string tends to suit in
 * practice, independent of its raw repulsion number. A string can suit
 * more than one profile.
 */
export type PowerGenerationFit = 'easyPower' | 'balanced' | 'ownPower'

export interface StringRecommendationMeta {
  /** Characteristic stringbed feel, set conservatively and only when reasonably well established. */
  feel?: StringFeel
  /** Power-generation profiles this string particularly suits. */
  powerGenerationFit?: PowerGenerationFit[]
  /** Short practical note used only to enrich result explanations — the stringer's own read, not a manufacturer claim. */
  expertNote?: string
}

export const STRING_RECOMMENDATION_META: Record<string, StringRecommendationMeta> = {
  'yonex-aerosonic': {
    feel: 'hard',
    powerGenerationFit: ['easyPower'],
  },
  'yonex-bg66-force': {
    feel: 'medium',
    powerGenerationFit: ['balanced'],
  },
  'yonex-bg66-ultimax': {
    feel: 'hard',
    powerGenerationFit: ['balanced', 'easyPower'],
  },
  'yonex-bg80': {
    feel: 'hard',
    powerGenerationFit: ['ownPower'],
    expertNote:
      "it's an established performance string that a lot of hard-hitting attacking players still reach for — it rewards a swing that already generates its own power with a direct, connected feel, rather than trying to generate power for you",
  },
  'yonex-exbolt-65': {
    feel: 'medium',
    powerGenerationFit: ['balanced'],
  },
  'yonex-exbolt-63': {
    feel: 'hard',
    powerGenerationFit: ['easyPower'],
  },
  'yonex-aerobite': {
    feel: 'medium',
    powerGenerationFit: ['balanced'],
  },
  'yonex-skyarc': {
    feel: 'soft',
    powerGenerationFit: ['easyPower', 'balanced'],
  },
  'yonex-nanogy-99': {
    feel: 'soft',
    powerGenerationFit: ['balanced'],
  },
  'yonex-exbolt-68': {
    feel: 'medium',
    powerGenerationFit: ['balanced'],
  },
  'yonex-bg65': {
    feel: 'medium',
  },
  'lining-no1': {
    feel: 'hard',
    powerGenerationFit: ['easyPower'],
  },
}

export function getRecommendationMeta(id: string): StringRecommendationMeta | undefined {
  return STRING_RECOMMENDATION_META[id]
}
