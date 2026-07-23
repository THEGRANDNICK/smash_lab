// Shared types between the quiz UI and the two recommendation engines.

export type TensionUnit = 'kg' | 'lbs'

export interface QuizAnswers {
  level?: string
  /** Up to 2 playing styles. */
  playStyles?: string[]
  /** Self-assessed power generation: do they need the string/racket to help, or do they already hit hard themselves? */
  powerGeneration?: string
  /** Up to 3 priorities — replaces the old single-select "priority" question. */
  priorities?: string[]
  hittingFeel?: string
  frequency?: string
  /** Only asked when "durability" is one of the selected priorities. */
  restringReason?: string
  racketGoal?: string
  currentTensionKnown?: string
  currentTensionValue?: number // stored in kg
  currentTensionFeel?: string
  maxTensionKnown?: string
  maxTensionValue?: number // stored in kg
}
