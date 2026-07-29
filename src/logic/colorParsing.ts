// Phase 9 fix: real Supabase testing showed the single free-text inventory
// `color` field sometimes holds more than one color (e.g. "White, Red",
// "White; Red", or "Black/Yellow" for a hybrid's main/cross pair), and the
// catalog's comma-only color-list parsing missed semicolon-separated
// entries. This module is the one place that splits a free-text color
// value into individual tokens — every caller (stringColor.ts, the admin
// forms/previews, diagnostics, catalogAdminService's parseColors) goes
// through it, so the rules below apply everywhere consistently.

/** Comma and semicolon are treated as an unambiguous "these are separate colors" signal in a free-text field — never a bare "/" (see parseLegacyHybridPair) and never internal whitespace, so multi-word names like "Sky Blue" survive intact. */
const UNAMBIGUOUS_DELIMITER = /[,;]/

/** True if `raw` contains a comma or semicolon — used by admin UI to warn when a field meant to hold one color looks like it holds more than one. */
export function containsUnambiguousDelimiter(raw: string): boolean {
  return UNAMBIGUOUS_DELIMITER.test(raw)
}

/** True if `raw` contains a bare "/" — ambiguous on its own (could mean "two colors" or, for a hybrid, "main/cross"), so callers decide what to do with it rather than this module guessing. */
export function containsSlash(raw: string): boolean {
  return raw.includes('/')
}

/**
 * Splits a free-text color value on commas/semicolons only — never on a
 * slash (too ambiguous) and never on internal spaces, so multi-word names
 * ("Sky Blue", "Neon Yellow", "Cosmic Gold") and hex values survive
 * intact. Trims each piece, drops blanks, and preserves original casing —
 * canonicalization/aliasing happens downstream in stringColor.ts.
 */
export function splitColorList(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(UNAMBIGUOUS_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Attempts to read a legacy combined value as a hybrid main/cross pair —
 * e.g. "White/Red" -> { main: "White", cross: "Red" } — only when it's
 * unambiguous: exactly one "/", with a non-empty token on each side that
 * doesn't itself look like a list (no comma/semicolon) or contain another
 * slash. Returns undefined for anything else (no slash, multiple slashes,
 * an empty side, a side that looks like a list) rather than guessing —
 * callers must treat undefined as "not safely parseable as a pair".
 */
export function parseLegacyHybridPair(raw: string | undefined | null): { main: string; cross: string } | undefined {
  if (!raw) return undefined
  const parts = raw.split('/')
  if (parts.length !== 2) return undefined
  const main = parts[0].trim()
  const cross = parts[1].trim()
  if (main.length === 0 || cross.length === 0) return undefined
  if (containsUnambiguousDelimiter(main) || containsUnambiguousDelimiter(cross)) return undefined
  return { main, cross }
}
