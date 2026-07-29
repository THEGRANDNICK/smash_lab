// Layered, mostly-automatic color resolution (rewritten this round after
// real-world testing showed the previous fixed name-to-hex table
// couldn't keep up with new manufacturer color names). See
// logic/cssColor.ts (safe CSS validation) and logic/baseColorInference.ts
// (the small, fixed base-color vocabulary + tokenized inference) for the
// two building blocks this module composes into resolveColor()'s
// resolution order:
//
//   1. explicit_css        — the raw name IS itself valid CSS syntax
//                             (hex/rgb()/hsl()), e.g. "#ff6600".
//   2. explicit_override    — a separately stored, validated CSS value
//                             (only available for hybrid main/cross
//                             sides right now — see HybridStringMeta's
//                             colorOverride).
//   3. css_named_color      — the raw name IS exactly one standard CSS
//                             keyword, e.g. "orange".
//   4. inferred_keyword     — tokenizes a longer name for a recognizable
//                             base-color word/phrase, e.g. "Fire Orange"
//                             -> orange, "Cosmic Gold" -> gold. This is
//                             what lets a brand-new manufacturer name
//                             work automatically, with no code change,
//                             whenever its base color is recognizable.
//   5. alias                — a small, explicitly documented table for
//                             the few cases inference can't handle (a
//                             misspelling, a spelling variant) — see
//                             baseColorInference.ts's ALIASES for the
//                             full list and why each entry exists.
//   6. unresolved           — no automatic match. Never guessed: the
//                             raw name is kept for admin diagnostics,
//                             and the public site renders no swatch.
//
// Display ordering (the "priority" for MULTIPLE colors on one string):
// the inventory color(s) — split safely on commas/semicolons
// (logic/colorParsing.ts) and only counted when the string is NOT
// `unavailable` — come first, followed by any remaining catalog `colors`
// not already shown, deduplicated by resolved color and sorted
// alphabetically by label. See hybridColorSource() for the separate
// hybrid main/cross priority chain.

import type { HybridStringMeta, StringItem } from '../data/strings.js'
import { splitColorList, parseLegacyHybridPair, containsUnambiguousDelimiter } from './colorParsing.js'
import { isCssSyntaxColor, isCssNamedColorKeyword, isSafeCssColor, estimateHexLightness } from './cssColor.js'
import { inferBaseColor, resolveAlias, lookupBaseColor, SUBTLE_RING, STRONG_RING, type BaseColorMatch } from './baseColorInference.js'

export type ColorResolutionSource = 'explicit_css' | 'explicit_override' | 'css_named_color' | 'inferred_keyword' | 'alias' | 'unresolved'

