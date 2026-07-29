// Automatic base-color inference — the core of "minimal hard-coded color
// names" (see logic/stringColor.ts's layered resolver). Instead of a
// growing table of every manufacturer color name, this module holds a
// small, fixed set of ~24 recognizable BASE colors and tokenizes an
// unrecognized name to find one of them, so future names automatically
// work without a code change whenever their base color is recognizable
// (e.g. "Fire Orange" -> orange, "Cosmic Gold" -> gold) — see
// logic/stringColor.ts's resolveColor() for how this fits into the full
// resolution order.

/** For colors that read fine against both a light card and a dark hero without extra help. */
export const SUBTLE_RING = 'ring-1 ring-black/10 dark:ring-white/25'
/** For colors that disappear into one background or the other without a firmer edge. */
export const STRONG_RING = 'ring-1 ring-black/30 dark:ring-white/50'

interface BaseColorDefinition {
  /** The CSS color value to render — a standard keyword where one exists and reads well; an explicit hex only where no CSS keyword gives adequate visibility (mint, natural). */
  cssColor: string
  ringClassName: string
}

/**
 * The compact, deliberately small set of recognizable base colors this
 * app infers from a longer manufacturer name. Every entry here is either
 * a real CSS keyword (rendered as-is) or, only where no CSS keyword is
 * suitable for visibility, a hand-picked hex. This is NOT a manufacturer
 * color table — it's the fixed vocabulary of "common English color
 * words" the inference step looks for.
 */
const BASE_COLOR_DEFINITIONS: Record<string, BaseColorDefinition> = {
  red: { cssColor: 'red', ringClassName: SUBTLE_RING },
  orange: { cssColor: 'orange', ringClassName: SUBTLE_RING },
  yellow: { cssColor: '#f5d90a', ringClassName: STRONG_RING },
  lime: { cssColor: 'lime', ringClassName: STRONG_RING },
  green: { cssColor: 'green', ringClassName: SUBTLE_RING },
  mint: { cssColor: '#98ff98', ringClassName: STRONG_RING },
  turquoise: { cssColor: 'turquoise', ringClassName: SUBTLE_RING },
  cyan: { cssColor: 'cyan', ringClassName: SUBTLE_RING },
  'sky blue': { cssColor: 'skyblue', ringClassName: SUBTLE_RING },
  blue: { cssColor: 'blue', ringClassName: SUBTLE_RING },
  navy: { cssColor: 'navy', ringClassName: SUBTLE_RING },
  purple: { cssColor: 'purple', ringClassName: SUBTLE_RING },
  violet: { cssColor: 'violet', ringClassName: SUBTLE_RING },
  pink: { cssColor: 'pink', ringClassName: STRONG_RING },
  coral: { cssColor: 'coral', ringClassName: SUBTLE_RING },
  white: { cssColor: 'white', ringClassName: STRONG_RING },
  ivory: { cssColor: 'ivory', ringClassName: STRONG_RING },
  black: { cssColor: 'black', ringClassName: STRONG_RING },
  gray: { cssColor: 'gray', ringClassName: SUBTLE_RING },
  silver: { cssColor: 'silver', ringClassName: STRONG_RING },
  gold: { cssColor: 'gold', ringClassName: SUBTLE_RING },
  natural: { cssColor: '#f2ead8', ringClassName: STRONG_RING },
  beige: { cssColor: 'beige', ringClassName: STRONG_RING },
  brown: { cssColor: 'brown', ringClassName: SUBTLE_RING },
}

/**
 * Small, necessary spelling/legacy aliases — NOT a place for full color
 * entries (see logic/stringColor.ts's ALIASES for the documented list of
 * what's here and why). Maps directly to a BASE_COLOR_DEFINITIONS key.
 */
const ALIASES: Record<string, string> = {
  turquois: 'turquoise', // real Supabase data has this misspelling
  grey: 'gray', // canonicalize the alternate spelling so both dedupe to one swatch/label
}

export interface BaseColorMatch {
  /** The BASE_COLOR_DEFINITIONS key that matched (e.g. "orange", "sky blue"). */
  canonicalKey: string
  cssColor: string
  ringClassName: string
}

function lookupBase(key: string): BaseColorMatch | undefined {
  const def = BASE_COLOR_DEFINITIONS[key]
  if (!def) return undefined
  return { canonicalKey: key, cssColor: def.cssColor, ringClassName: def.ringClassName }
}

/** Direct lookup by canonical key (e.g. "orange") — used when a raw name is ALSO already a recognized base color (not just a CSS keyword), so its ring gets the curated visibility treatment rather than a generic default. Undefined for a CSS keyword this module doesn't separately track as a base color (e.g. "tomato"). */
export function lookupBaseColor(key: string): BaseColorMatch | undefined {
  return lookupBase(key.trim().toLowerCase())
}

/** Resolves the small exceptional-alias table only — e.g. "Turquois" -> the "turquoise" base color. Distinct from inferBaseColor(): this is an exact, whole-name lookup, not tokenization. */
export function resolveAlias(name: string): BaseColorMatch | undefined {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const canonicalKey = ALIASES[normalized]
  return canonicalKey ? lookupBase(canonicalKey) : undefined
}

/**
 * Tokenizes `name` on whitespace/hyphens and looks for a recognizable
 * base-color word or two-word phrase, checked from the END of the name
 * backward (manufacturer names consistently put the base color word
 * last: "Fire Orange", "Ivory White", "Cosmic Gold", "Royal Blue") and
 * preferring the longest matching suffix so a two-word base color like
 * "sky blue" is found intact rather than only its second word. Returns
 * undefined if no token/phrase is a recognized base color — never
 * guesses from an unrelated word.
 */
export function inferBaseColor(name: string): BaseColorMatch | undefined {
  const tokens = name
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
  if (tokens.length === 0) return undefined

  const maxPhraseWords = Math.max(...Object.keys(BASE_COLOR_DEFINITIONS).map((k) => k.split(' ').length))
  for (let phraseLen = Math.min(maxPhraseWords, tokens.length); phraseLen >= 1; phraseLen--) {
    const suffix = tokens.slice(tokens.length - phraseLen).join(' ')
    const match = lookupBase(suffix)
    if (match) return match
  }
  return undefined
}

/** Every base-color key this module recognizes — exposed only for tests/diagnostics, not for resolution logic elsewhere. */
export function baseColorKeys(): string[] {
  return Object.keys(BASE_COLOR_DEFINITIONS)
}
