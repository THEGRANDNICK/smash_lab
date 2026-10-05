// Keeps an in-progress quiz alive across the browser's back/forward buttons
// and page reloads.
//
// - Every question step is its own browser-history entry (pushState on the
//   same "#finder" URL), so Back / the Android back gesture goes to the
//   previous QUESTION instead of throwing the player out of the quiz.
// - Answers live in sessionStorage (this tab only, gone when it closes), so a
//   reload or a Back-then-Forward restores exactly where the player was.
// - A fresh entry from the home page (a history entry without our marker)
//   always starts a clean quiz, so finishing once and pressing "Find my
//   string" again never silently reopens an old result.

import type { QuizAnswers } from './types'
import type { DataSource } from './dataSourcePreference'

export type QuizPhase = 'quiz' | 'result'

export interface QuizHistoryState {
  /** runId ties a history entry to one quiz run, so Back into an OLDER run's entries is recognised and ignored. */
  smashQuiz: { stepIndex: number; phase: QuizPhase; runId: string }
}

export interface StoredQuiz {
  runId: string
  answers: QuizAnswers
  dataSource?: DataSource
  /** Quick (4 rounds, default) or detailed (8 rounds). */
  mode?: 'quick' | 'detailed'
}

const STORAGE_KEY = 'smashlab.quiz.v1'

export function readHistoryState(state: unknown): QuizHistoryState['smashQuiz'] | undefined {
  if (!state || typeof state !== 'object') return undefined
  const q = (state as Partial<QuizHistoryState>).smashQuiz
  if (!q || typeof q.stepIndex !== 'number' || typeof q.runId !== 'string' || (q.phase !== 'quiz' && q.phase !== 'result')) return undefined
  return q
}

export function loadStoredQuiz(storage: Storage | null): StoredQuiz | undefined {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as StoredQuiz
    return parsed && typeof parsed === 'object' && typeof parsed.runId === 'string' && parsed.answers && typeof parsed.answers === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

export function saveStoredQuiz(storage: Storage | null, value: StoredQuiz): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Private mode / quota — the quiz still works, it just won't survive a reload.
  }
}

export function clearStoredQuiz(storage: Storage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function safeSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}