export interface ColorResolution {
  /** The raw, as-entered manufacturer color name — '' if none was given at all. */
  rawName: string
  /** What to show a human (tooltip/admin text) — preserves the original name for inference/override/explicit hits; shows the corrected spelling for an alias hit. */
  displayName: string
  /** The CSS color value to actually render, or undefined if unresolved. */
  cssColor: string | undefined
  ringClassName: string
  source: ColorResolutionSource
  confidence: 'high' | 'medium' | 'low'
  /** Set when something about the input couldn't be used as given (e.g. an override value that isn't a safe CSS color) — informational, never blocks resolution of the rest. */
  warning?: string
  /** Normalized key identifying the resolved color (or the raw name's normalized form when unresolved) — used for dedup/diagnostics, not for display. */
  canonicalKey: string | undefined
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function computeRing(cssColor: string, baseMatch?: BaseColorMatch): string {
  if (baseMatch) return baseMatch.ringClassName
  if (cssColor.startsWith('#')) {
    const lightness = estimateHexLightness(cssColor)
    if (lightness != null && (lightness > 0.85 || lightness < 0.15)) return STRONG_RING
  }
  return SUBTLE_RING
}

const UNRESOLVED_NO_INPUT: ColorResolution = { rawName: '', displayName: '', cssColor: undefined, ringClassName: SUBTLE_RING, source: 'unresolved', confidence: 'low', canonicalKey: undefined }

/**
 * The layered color resolver — see this file's header comment for the
 * full six-tier order. `override`, when given, is only ever consulted
 * for hybrid main/cross sides right now (see HybridStringMeta's
 * colorOverride) — plain catalog/inventory color names have no separate
 * override field without a database migration (see README's "Manual
 * color override" section for why).
 */
export function resolveColor(name: string | undefined | null, override?: string | undefined | null): ColorResolution {
  const rawName = (name ?? '').trim()
  const overrideTrimmed = (override ?? '').trim()
  const overrideProvided = overrideTrimmed !== ''
  const safeOverride = overrideProvided ? isSafeCssColor(overrideTrimmed) : undefined
  const overrideInvalid = overrideProvided && !safeOverride
  const overrideWarning = overrideInvalid ? 'The color override value is not a safe CSS color and was ignored.' : undefined

  if (rawName === '' && !safeOverride) {
    return overrideInvalid ? { ...UNRESOLVED_NO_INPUT, warning: overrideWarning } : UNRESOLVED_NO_INPUT
  }

  // Tier 1: the raw name itself is explicit CSS syntax (hex/rgb()/hsl()).
  if (rawName !== '' && isCssSyntaxColor(rawName)) {
    const value = isSafeCssColor(rawName)!
    return { rawName, displayName: rawName, cssColor: value, ringClassName: computeRing(value), source: 'explicit_css', confidence: 'high', canonicalKey: normalize(rawName), warning: overrideWarning }
  }

  // Tier 2: an explicit, validated override.
  if (safeOverride) {
    const displayName = rawName !== '' ? titleCase(rawName) : overrideTrimmed
    return { rawName: rawName || overrideTrimmed, displayName, cssColor: safeOverride, ringClassName: computeRing(safeOverride), source: 'explicit_override', confidence: 'high', canonicalKey: normalize(displayName) }
  }

  if (rawName === '') {
    return { ...UNRESOLVED_NO_INPUT, warning: overrideWarning }
  }

  // An exact-whole-name alias hit (e.g. "Grey") is checked here, ahead of
  // the plain named-keyword tier below, rather than after inference as
  // the general order lists — deliberately: "grey" is itself a valid CSS
  // keyword, so if checked in strict listed order it would always resolve
  // as a bare keyword and never reach the alias table meant to
  // canonicalize its spelling. The alias table is small and curated (see
  // baseColorInference.ts's ALIASES), so checking an exact match early
  // never causes an incorrect guess — it only ever fires for the exact
  // handful of documented words.
  const earlyAliasMatch = resolveAlias(rawName)
  if (earlyAliasMatch) {
    return {
      rawName,
      displayName: titleCase(earlyAliasMatch.canonicalKey),
      cssColor: earlyAliasMatch.cssColor,
      ringClassName: computeRing(earlyAliasMatch.cssColor, earlyAliasMatch),
      source: 'alias',
      confidence: 'medium',
      canonicalKey: earlyAliasMatch.canonicalKey,
      warning: overrideWarning,
    }
  }

  // Tier 3: the raw name is exactly one standard CSS named-color keyword.
  // Prefers this module's own curated value when the keyword is ALSO one
  // of our base colors (e.g. "yellow" typed directly), so it renders
  // identically to the same color found via inference from a longer name
  // (e.g. "Neon Yellow") — otherwise falls back to the literal keyword.
  if (isCssNamedColorKeyword(rawName)) {
    const lower = rawName.toLowerCase()
    const baseMatch = lookupBaseColor(lower)
    const cssColor = baseMatch?.cssColor ?? lower
    return { rawName, displayName: titleCase(rawName), cssColor, ringClassName: computeRing(cssColor, baseMatch), source: 'css_named_color', confidence: 'high', canonicalKey: lower, warning: overrideWarning }
  }

  // Tier 4: automatic base-color keyword inference (tokenized). (Tier 5,
  // the alias table, was already checked above — see the comment there
  // for why it has to run before tier 3, not after tier 4 as listed.)
  const inferred = inferBaseColor(rawName)
  if (inferred) {
    return { rawName, displayName: titleCase(rawName), cssColor: inferred.cssColor, ringClassName: computeRing(inferred.cssColor, inferred), source: 'inferred_keyword', confidence: 'medium', canonicalKey: inferred.canonicalKey, warning: overrideWarning }
  }

  // Tier 6: unresolved — never guessed.
  return {
    rawName,
    displayName: rawName,
    cssColor: undefined,
    ringClassName: SUBTLE_RING,
    source: 'unresolved',
    confidence: 'low',
    canonicalKey: undefined,
    warning: overrideInvalid ? 'No automatic color found, and the override value is not a safe CSS color.' : 'No automatic color found.',
  }
}

export interface StringColorSwatch {
  /** What a tooltip/aria-label should say — the original manufacturer name, or the corrected spelling for an alias hit. */
  label: string
  /** CSS color value for the swatch fill — a keyword, hex, or rgb()/hsl() string; any of these work directly as a `backgroundColor` style value. */
  hex: string
  /** Tailwind ring classes tuned for visibility against both light and dark. */
  ringClassName: string
}

function toSwatch(resolution: ColorResolution): StringColorSwatch | undefined {
  if (!resolution.cssColor) return undefined
  return { label: resolution.displayName, hex: resolution.cssColor, ringClassName: resolution.ringClassName }
}

/**
 * Resolves one color name (optionally with an override) to a swatch, or
 * undefined if it isn't resolvable by any tier — callers must render no
 * swatch in that case rather than a misleading neutral placeholder.
 */
export function resolveStringColor(name: string | undefined | null, override?: string | undefined | null): StringColorSwatch | undefined {
  if (!name && !override) return undefined
  return toSwatch(resolveColor(name, override))
}

/** For admin diagnostics: if `name` resolved via the small exceptional alias table (not automatic inference), returns the raw text and the canonical label it resolves to; undefined otherwise. */
export function describeColorAlias(name: string | undefined | null): { raw: string; canonical: string } | undefined {
  if (!name) return undefined
  const resolution = resolveColor(name)
  if (resolution.source !== 'alias') return undefined
  return { raw: name, canonical: resolution.displayName }
}

/** Recognized swatches from a name list, in order, deduplicated by resolved color. Unrecognized names are silently skipped, never guessed. */
function resolveAllColors(names: readonly string[]): StringColorSwatch[] {
  const seen = new Set<string>()
  const result: StringColorSwatch[] = []
  for (const name of names) {
    const swatch = resolveStringColor(name)
    if (!swatch || seen.has(swatch.hex)) continue
    seen.add(swatch.hex)
    result.push(swatch)
  }
  return result
}

/** @deprecated Superseded by buildColorPreview()'s inventory→catalog priority and hybrid handling — kept only as a thin wrapper for callers/tests still using the single-swatch Phase 8 API. */
export function primaryStringColor(colors: readonly string[] | undefined): StringColorSwatch | undefined {
  if (!colors) return undefined
  return resolveAllColors(colors)[0]
}

/** @deprecated Superseded by buildColorPreview() — kept only as a thin wrapper for callers/tests still using the Phase 8 API. */
export function allStringColors(colors: readonly string[] | undefined, max = 3): StringColorSwatch[] {
  if (!colors) return []
  return resolveAllColors(colors).slice(0, max)
}

export interface HybridColorPreview {
  kind: 'hybrid'
  main: StringColorSwatch
  cross: StringColorSwatch
}

export interface SolidColorPreview {
  kind: 'solid'
  /** Swatches to render immediately, up to the caller's `maxVisible`. */
  visible: StringColorSwatch[]
  /** Remaining recognized swatches beyond `maxVisible`, shown after a "+N" control is activated. */
  overflow: StringColorSwatch[]
}

export interface NoColorPreview {
  kind: 'none'
}

export type ColorPreview = HybridColorPreview | SolidColorPreview | NoColorPreview

/** A structured hybrid side's color, honoring its own explicit override (see HybridStringMeta.colorOverride) ahead of automatic resolution of its name — this is where tiers 2-and-3-combined of the class header comment's order actually apply for hybrids. */
function hybridSideColor(side: HybridStringMeta | undefined): StringColorSwatch | undefined {
  if (!side) return undefined
  return resolveStringColor(side.color, side.colorOverride)
}

/** A stock of `'unavailable'` means the inventory row's color(s) no longer represent something a customer can actually get — see buildColorPreview's doc comment. */
function isInventoryColorAvailable(item: Pick<StringItem, 'inventoryColor' | 'stock'>): boolean {
  return Boolean(item.inventoryColor) && item.stock !== 'unavailable'
}

/**
 * Recognized swatches from the inventory's single free-text `color`
 * field, in entry order — split on commas/semicolons only (see
 * logic/colorParsing.ts), so "White, Red" yields two swatches while a
 * bare slash is left untouched here (that's only ever a hybrid
 * main/cross signal, handled separately in hybridColorSource). Empty
 * when the row is out of stock (see isInventoryColorAvailable).
 */
function resolveInventoryColors(item: Pick<StringItem, 'inventoryColor' | 'stock'>): StringColorSwatch[] {
  if (!isInventoryColorAvailable(item)) return []
  return resolveAllColors(splitColorList(item.inventoryColor))
}

export type HybridColorSource =
  | { kind: 'structured-both'; main: StringColorSwatch; cross: StringColorSwatch }
  | { kind: 'structured-partial'; known: StringColorSwatch; missingSide: 'main' | 'cross' }
  | { kind: 'legacy-pair'; main: StringColorSwatch; cross: StringColorSwatch }
  | { kind: 'legacy-solid'; known: StringColorSwatch }
  | { kind: 'none' }

/**
 * Determines where a hybrid string's color(s) come from, in priority
 * order — used by buildColorPreview and by colorDiagnostics.ts (which
 * needs to know *which* path was used, not just the resulting swatches):
 *
 *   1. Structured `mainString.color`/`crossString.color` metadata from
 *      the catalog admin's dedicated hybrid fields — each side honors
 *      its own explicit override first (HybridStringMeta.colorOverride)
 *      before falling back to automatic resolution of its color name.
 *      'structured-both' when both sides resolve; 'structured-partial'
 *      when only one does (never inventing the other side).
 *   2. If NEITHER structured catalog side resolves, fall back to the
 *      inventory row's single legacy text value: a genuine "Main/Cross"
 *      pair (exactly one slash, two clean tokens — logic/colorParsing.ts's
 *      parseLegacyHybridPair) becomes 'legacy-pair'; a single plain color
 *      name with no delimiter at all becomes 'legacy-solid' (we don't
 *      know which side it names, so it renders as one ordinary swatch,
 *      same as a structured-partial result). A comma/semicolon-separated
 *      value ("White, Red") is deliberately NOT treated as a hybrid pair
 *      here — that's an ordinary two-color list, which a hybrid never
 *      reads from its own top-level `colors`/inventory list anyway.
 *   3. 'none' otherwise.
 */
export function hybridColorSource(item: Pick<StringItem, 'mainString' | 'crossString' | 'inventoryColor' | 'stock'>): HybridColorSource {
  const structuredMain = hybridSideColor(item.mainString)
  const structuredCross = hybridSideColor(item.crossString)
  if (structuredMain && structuredCross) return { kind: 'structured-both', main: structuredMain, cross: structuredCross }
  if (structuredMain) return { kind: 'structured-partial', known: structuredMain, missingSide: 'cross' }
  if (structuredCross) return { kind: 'structured-partial', known: structuredCross, missingSide: 'main' }

  const legacySource = isInventoryColorAvailable(item) ? item.inventoryColor : undefined
  if (legacySource) {
    const pair = parseLegacyHybridPair(legacySource)
    if (pair) {
      const legacyMain = resolveStringColor(pair.main)
      const legacyCross = resolveStringColor(pair.cross)
      if (legacyMain && legacyCross) return { kind: 'legacy-pair', main: legacyMain, cross: legacyCross }
    } else if (!containsUnambiguousDelimiter(legacySource)) {
      const solid = resolveStringColor(legacySource)
      if (solid) return { kind: 'legacy-solid', known: solid }
    }
  }
  return { kind: 'none' }
}

/**
 * The single entry point every color-swatch-rendering component should
 * use. See hybridColorSource() for the hybrid priority order. Non-hybrid
 * strings: the inventory row's color(s) — split safely on
 * commas/semicolons, in entry order — are shown first, but ONLY when
 * that stock isn't `unavailable` (see logic/colorDiagnostics.ts for
 * surfacing hidden colors on the debug page instead of hiding them
 * entirely). Any catalog `colors` not already covered by an inventory
 * color are appended after, deduplicated case-insensitively and sorted
 * alphabetically by label. Never fabricates a color for a name this
 * module doesn't recognize.
 */
export function buildColorPreview(item: Pick<StringItem, 'isHybrid' | 'mainString' | 'crossString' | 'inventoryColor' | 'colors' | 'stock'>, maxVisible = 3): ColorPreview {
  if (item.isHybrid) {
    const source = hybridColorSource(item)
    switch (source.kind) {
      case 'structured-both':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'structured-partial':
        return { kind: 'solid', visible: [source.known], overflow: [] }
      case 'legacy-pair':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'legacy-solid':
        return { kind: 'solid', visible: [source.known], overflow: [] }
      case 'none':
        return { kind: 'none' }
    }
  }

  const inventorySwatches = resolveInventoryColors(item)
  const inventoryHexes = new Set(inventorySwatches.map((s) => s.hex))

  const catalogSwatches = resolveAllColors(item.colors ?? [])
    .filter((s) => !inventoryHexes.has(s.hex))
    .sort((a, b) => a.label.localeCompare(b.label))

  const swatches = [...inventorySwatches, ...catalogSwatches]
  if (swatches.length === 0) return { kind: 'none' }
  return { kind: 'solid', visible: swatches.slice(0, maxVisible), overflow: swatches.slice(maxVisible) }
}
