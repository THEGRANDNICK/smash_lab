// Player feedback on a string: optional fields → one database row. Mirrors the database's own
// checks (supabase/migrations/20261006120000_string_feedback.sql) so mistakes show up in the form,
// not as a database error. Everything is optional, but an entirely empty form isn't sent.

import type { Database } from '../types/database'

export type FeedbackRow = Database['public']['Tables']['string_feedback']['Insert']
export type Balance = 'headHeavy' | 'even' | 'headLight'
export type PlayStyle = 'attacking' | 'doubles' | 'control' | 'defensive' | 'allRound'
export type Level = 'beginner' | 'intermediate' | 'advanced' | 'tournament'
export type RatingKey = 'power' | 'control' | 'comfort' | 'durability'

export interface FeedbackInput {
  racketName: string
  racketBalance?: Balance
  tension: string
  tensionUnit: 'kg' | 'lbs'
  level?: Level
  playStyle?: PlayStyle
  ratings: Partial<Record<RatingKey, number>>
  comment: string
  /** Honeypot: a field people never see. Bots fill it in. */
  website: string
}

export const EMPTY_FEEDBACK: FeedbackInput = { racketName: '', tension: '', tensionUnit: 'kg', ratings: {}, comment: '', website: '' }

const LB = 0.45359237

export type BuildResult = { ok: true; row: FeedbackRow } | { ok: false; error: string; spam?: boolean }

export function buildFeedbackRow(stringId: string, input: FeedbackInput): BuildResult {
  if (input.website.trim() !== '') return { ok: false, error: 'Could not send.', spam: true }

  const racketName = input.racketName.trim().slice(0, 80) || null
  const comment = input.comment.trim().slice(0, 500) || null

  let tensionKg: number | null = null
  if (input.tension.trim() !== '') {
    const n = Number(input.tension.replace(',', '.'))
    if (!Number.isFinite(n)) return { ok: false, error: 'Tension must be a number.' }
    const kg = Math.round((input.tensionUnit === 'lbs' ? n * LB : n) * 10) / 10
    if (kg < 6 || kg > 16) return { ok: false, error: input.tensionUnit === 'lbs' ? 'Tension should be between about 14 and 35 lbs.' : 'Tension should be between 6 and 16 kg.' }
    tensionKg = kg
  }

  const rating = (k: RatingKey) => {
    const v = input.ratings[k]
    return typeof v === 'number' && v >= 1 && v <= 5 ? Math.round(v) : null
  }

  const row: FeedbackRow = {
    string_id: stringId,
    racket_name: racketName,
    racket_balance: input.racketBalance ?? null,
    tension_kg: tensionKg,
    level: input.level ?? null,
    play_style: input.playStyle ?? null,
    rating_power: rating('power'),
    rating_control: rating('control'),
    rating_comfort: rating('comfort'),
    rating_durability: rating('durability'),
    comment,
  }
  const anything = Object.entries(row).some(([k, v]) => k !== 'string_id' && v != null)
  if (!anything) return { ok: false, error: 'Add at least one detail — any field is fine.' }
  return { ok: true, row }
}

/** One feedback per string per day from this device — gentle spam protection, no account needed. */
const KEY = 'smashlab.feedbackSent'
const DAY = 24 * 60 * 60 * 1000

export function canSendFeedback(storage: Pick<Storage, 'getItem'> | null, stringId: string, now = Date.now()): boolean {
  try {
    const sent = JSON.parse(storage?.getItem(KEY) ?? '{}') as Record<string, number>
    const last = sent[stringId]
    return !(typeof last === 'number' && now - last < DAY)
  } catch {
    return true
  }
}

export function markFeedbackSent(storage: Pick<Storage, 'getItem' | 'setItem'> | null, stringId: string, now = Date.now()): void {
  try {
    const sent = JSON.parse(storage?.getItem(KEY) ?? '{}') as Record<string, number>
    sent[stringId] = now
    storage?.setItem(KEY, JSON.stringify(sent))
  } catch {
    // private mode — the limit just doesn't apply
  }
}
