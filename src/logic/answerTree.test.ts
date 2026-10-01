import { describe, it, expect } from 'vitest'
import { buildAnswerTree } from './answerTree'
import { recommendStrings } from './recommendationEngine'
import type { QuizAnswers } from './types'

const answers: QuizAnswers = {
  level: 'advanced',
  playStyles: ['fastDoubles', 'control'],
  powerGeneration: 'balanced',
  priorities: ['fastDrives', 'directPrecision', 'sound'],
  hittingFeel: 'hardCrisp',
  frequency: 'threePlusWeek',
}

describe('answer tree', () => {
  const tree = buildAnswerTree(answers)

  it('starts from the real recommendation', () => {
    expect(tree.bestId).toBe(recommendStrings(answers).best.string.id)
  })

  it('every alternative shows exactly what the quiz would recommend for that answer', () => {
    for (const node of tree.nodes) {
      for (const alt of node.alternatives) {
        expect(alt.bestId).toBe(recommendStrings(alt.answers).best.string.id)
        expect(alt.changesResult).toBe(alt.bestId !== tree.bestId)
      }
    }
  })

  it('changes only ONE answer per alternative', () => {
    for (const node of tree.nodes) {
      for (const alt of node.alternatives) {
        const changed = Object.keys({ ...answers, ...alt.answers }).filter(
          (k) => JSON.stringify((answers as Record<string, unknown>)[k]) !== JSON.stringify((alt.answers as Record<string, unknown>)[k]),
        )
        expect(changed).toEqual([node.questionId])
      }
    }
  })

  it('covers every answered question that affects the string, never tension', () => {
    expect(tree.nodes.map((n) => n.questionId)).toEqual(['level', 'playStyles', 'powerGeneration', 'priorities', 'hittingFeel', 'frequency'])
  })

  it('respects multi-select limits (3 priorities chosen → swaps, never a 4th pick)', () => {
    const priorities = tree.nodes.find((n) => n.questionId === 'priorities')!
    for (const alt of priorities.alternatives) expect((alt.answers.priorities ?? []).length).toBeLessThanOrEqual(3)
    expect(priorities.alternatives.some((a) => a.label.includes('instead of'))).toBe(true)
    expect(priorities.alternatives.some((a) => a.label.startsWith('without '))).toBe(true)
  })

  it('at least one answer actually changes the result (the tree is informative)', () => {
    expect(tree.nodes.some((n) => n.alternatives.some((a) => a.changesResult))).toBe(true)
  })
})
