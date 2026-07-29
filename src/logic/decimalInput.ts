// Root cause of "10,5 is rejected on mobile" across admin forms: every
// decimal-accepting field validated user text with the JS `Number()`
// constructor, which only ever accepts "." as a decimal separator —
// never "," — regardless of the device's locale or keyboard. Comma is
// the default decimal key on many non-US mobile keyboards, so typing a
// perfectly normal value there produced "must be a number".
//
// This is the one place that normalizes a comma to a period before any
// admin numeric field parses its raw text. It does NOT touch HTML
// input validation, zod, or a form library — this codebase has none of
// those; every numeric field is a plain controlled <input type="text">
// parsed by a small function in the relevant *AdminService.ts, and each
// of those functions now routes its `Number(...)` call through here.

/**
 * Trims `raw` and replaces every "," with ".". Malformed input is
 * deliberately NOT repaired any further — "5,,"  becomes "5..", "5.5.5"
 * is left alone — so it still fails the caller's `Number.isFinite()`
 * check exactly as before, rather than being guessed into a valid
 * number. Only the separator character changes; the numeric value
 * itself (precision, magnitude) is never altered.
 */
export function normalizeDecimalInput(raw: string): string {
  return raw.trim().replace(/,/g, '.')
}
