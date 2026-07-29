// Safe validation for a user-typed CSS color value — used both to detect
// when a raw manufacturer color name IS already valid CSS (e.g. "#ff6600"
// typed directly into a color-name field) and to validate an explicit
// admin override value. Deliberately an allowlist: only hex/rgb(a)/hsl(a)
// syntax or one of the standard CSS named-color keywords ever passes.
// Anything else — url(...), var(...), calc(...), semicolons, braces,
// arbitrary declarations — is rejected outright, regardless of whether it
// would otherwise match the shape checks below (belt-and-suspenders).

const DANGEROUS_PATTERN = /[;{}<>]|url\(|var\(|calc\(|expression\(|\/\*/i

// Anchored, bounded-quantifier patterns only — no catastrophic backtracking risk.
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_RE = /^rgba?\(\s*\d{1,3}%?\s*[, ]\s*\d{1,3}%?\s*[, ]\s*\d{1,3}%?\s*(?:[,/]\s*(?:0|1|0?\.\d+|\d{1,3}%)\s*)?\)$/i
const HSL_RE = /^hsla?\(\s*-?\d{1,3}(?:\.\d+)?(?:deg)?\s*[, ]\s*\d{1,3}(?:\.\d+)?%\s*[, ]\s*\d{1,3}(?:\.\d+)?%\s*(?:[,/]\s*(?:0|1|0?\.\d+|\d{1,3}%)\s*)?\)$/i

/**
 * The standard CSS Level 4 named-color keywords — a fixed, spec-defined
 * set (not a growing manufacturer-name table). Used only to validate that
 * a bare word IS a real CSS color keyword, never to guess one.
 */
export const CSS_NAMED_COLORS: ReadonlySet<string> = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
  'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod',
  'gray', 'grey', 'green', 'greenyellow', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray',
  'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
  'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan',
  'teal', 'thistle', 'tomato', 'turquoise', 'transparent', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow',
  'yellowgreen',
])

/** True if `raw` is hex/rgb(a)/hsl(a) syntax — never a bare keyword (see isCssNamedColorKeyword for that). */
export function isCssSyntaxColor(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '' || DANGEROUS_PATTERN.test(trimmed)) return false
  return HEX_RE.test(trimmed) || RGB_RE.test(trimmed) || HSL_RE.test(trimmed)
}

/** True if `raw`, trimmed and lowercased, is exactly one standard CSS named-color keyword — never a guess. */
export function isCssNamedColorKeyword(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '' || DANGEROUS_PATTERN.test(trimmed)) return false
  const lower = trimmed.toLowerCase()
  return /^[a-z]+$/.test(lower) && CSS_NAMED_COLORS.has(lower)
}

/**
 * Validates `raw` as a safe CSS color value, returning the value to use
 * (hex/rgb/hsl syntax passed through as typed; a keyword lowercased) or
 * undefined if it isn't safely usable. Never allows url()/var()/calc()/
 * declarations/injection — only an actual color value.
 */
export function isSafeCssColor(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (trimmed === '' || DANGEROUS_PATTERN.test(trimmed)) return undefined
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase()
  if (RGB_RE.test(trimmed) || HSL_RE.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (/^[a-z]+$/.test(lower) && CSS_NAMED_COLORS.has(lower)) return lower
  return undefined
}

/**
 * Rough perceived-lightness estimate for a hex color (0 = black, 1 =
 * white) — used only to decide whether an arbitrary hex value (an
 * override, or a direct hex typed as the color name) needs a stronger
 * visibility ring, without hardcoding every possible pale/dark color by
 * name. Returns undefined for anything that isn't parseable 3/6-digit hex
 * (rgb()/hsl()/keywords fall back to the caller's own default).
 */
export function estimateHexLightness(hex: string): number | undefined {
  const trimmed = hex.trim().replace(/^#/, '')
  let r: number, g: number, b: number
  if (trimmed.length === 3) {
    r = parseInt(trimmed[0] + trimmed[0], 16)
    g = parseInt(trimmed[1] + trimmed[1], 16)
    b = parseInt(trimmed[2] + trimmed[2], 16)
  } else if (trimmed.length === 6 || trimmed.length === 8) {
    r = parseInt(trimmed.slice(0, 2), 16)
    g = parseInt(trimmed.slice(2, 4), 16)
    b = parseInt(trimmed.slice(4, 6), 16)
  } else {
    return undefined
  }
  if ([r, g, b].some((c) => Number.isNaN(c))) return undefined
  // Perceived-luminance weighting (ITU-R BT.601), normalized to 0-1.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
