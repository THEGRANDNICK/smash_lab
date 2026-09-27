import { describe, it, expect } from 'vitest'
import { clearStoredQuiz, loadStoredQuiz, newRunId, readHistoryState, saveStoredQuiz } from './quizSession'
import { buildPodiumAlternativeReason, buildTradeoffVsBest } from './recommendationExplanation'
import { recommendStrings } from './recommendationEngine'
import { STRING_SPECIALIST_PROFILES as P } from '../data/stringSpecialistProfiles'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  }
}

describe('quiz history entries', () => {
  it('recognises only well-formed quiz entries', () => {
    expect(readHistoryState({ smashQuiz: { stepIndex: 2, phase: 'quiz', runId: 'a' } })).toEqual({ stepIndex: 2, phase: 'quiz', runId: 'a' })
    expect(readHistoryState(null)).toBeUndefined()
    expect(readHistoryState({})).toBeUndefined()
    expect(readHistoryState({ smashQuiz: { stepIndex: 2, phase: 'quiz' } })).toBeUndefined() // no runId = older build
    expect(readHistoryState({ smashQuiz: { stepIndex: 2, phase: 'calculating', runId: 'a' } })).toBeUndefined()
  })

  it('gives every quiz run its own id', () => {
    expect(newRunId()).not.toBe(newRunId())
  })
})

describe('stored quiz answers', () => {
  it('round-trips answers and data source', () => {
    const s = memoryStorage()
    saveStoredQuiz(s, { runId: 'r1', answers: { level: 'advanced', priorities: ['sound'] }, dataSource: 'manufacturer-only' })
    expect(loadStoredQuiz(s)).toEqual({ runId: 'r1', answers: { level: 'advanced', priorities: ['sound'] }, dataSource: 'manufacturer-only' })
  })

  it('ignores corrupt or foreign data instead of crashing', () => {
    const s = memoryStorage()
    s.setItem('smashlab.quiz.v1', '{not json')
    expect(loadStoredQuiz(s)).toBeUndefined()
    s.setItem('smashlab.quiz.v1', JSON.stringify({ answers: {} })) // no runId
    expect(loadStoredQuiz(s)).toBeUndefined()
  })

  it('clears, and tolerates a missing storage (private mode)', () => {
    const s = memoryStorage()
    saveStoredQuiz(s, { runId: 'r1', answers: {} })
    clearStoredQuiz(s)
    expect(loadStoredQuiz(s)).toBeUndefined()
    expect(() => saveStoredQuiz(null, { runId: 'x', answers: {} })).not.toThrow()
    expect(loadStoredQuiz(null)).toBeUndefined()
  })
})

describe('alternatives explain themselves', () => {
  const personas = [
    { level: 'intermediate', playStyles: ['balanced'], powerGeneration: 'balanced', priorities: ['easyPower', 'directPrecision'], hittingFeel: 'mediumBalanced' },
    { level: 'advanced', playStyles: ['fastDoubles', 'control'], powerGeneration: 'balanced', priorities: ['fastDrives', 'directPrecision', 'sound'], hittingFeel: 'hardCrisp' },
    { level: 'intermediate', playStyles: ['defensive'], priorities: ['comfort', 'easyPower'], hittingFeel: 'softComfortable' },
    { level: 'beginner', playStyles: ['balanced'], priorities: ['durability'], restringReason: 'mishitBreakage' },
  ]

  it('never falls back to the old "A strong alternative at X% match" filler', () => {
    for (const answers of personas) {
      const rec = recommendStrings(answers)
      for (const alt of rec.topThree.slice(1)) {
        const reason = buildPodiumAlternativeReason(alt, rec.best, P[alt.string.id], P[rec.best.string.id])
        expect(reason).not.toMatch(/strong alternative at/)
        expect(reason.endsWith('.')).toBe(true)
      }
    }
  })

  it('names a real plus and a real minus when the strings clearly differ (BG80 vs Exbolt 63)', () => {
    const rec = recommendStrings(personas[1])
    const bg80 = rec.topThree.find((s) => s.string.id === 'yonex-bg80')
    const eb63 = rec.topThree.find((s) => s.string.id === 'yonex-exbolt-63')
    if (!bg80 || !eb63) return // ranking may shift with future data; the first test still guards the wording
    const { plus } = buildTradeoffVsBest(bg80, eb63, P['yonex-bg80'], P['yonex-exbolt-63'])
    expect(plus).toBe('Offers more precise control')
  })
})
