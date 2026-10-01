// "What if I had answered differently?" — the data behind the answer tree on the results page.
//
// For every quiz question that affects WHICH string is recommended, re-run the real recommendation
// with just that one answer changed and record which string would have come out on top. Pure
// function: same engine, same data, no extra scoring rules — so the tree can never disagree with
// what the quiz would actually have recommended.

import { getQuestion } from '../data/quizQuestions'
import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { recommendStrings } from './recommendationEngine'
import type { QuizAnswers } from './types'

/** Questions that change the recommended string (tension questions only change the tension). */
export const TREE_QUESTIONS = ['level', 'playStyles', 'powerGeneration', 'priorities', 'hittingFeel', 'frequency', 'restringReason'] as const

export interface TreeAlternative {
  /** Short label, e.g. "Soft & forgiving", "+ Comfort", "Comfort instead of Sound", "without Sound". */
  label: string
  answers: QuizAnswers
  bestId: string
  bestName: string
  /** True when this answer would have led to a different top string than the player's real answers. */
  changesResult: boolean
}

export interface TreeNode {
  questionId: string
  title: string
  chosenLabels: string[]
  alternatives: TreeAlternative[]
}

export interface AnswerTree {
  bestId: string
  bestName: string
  nodes: TreeNode[]
}

function labelOf(questionId: string, optionId: string): string {
  return getQuestion(questionId)?.options.find((o) => o.id === optionId)?.label ?? optionId
}

export function buildAnswerTree(answers: QuizAnswers, pool?: StringItem[], specialistProfiles?: Record<string, StringSpecialistProfile>): AnswerTree {
  const actual = recommendStrings(answers, pool, specialistProfiles).best
  const run = (alt: QuizAnswers) => recommendStrings(alt, pool, specialistProfiles).best
  const toAlt = (label: string, alt: QuizAnswers): TreeAlternative => {
    const best = run(alt)
    return { label, answers: alt, bestId: best.string.id, bestName: best.string.name, changesResult: best.string.id !== actual.string.id }
  }

  const nodes: TreeNode[] = []
  for (const questionId of TREE_QUESTIONS) {
    const question = getQuestion(questionId)
    const raw = (answers as Record<string, unknown>)[questionId]
    if (!question || raw == null) continue

    if (question.maxSelect == null) {
      const chosen = raw as string
      nodes.push({
        questionId,
        title: question.title,
        chosenLabels: [labelOf(questionId, chosen)],
        alternatives: question.options.filter((o) => o.id !== chosen).map((o) => toAlt(o.label, { ...answers, [questionId]: o.id })),
      })
      continue
    }

    // Multi-select: show what removing a pick, adding one (if there's room) or swapping the last one does.
    const chosen = raw as string[]
    const max = question.maxSelect
    const alternatives: TreeAlternative[] = []
    if (chosen.length > 1) {
      for (const id of chosen) alternatives.push(toAlt(`without ${labelOf(questionId, id)}`, { ...answers, [questionId]: chosen.filter((c) => c !== id) }))
    }
    for (const option of question.options.filter((o) => !chosen.includes(o.id))) {
      if (chosen.length < max) {
        alternatives.push(toAlt(`+ ${option.label}`, { ...answers, [questionId]: [...chosen, option.id] }))
      } else {
        const last = chosen[chosen.length - 1]
        alternatives.push(toAlt(`${option.label} instead of ${labelOf(questionId, last)}`, { ...answers, [questionId]: [...chosen.slice(0, -1), option.id] }))
      }
    }
    nodes.push({ questionId, title: question.title, chosenLabels: chosen.map((id) => labelOf(questionId, id)), alternatives })
  }

  return { bestId: actual.string.id, bestName: actual.string.name, nodes }
}
