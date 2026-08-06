// Part 5 — shareable quiz results. Encodes ONLY the quiz answers +
// data-source choice needed to reproduce a recommendation deterministically
// client-side (recommendStrings() is pure — same answers always produce the
// same result). Deliberately excludes everything else that ever touches a
// result page: no name, email, racket model, free-text note, admin data,
// or access token ever passes through here (compare to
// StringingEnquiry.tsx, which keeps those fields in local component state
// and never puts them in a URL). A shared link never writes to Supabase —
// decoding just re-runs the same pure recommendation the quiz itself runs.
//
// Format: "v1:" + '|'-joined fields in a fixed order, each either empty or
// a small token. Every categorical field is validated against the real
// question options in data/quizQuestions.ts (never a second, hand-maintained
// list that could drift out of sync). Any validation failure — wrong
// version, wrong field count, an id that doesn't exist, a non-finite
// number — returns null rather than throwing or producing a partially-valid
// state, so a malformed/tampered link fails safely into "couldn't be read"
// rather than a broken or misleading result.

import { getQuestion } from '../data/quizQuestions.js'
import type { QuizAnswers } from './types.js'
import { type DataSource } from './dataSourcePreference.js'

const FORMAT_VERSION = 'v1'
const FIELD_SEPARATOR = '|'
const LIST_SEPARATOR = ','

export interface ResultShareState {
  answers: QuizAnswers
  dataSource: DataSource
}

// Fixed field order — do not reorder existing entries in a released
// version; only ever append (and bump FORMAT_VERSION for any breaking
// change) so old links don't silently decode into the wrong fields.
const FIELD_ORDER = [
  'level',
  'playStyles',
  'powerGeneration',
  'priorities',
  'hittingFeel',
  'frequency',
  'restringReason',
  'racketGoal',
  'currentTensionKnown',
  'currentTensionValue',
  'currentTensionFeel',
  'maxTensionKnown',
  'maxTensionValue',
  'dataSource',
] as const

const MAX_TENSION_KG = 100

function isValidOptionId(questionId: string, value: string): boolean {
  const question = getQuestion(questionId)
  return question != null && question.options.some((o) => o.id === value)
}

function isValidTensionKg(value: string): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= MAX_TENSION_KG
}

function encodeList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(LIST_SEPARATOR) : ''
}

function decodeList(raw: string): string[] | undefined {
  return raw === '' ? undefined : raw.split(LIST_SEPARATOR)
}

export function encodeResultShareState(answers: QuizAnswers, dataSource: DataSource): string {
  const fields: Record<(typeof FIELD_ORDER)[number], string> = {
    level: answers.level ?? '',
    playStyles: encodeList(answers.playStyles),
    powerGeneration: answers.powerGeneration ?? '',
    priorities: encodeList(answers.priorities),
    hittingFeel: answers.hittingFeel ?? '',
    frequency: answers.frequency ?? '',
    restringReason: answers.restringReason ?? '',
    racketGoal: answers.racketGoal ?? '',
    currentTensionKnown: answers.currentTensionKnown ?? '',
    currentTensionValue: answers.currentTensionValue != null ? String(answers.currentTensionValue) : '',
    currentTensionFeel: answers.currentTensionFeel ?? '',
    maxTensionKnown: answers.maxTensionKnown ?? '',
    maxTensionValue: answers.maxTensionValue != null ? String(answers.maxTensionValue) : '',
    dataSource,
  }
  const body = FIELD_ORDER.map((key) => fields[key]).join(FIELD_SEPARATOR)
  return `${FORMAT_VERSION}:${encodeURIComponent(body)}`
}

export function decodeResultShareState(encoded: string): ResultShareState | null {
  const separatorIndex = encoded.indexOf(':')
  if (separatorIndex === -1) return null
  const version = encoded.slice(0, separatorIndex)
  if (version !== FORMAT_VERSION) return null

  let body: string
  try {
    body = decodeURIComponent(encoded.slice(separatorIndex + 1))
  } catch {
    return null
  }

  const parts = body.split(FIELD_SEPARATOR)
  if (parts.length !== FIELD_ORDER.length) return null
  const raw: Record<(typeof FIELD_ORDER)[number], string> = {} as never
  FIELD_ORDER.forEach((key, i) => {
    raw[key] = parts[i]
  })

  // Validate every categorical field against the real, current quiz
  // options — an id from a retired/renamed option fails safely rather
  // than producing a result the quiz itself could never generate.
  for (const [questionId, value] of [
    ['level', raw.level],
    ['powerGeneration', raw.powerGeneration],
    ['hittingFeel', raw.hittingFeel],
    ['frequency', raw.frequency],
    ['restringReason', raw.restringReason],
    ['racketGoal', raw.racketGoal],
    ['currentTensionKnown', raw.currentTensionKnown],
    ['currentTensionFeel', raw.currentTensionFeel],
    ['maxTensionKnown', raw.maxTensionKnown],
  ] as const) {
    if (value !== '' && !isValidOptionId(questionId, value)) return null
  }
  for (const value of decodeList(raw.playStyles) ?? []) {
    if (!isValidOptionId('playStyles', value)) return null
  }
  for (const value of decodeList(raw.priorities) ?? []) {
    if (!isValidOptionId('priorities', value)) return null
  }
  if (raw.currentTensionValue !== '' && !isValidTensionKg(raw.currentTensionValue)) return null
  if (raw.maxTensionValue !== '' && !isValidTensionKg(raw.maxTensionValue)) return null
  if (raw.dataSource !== 'manufacturer-only' && raw.dataSource !== 'manufacturer-specialist') return null

  const answers: QuizAnswers = {
    level: raw.level || undefined,
    playStyles: decodeList(raw.playStyles),
    powerGeneration: raw.powerGeneration || undefined,
    priorities: decodeList(raw.priorities),
    hittingFeel: raw.hittingFeel || undefined,
    frequency: raw.frequency || undefined,
    restringReason: raw.restringReason || undefined,
    racketGoal: raw.racketGoal || undefined,
    currentTensionKnown: raw.currentTensionKnown || undefined,
    currentTensionValue: raw.currentTensionValue !== '' ? Number(raw.currentTensionValue) : undefined,
    currentTensionFeel: raw.currentTensionFeel || undefined,
    maxTensionKnown: raw.maxTensionKnown || undefined,
    maxTensionValue: raw.maxTensionValue !== '' ? Number(raw.maxTensionValue) : undefined,
  }

  return { answers, dataSource: raw.dataSource }
}
