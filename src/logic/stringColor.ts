// Color resolution logic — kept as an ADMIN DATA-CLEANUP helper only.
//
// Phase 9 went through several rounds trying to render physical string
// colors publicly (single swatches, multi-color lists, hybrid split
// circles, an automatic base-color resolver). Real-world testing found
// the result too inconsistent to trust (hybrids sometimes showing a
// solid color instead of a split, some normal colors silently
// disappearing) relative to the value it added, so the public rendering
// was removed. See README's "Public color display deferred" section for
// the full writeup and the plan for a possible future, properly
// normalized color model.
//
// What remains here, and why: logic/colorDiagnostics.ts's admin-only
// `/debug/supabase` diagnostics still use this module to explain what a
// raw color name *would* resolve to, so a stringer can review and
// progressively clean up real Supabase color data (aliases, unresolved
// names, hybrid pairing) ahead of a future normalized implementation —
// without that requiring any public rendering or a database migration.
// Nothing in src/components/ (other than admin) reads from this module
// anymore.
//
// The resolver still tries, in order: (1) the raw name is itself valid
// CSS syntax (hex/rgb()/hsl()); (2) the raw name is exactly one standard
// CSS named-color keyword; (3) automatic base-color keyword inference
// (logic/baseColorInference.ts) — e.g. "Fire Orange" -> orange; (4) a
// small alias table for a few cases inference can't handle (a
// misspelling, a spelling variant); (5) unresolved — kept as a raw value
// for the diagnostics page, never guessed.

import type { HybridStringMeta, StringItem } from '../data/strings.js'
import { splitColorList, parseLegacyHybridPair, containsUnambiguousDelimiter } from './colorParsing.js'
import { isCssSyntaxColor, isCssNamedColorKeyword, isSafeCssColor, estimateHexLightness } from './cssColor.js'
import { inferBaseColor, resolveAlias, lookupBaseColor, SUBTLE_RING, STRONG_RING, type BaseColorMatch } from './baseColorInference.js'

export type ColorResolutionSource = 'explicit_css' | 'css_named_color' | 'inferred_keyword' | 'alias' | 'unresolved'

export interface ColorResolution {
  /** The raw, as-entered manufacturer color name — '' if none was given at all. */
  rawName: string
  /** What to show a human (admin diagnostics text) — preserves the original name for inference/explicit hits; shows the corrected spelling for an alias hit. */
  displayName: string
  /** The CSS color value this name would resolve to, or undefined if unresolved. Diagnostics-only — nothing renders this publicly anymore. */
  cssColor: string | undefined
  ringClassName: string
  source: ColorResolutionSource
  confidence: 'high' | 'medium' | 'low'
  /** Normalized key identifying the resolved color (or undefined when unresolved) — used for dedup/diagnostics, not for display. */
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

/** Diagnostics-only color resolver — see this file's header comment for the tier order and why nothing public consumes it anymore. */
export function resolveColor(name: string | undefined | null): ColorResolution {
  const rawName = (name ?? '').trim()
  if (rawName === '') return UNRESOLVED_NO_INPUT

  // Tier 1: the raw name itself is explicit CSS syntax (hex/rgb()/hsl()).
  if (isCssSyntaxColor(rawName)) {
    const value = isSafeCssColor(rawName)!
    return { rawName, displayName: rawName, cssColor: value, ringClassName: computeRing(value), source: 'explicit_css', confidence: 'high', canonicalKey: normalize(rawName) }
  }

  // An exact-whole-name alias hit (e.g. "Grey") is checked here, ahead of
  // the plain named-keyword tier below, rather than after inference —
  // deliberately: "grey" is itself a valid CSS keyword, so if checked in
  // strict tier order it would always resolve as a bare keyword and never
  // reach the alias table meant to canonicalize its spelling. The alias
  // table is small and curated (see baseColorInference.ts's ALIASES), so
  // checking an exact match early never causes an incorrect guess.
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
    }
  }

  // Tier: the raw name is exactly one standard CSS named-color keyword.
  // Prefers this module's own curated value when the keyword is ALSO one
  // of our base colors (e.g. "yellow" typed directly), so it matches the
  // same color found via inference from a longer name (e.g. "Neon
  // Yellow") — otherwise falls back to the literal keyword.
  if (isCssNamedColorKeyword(rawName)) {
    const lower = rawName.toLowerCase()
    const baseMatch = lookupBaseColor(lower)
    const cssColor = baseMatch?.cssColor ?? lower
    return { rawName, displayName: titleCase(rawName), cssColor, ringClassName: computeRing(cssColor, baseMatch), source: 'css_named_color', confidence: 'high', canonicalKey: lower }
  }

  // Tier: automatic base-color keyword inference (tokenized).
  const inferred = inferBaseColor(rawName)
  if (inferred) {
    return { rawName, displayName: titleCase(rawName), cssColor: inferred.cssColor, ringClassName: computeRing(inferred.cssColor, inferred), source: 'inferred_keyword', confidence: 'medium', canonicalKey: inferred.canonicalKey }
  }

  // Unresolved — never guessed.
  return { rawName, displayName: rawName, cssColor: undefined, ringClassName: SUBTLE_RING, source: 'unresolved', confidence: 'low', canonicalKey: undefined }
}

