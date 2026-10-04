import type { QuizAnswers } from '../../src/logic/types.js'

// Shared helpers for the analysis scripts. Every script enumerates the SAME answer space so
// results are comparable, and uses a fixed seed so every run gives identical numbers.

export const LEVELS = ['beginner', 'intermediate', 'advanced', 'tournament']
export const STYLES = ['aggressive', 'fastDoubles', 'control', 'defensive', 'balanced']
export const PRIORITIES = ['easyPower', 'hardAttack', 'fastDrives', 'directPrecision', 'shuttleGrip', 'netTechnical', 'durability', 'comfort', 'tensionRetention', 'sound']
export const FEELS = ['hardCrisp', 'mediumBalanced', 'softComfortable', 'dontKnow']

function combos<T>(a: T[], k: number): T[][] {
  return k === 0 ? [[]] : a.flatMap((x, i) => combos(a.slice(i + 1), k - 1).map((c) => [x, ...c]))
}
export function upTo<T>(a: T[], max: number): T[][] {
  let out: T[][] = []
  for (let k = 1; k <= max; k++) out = out.concat(combos(a, k))
  return out
}

/** Every quick-quiz answer set: 4 levels × 15 style sets × 55 priority sets × 4 feels = 13,200. */
export function quickAnswerSpace(): QuizAnswers[] {
  const out: QuizAnswers[] = []
  for (const level of LEVELS)
    for (const playStyles of upTo(STYLES, 2))
      for (const priorities of upTo(PRIORITIES, 2))
        for (const hittingFeel of FEELS) out.push({ level, playStyles, priorities, hittingFeel })
  return out
}

/** Deterministic PRNG (32-bit LCG) — fixed seed = reproducible runs. */
export function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s / 4294967296
  }
}

export const pct = (x: number, n: number) => `${((x / n) * 100).toFixed(1)}%`
