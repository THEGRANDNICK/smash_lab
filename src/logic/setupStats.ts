// The Setup Workshop (Mario Kart-style builder): pick a racket balance, a string and a tension, and
// six bars show what the combination does. Rules of thumb, not measurements:
// - string values come from hands-on ratings first; where a property isn't rated, it's estimated
//   from the packet rating RELATIVE to the catalogue (packet ratings are inflated) and flagged;
// - tension follows the video's guidance (lower = bigger sweet spot, easier power, longer life;
//   higher = more control with clean contact);
// - balance effects are generic: head-heavy = more power, slower handling; head-light = the opposite.

import type { StringItem } from '../data/strings'
import type { SpecialistDimensionKey, StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { computeStringMapPosition } from './stringMapPosition'

export type RacketBalance = 'standard' | 'headHeavy' | 'even' | 'headLight'
export type StatKey = 'power' | 'control' | 'forgiveness' | 'handling' | 'durability' | 'comfort'
export type ShelfId = 'startHere' | 'control' | 'power' | 'allRound'

export const STAT_ORDER: { key: StatKey; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'control', label: 'Control' },
  { key: 'forgiveness', label: 'Forgiveness' },
  { key: 'handling', label: 'Handling' },
  { key: 'durability', label: 'Durability' },
  { key: 'comfort', label: 'Comfort' },
]
export const SEGMENTS = 6

export const SHELVES: { id: ShelfId; label: string; blurb: string }[] = [
  { id: 'startHere', label: 'Start here', blurb: 'Thick or extra durable, forgiving — the safe first pick' },
  { id: 'control', label: 'Crisp control', blurb: 'Hard, direct feel for placement' },
  { id: 'power', label: 'Easy power', blurb: 'Lively strings that launch the shuttle' },
  { id: 'allRound', label: 'All-round', blurb: 'A bit of everything' },
]

/** String colour by shelf: you can see at a glance what kind of string is on the racket. */
export const SHELF_COLOR: Record<ShelfId, string> = {
  startHere: '#2f9a46',
  control: '#2f63c9',
  power: '#ef7410',
  allRound: '#b8457f',
}

export function stringGauge(s: StringItem): number | undefined {
  if (s.isHybrid) {
    const g = [s.mainString?.gauge, s.crossString?.gauge].filter((x): x is number => typeof x === 'number')
    return g.length ? Math.min(...g) : undefined
  }
  return s.tension?.gauge
}

/**
 * Which shelf a string sits on, from the data (not the packet's own category, which put BG80 under
 * "repulsion"): thick (≥0.69 mm) or very durable (packet durability ≥10) → Start here; hard on the
 * feel map (≥0.7) → Crisp control; very lively (≥0.85) → Easy power; everything else → All-round.
 */
export function shelfOf(s: StringItem, profile: StringSpecialistProfile | undefined): ShelfId {
  const g = stringGauge(s)
  if ((g != null && g >= 0.69) || s.durability >= 10) return 'startHere'
  const pos = computeStringMapPosition(s, profile, true)
  if (pos.softHard >= 0.7) return 'control'
  if (pos.holdRepulsion >= 0.85) return 'power'
  return 'allRound'
}

export interface SetupInput {
  string: StringItem
  profile?: StringSpecialistProfile
  tensionKg: number
  balance: RacketBalance
  /** The catalogue, for relative estimates of unrated properties. */
  pool: StringItem[]
  /**
   * 'maker' (the workshop's default): packet data only, mapped relative to the catalogue.
   * 'handsOn': Smash Lab's hands-on ratings where they exist, packet data for the rest (flagged).
   */
  source?: 'maker' | 'handsOn'
}

export interface SetupStats {
  values: Record<StatKey, number>
  segments: Record<StatKey, number>
  /** Stats whose string part is estimated from packet data (no hands-on rating). */
  estimated: StatKey[]
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

type MakerKey = 'repulsion' | 'control' | 'durability' | 'shockAbsorption'
function relativeEstimate(item: StringItem, key: MakerKey, pool: StringItem[]): number | undefined {
  const v = item[key]
  if (typeof v !== 'number') return undefined
  const vals = pool.map((p) => p[key]).filter((x): x is number => typeof x === 'number')
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const range = Math.max(1, Math.max(...vals) - Math.min(...vals))
  return Math.max(1, Math.min(5, 3 + ((v - mean) / range) * 2))
}

/** A string property on 0–1: hands-on rating if there is one, else a flagged relative estimate. */
function stringValue(input: SetupInput, dim: SpecialistDimensionKey, maker: MakerKey): { v: number; estimated: boolean } {
  const handsOnMode = input.source === 'handsOn'
  const hands = handsOnMode ? input.profile?.dimensions[dim] : undefined
  if (typeof hands === 'number') return { v: hands / 5, estimated: false }
  const est = relativeEstimate(input.string, maker, input.pool)
  // In packet-data mode nothing is "estimated" — packet data is the chosen source.
  return { v: (est ?? 3) / 5, estimated: handsOnMode }
}

const BALANCE: Record<RacketBalance, Partial<Record<StatKey, number>>> = {
  standard: {},
  even: {},
  // about one bar segment each way, so a change of racket is always visible (rules of thumb)
  headHeavy: { power: 0.17, handling: -0.2, control: -0.05 },
  headLight: { power: -0.17, handling: 0.2, control: 0.05 },
}

export function setupStats(input: SetupInput): SetupStats {
  const power = stringValue(input, 'easyPower', 'repulsion')
  const control = stringValue(input, 'controlPrecision', 'control')
  const durability = stringValue(input, 'normalWearDurability', 'durability')
  const comfort = stringValue(input, 'comfort', 'shockAbsorption')
  const g = stringGauge(input.string) ?? 0.66
  // tension position: 9 kg → 0, 13 kg → 1
  const t = clamp01((input.tensionKg - 9) / 4)
  const mid = 0.5 - t // > 0 below ~11 kg, < 0 above

  const values: Record<StatKey, number> = {
    power: power.v + mid * 0.15,
    control: control.v - mid * 0.25,
    forgiveness: 0.5 + (g - 0.65) * 2 + mid * 0.5,
    handling: 0.5,
    durability: durability.v + mid * 0.25,
    comfort: comfort.v + mid * 0.2,
  }
  for (const [k, d] of Object.entries(BALANCE[input.balance]) as [StatKey, number][]) values[k] += d
  for (const k of Object.keys(values) as StatKey[]) values[k] = clamp01(values[k])

  const segments = Object.fromEntries((Object.keys(values) as StatKey[]).map((k) => [k, Math.round(values[k] * SEGMENTS)])) as Record<StatKey, number>
  const estimated = (
    [
      ['power', power],
      ['control', control],
      ['durability', durability],
      ['comfort', comfort],
    ] as [StatKey, { estimated: boolean }][]
  )
    .filter(([, x]) => x.estimated)
    .map(([k]) => k)
  return { values, segments, estimated }
}
