// Folding player feedback into the hands-on ratings (Admin → Feedback, one click).
// Fair by design: the existing hands-on value counts as EXISTING_WEIGHT votes, every feedback as one,
// so a single opinion nudges a value while many agreeing ones move it. With no existing value the
// feedback average is used. Results are rounded to the half points the ratings use (1–5).

import type { SpecialistDimensionKey } from '../data/stringSpecialistProfiles'

export const EXISTING_WEIGHT = 3

export const FEEDBACK_TO_DIMENSION: { feedback: 'rating_power' | 'rating_control' | 'rating_comfort' | 'rating_durability'; dimension: SpecialistDimensionKey; label: string }[] = [
  { feedback: 'rating_power', dimension: 'easyPower', label: 'Power' },
  { feedback: 'rating_control', dimension: 'controlPrecision', label: 'Control' },
  { feedback: 'rating_comfort', dimension: 'comfort', label: 'Comfort' },
  { feedback: 'rating_durability', dimension: 'normalWearDurability', label: 'Durability' },
]

export interface FeedbackRatings {
  rating_power: number | null
  rating_control: number | null
  rating_comfort: number | null
  rating_durability: number | null
}

export interface MergeLine {
  dimension: SpecialistDimensionKey
  label: string
  current: number | null
  feedbackAverage: number | null
  feedbackCount: number
  proposed: number | null
}

const half = (x: number) => Math.min(5, Math.max(1, Math.round(x * 2) / 2))

export function proposeMerge(current: Partial<Record<SpecialistDimensionKey, number>>, feedback: FeedbackRatings[]): MergeLine[] {
  return FEEDBACK_TO_DIMENSION.map(({ feedback: f, dimension, label }) => {
    const votes = feedback.map((r) => r[f]).filter((v): v is number => typeof v === 'number')
    const cur = typeof current[dimension] === 'number' ? (current[dimension] as number) : null
    const avg = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : null
    let proposed: number | null = cur
    if (votes.length) proposed = cur == null ? half(avg!) : half((cur * EXISTING_WEIGHT + votes.reduce((a, b) => a + b, 0)) / (EXISTING_WEIGHT + votes.length))
    return { dimension, label, current: cur, feedbackAverage: avg == null ? null : Math.round(avg * 10) / 10, feedbackCount: votes.length, proposed }
  })
}

/** Only the dimensions that would actually change. */
export function changedDimensions(lines: MergeLine[]): Partial<Record<SpecialistDimensionKey, number>> {
  return Object.fromEntries(lines.filter((l) => l.proposed != null && l.proposed !== l.current).map((l) => [l.dimension, l.proposed as number]))
}
