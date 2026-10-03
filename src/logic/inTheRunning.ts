// Which strings are still "in the running" while the player answers the quiz — the data behind
// the live feel map, where strings fall off the court as answers narrow things down.
//
// The recommendation is a RANKING, not a filter, so "falling off" needs an honest definition:
// a string is in the running while it's within RUNNING_GAP match points of the current best.
// The best few always stay (MIN_IN_RUNNING), nothing is decided before the first answer, and
// changing an answer brings strings back — it's recomputed from scratch every time.

import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { recommendStrings } from './recommendationEngine'
import type { QuizAnswers } from './types'

export const RUNNING_GAP = 12
export const MIN_IN_RUNNING = 3

/** Answers that change which string wins (tension details don't). */
const SCORING_KEYS = ['level', 'playStyles', 'powerGeneration', 'priorities', 'hittingFeel', 'frequency', 'restringReason'] as const

export function hasScoringAnswer(answers: QuizAnswers): boolean {
  return SCORING_KEYS.some((k) => {
    const v = (answers as Record<string, unknown>)[k]
    return Array.isArray(v) ? v.length > 0 : v != null
  })
}

export interface RunningState {
  /** Ids still in the running. */
  inIds: Set<string>
  /** The current leader, or null before the first answer. */
  leaderId: string | null
  total: number
}

export function inTheRunning(answers: QuizAnswers, pool?: StringItem[], specialistProfiles?: Record<string, StringSpecialistProfile>): RunningState {
  const rec = recommendStrings(answers, pool, specialistProfiles)
  const total = rec.ranked.length
  if (!hasScoringAnswer(answers)) return { inIds: new Set(rec.ranked.map((s) => s.string.id)), leaderId: null, total }
  const best = rec.ranked[0].matchPercent
  const inIds = new Set(rec.ranked.filter((s, i) => i < MIN_IN_RUNNING || s.matchPercent >= best - RUNNING_GAP).map((s) => s.string.id))
  return { inIds, leaderId: rec.ranked[0].string.id, total }
}