export interface StringColorSwatch {
  /** What a tooltip/admin diagnostics view should say — the original manufacturer name, or the corrected spelling for an alias hit. */
  label: string
  /** CSS color value this name would render as — a keyword, hex, or rgb()/hsl() string. Diagnostics-only; nothing renders this publicly anymore. */
  hex: string
  /** Tailwind ring classes tuned for visibility against both light and dark, computed for admin-diagnostics consistency with the resolver's confidence tiers. */
  ringClassName: string
}

function toSwatch(resolution: ColorResolution): StringColorSwatch | undefined {
  if (!resolution.cssColor) return undefined
  return { label: resolution.displayName, hex: resolution.cssColor, ringClassName: resolution.ringClassName }
}

/** Resolves one color name, or undefined if it isn't resolvable by any tier. Diagnostics-only — see this file's header comment. */
export function resolveStringColor(name: string | undefined | null): StringColorSwatch | undefined {
  if (!name) return undefined
  return toSwatch(resolveColor(name))
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

export interface HybridColorPreview {
  kind: 'hybrid'
  main: StringColorSwatch
  cross: StringColorSwatch
}

export interface SolidColorPreview {
  kind: 'solid'
  /** Every recognized swatch, in order — diagnostics-only, not capped for public display anymore. */
  visible: StringColorSwatch[]
}

export interface NoColorPreview {
  kind: 'none'
}

export type ColorPreview = HybridColorPreview | SolidColorPreview | NoColorPreview

function hybridSideColor(side: HybridStringMeta | undefined): StringColorSwatch | undefined {
  return resolveStringColor(side?.color)
}

/** A stock of `'unavailable'` means the inventory row's color(s) no longer represent something a customer can actually get. */
function isInventoryColorAvailable(item: Pick<StringItem, 'inventoryColor' | 'stock'>): boolean {
  return Boolean(item.inventoryColor) && item.stock !== 'unavailable'
}

/** Recognized swatches from the inventory's single free-text `color` field, in entry order — split on commas/semicolons only (see logic/colorParsing.ts). Empty when the row is out of stock. Diagnostics-only. */
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
 * Determines where a hybrid string's color(s) would come from, in
 * priority order — used by colorDiagnostics.ts (which needs to know
 * *which* path was used, not just the resulting swatches) to help an
 * admin understand and clean up real data. Diagnostics-only.
 *
 *   1. Structured `mainString.color`/`crossString.color` metadata from
 *      the catalog admin's dedicated hybrid fields — 'structured-both'
 *      when both resolve, 'structured-partial' when only one does.
 *   2. If NEITHER structured side resolves, the inventory row's single
 *      legacy text value: a genuine "Main/Cross" pair (exactly one
 *      slash, two clean tokens) becomes 'legacy-pair'; a single plain
 *      value with no delimiter becomes 'legacy-solid'. A comma/
 *      semicolon-separated value ("White, Red") is never treated as a
 *      hybrid pair — that's an ordinary two-color list.
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
 * Diagnostics-only preview of what a string's color(s) would resolve to
 * — used by logic/colorDiagnostics.ts, not by any public component
 * anymore. See hybridColorSource() for the hybrid priority order.
 * Non-hybrid strings: the inventory row's color(s) come first (only
 * when in stock), followed by any remaining catalog `colors`,
 * deduplicated and sorted alphabetically by label.
 */
export function buildColorPreview(item: Pick<StringItem, 'isHybrid' | 'mainString' | 'crossString' | 'inventoryColor' | 'colors' | 'stock'>): ColorPreview {
  if (item.isHybrid) {
    const source = hybridColorSource(item)
    switch (source.kind) {
      case 'structured-both':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'structured-partial':
        return { kind: 'solid', visible: [source.known] }
      case 'legacy-pair':
        return { kind: 'hybrid', main: source.main, cross: source.cross }
      case 'legacy-solid':
        return { kind: 'solid', visible: [source.known] }
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
  return { kind: 'solid', visible: swatches }
}
