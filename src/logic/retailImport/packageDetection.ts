// Phase 13A — Part 4: pure package-type and package-length detection.
// Operates on the ORIGINAL (un-stripped) product text, since the words it
// looks for ("reel", "set", "hybrid", "m", "metre") are exactly the
// packaging vocabulary normalization.ts's significantTokens() deliberately
// removes before product-identity comparison. Never invents a length that
// isn't actually present in the text.

import type { DetectedPackageType, PackageDetectionResult } from './types.js'

const HYBRID_PATTERN = /\bhybrid\b/i
const REEL_PATTERN = /\b(reel|roll|spool)\b/i
const SET_PATTERN = /\bset\b/i
const OTHER_PACKAGE_PATTERN = /\b(pack|box|bundle|combo)\b/i

/** "2 × 10 m" / "2 x 10m" style: a quantity multiplied by a per-unit length, in either multiplication-sign form. Checked before the plain single-length pattern, since a plain match would otherwise only pick up the "10 m" half and silently drop the "2 ×". */
const MULTI_LENGTH_PATTERN = /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:m\b|metre|meter)/i
const SINGLE_LENGTH_PATTERN = /(\d+(?:\.\d+)?)\s*(?:m\b|metre|meter)/i

function detectPackageType(lower: string): { packageType: DetectedPackageType; confidence: number; evidence: string[] } {
  if (HYBRID_PATTERN.test(lower)) {
    return { packageType: 'hybrid', confidence: 0.9, evidence: ['Found the word "hybrid"'] }
  }
  if (REEL_PATTERN.test(lower)) {
    const word = REEL_PATTERN.exec(lower)?.[1] ?? 'reel'
    return { packageType: 'reel', confidence: 0.85, evidence: [`Found the reel-style word "${word}"`] }
  }
  if (SET_PATTERN.test(lower)) {
    return { packageType: 'set', confidence: 0.85, evidence: ['Found the word "set"'] }
  }
  if (OTHER_PACKAGE_PATTERN.test(lower)) {
    const word = OTHER_PACKAGE_PATTERN.exec(lower)?.[1] ?? 'pack'
    return { packageType: 'other', confidence: 0.5, evidence: [`Found a generic packaging word ("${word}") that doesn't map to set/reel/hybrid`] }
  }
  return { packageType: 'unknown', confidence: 0, evidence: [] }
}

function detectPackageLength(lower: string): { packageLengthM: number | null; confidence: number; evidence: string[]; warning: string | null } {
  const multiMatch = MULTI_LENGTH_PATTERN.exec(lower)
  if (multiMatch) {
    const qty = Number(multiMatch[1])
    const each = Number(multiMatch[2])
    if (Number.isFinite(qty) && Number.isFinite(each) && qty > 0 && each > 0) {
      const total = Math.round(qty * each * 100) / 100
      return {
        packageLengthM: total,
        confidence: 0.7,
        evidence: [`Found "${multiMatch[0].trim()}" — read as ${qty} × ${each}m = ${total}m`],
        warning: 'Length was derived from a quantity × per-unit-length pattern — worth a human check.',
      }
    }
  }

  const singleMatch = SINGLE_LENGTH_PATTERN.exec(lower)
  if (singleMatch) {
    const num = Number(singleMatch[1])
    if (Number.isFinite(num) && num > 0) {
      return {
        packageLengthM: num,
        confidence: 0.95,
        evidence: [`Found "${singleMatch[0].trim()}" as the package length`],
        warning: null,
      }
    }
  }

  return { packageLengthM: null, confidence: 0, evidence: [], warning: null }
}

/**
 * Detects, where possible, a package type (set/reel/hybrid/other/unknown)
 * and a package length in metres from free text (a retailer title, or a
 * dedicated "package" field if an adapter exposes one). Returns a
 * confidence and the specific evidence that produced each part, plus
 * warnings — it never guesses a length when none was found, and
 * `packageLengthM: null` combined with `packageType: 'unknown'` is a
 * legitimate, common, non-error outcome for a title that just doesn't say.
 */
export function detectPackage(text: string): PackageDetectionResult {
  const lower = text.toLowerCase()
  const typeResult = detectPackageType(lower)
  const lengthResult = detectPackageLength(lower)

  const evidence = [...typeResult.evidence, ...lengthResult.evidence]
  const warnings: string[] = []
  if (typeResult.packageType === 'unknown') warnings.push('No package-type word (set/reel/hybrid/pack/box) was found in the text.')
  if (lengthResult.packageLengthM == null) warnings.push('No package length was found in the text — one was not invented.')
  if (lengthResult.warning) warnings.push(lengthResult.warning)

  const confidence = typeResult.confidence === 0 && lengthResult.confidence === 0 ? 0 : Math.max(typeResult.confidence, lengthResult.confidence) * (typeResult.confidence > 0 && lengthResult.confidence > 0 ? 1 : 0.6)

  return {
    packageType: typeResult.packageType,
    packageLengthM: lengthResult.packageLengthM,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    evidence,
    warnings,
  }
}
