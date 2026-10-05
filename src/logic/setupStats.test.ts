import { describe, it, expect } from 'vitest'
import { strings } from '../data/strings'
import { STRING_SPECIALIST_PROFILES as P } from '../data/stringSpecialistProfiles'
import { SEGMENTS, SHELVES, setupStats, shelfOf, type RacketBalance } from './setupStats'

const byId = (id: string) => strings.find((s) => s.id === id)!
const base = (id: string, tensionKg = 11, balance: RacketBalance = 'standard') => setupStats({ string: byId(id), profile: P[id], tensionKg, balance, pool: strings, source: 'handsOn' })

describe('string shelves', () => {
  it('every string sits on exactly one shelf, and every shelf has strings', () => {
    const shelves = strings.map((s) => shelfOf(s, P[s.id]))
    for (const sh of SHELVES) expect(shelves.filter((x) => x === sh.id).length).toBeGreaterThan(0)
  })
  it('the classic picks land where players expect them', () => {
    expect(shelfOf(byId('yonex-bg65'), P['yonex-bg65'])).toBe('startHere')
    expect(shelfOf(byId('yonex-bg80'), P['yonex-bg80'])).toBe('control')
    expect(shelfOf(byId('yonex-aerosonic'), P['yonex-aerosonic'])).toBe('power')
  })
})

describe('data source', () => {
  it('packet data is the default; hands-on ratings only count when switched on', () => {
    const maker = setupStats({ string: byId('yonex-bg80'), profile: P['yonex-bg80'], tensionKg: 11, balance: 'even', pool: strings })
    const hands = setupStats({ string: byId('yonex-bg80'), profile: P['yonex-bg80'], tensionKg: 11, balance: 'even', pool: strings, source: 'handsOn' })
    expect(maker.estimated).toEqual([])
    expect(maker.values).not.toEqual(hands.values)
  })
})

describe('setup stats (rules of thumb)', () => {
  it('higher tension: less forgiveness, more control, less durability', () => {
    const low = base('yonex-bg80', 10), high = base('yonex-bg80', 12)
    expect(high.values.forgiveness).toBeLessThan(low.values.forgiveness)
    expect(high.values.control).toBeGreaterThan(low.values.control)
    expect(high.values.durability).toBeLessThan(low.values.durability)
  })
  it('changing the racket balance always moves power and handling by at least one bar segment', () => {
    for (const s of strings) {
      const even = setupStats({ string: s, profile: P[s.id], tensionKg: 11, balance: 'even', pool: strings })
      const heavy = setupStats({ string: s, profile: P[s.id], tensionKg: 11, balance: 'headHeavy', pool: strings })
      const light = setupStats({ string: s, profile: P[s.id], tensionKg: 11, balance: 'headLight', pool: strings })
      expect(even.segments.handling - heavy.segments.handling, s.id).toBeGreaterThanOrEqual(1)
      expect(light.segments.handling - even.segments.handling, s.id).toBeGreaterThanOrEqual(1)
      if (even.values.power < 0.83) expect(heavy.segments.power - even.segments.power, s.id).toBeGreaterThanOrEqual(1)
    }
  })
  it('head-heavy: more power, slower handling; head-light: the opposite; standard = even', () => {
    const even = base('yonex-bg80', 11, 'even'), heavy = base('yonex-bg80', 11, 'headHeavy'), light = base('yonex-bg80', 11, 'headLight')
    expect(heavy.values.power).toBeGreaterThan(even.values.power)
    expect(heavy.values.handling).toBeLessThan(even.values.handling)
    expect(light.values.handling).toBeGreaterThan(even.values.handling)
    expect(base('yonex-bg80', 11, 'standard').values).toEqual(even.values)
  })
  it('a thicker string is more forgiving than a thin one at the same tension', () => {
    expect(base('yonex-bg65').values.forgiveness).toBeGreaterThan(base('yonex-aerosonic').values.forgiveness)
  })
  it('flags properties estimated from packet data, and bars stay within 0–6 segments', () => {
    expect(base('yonex-aerosonic').estimated.length).toBeGreaterThan(0)
    expect(base('yonex-bg80').estimated).toEqual([])
    for (const s of strings) for (const v of Object.values(base(s.id, 9, 'headHeavy').segments)) expect(v >= 0 && v <= SEGMENTS).toBe(true)
  })
})
