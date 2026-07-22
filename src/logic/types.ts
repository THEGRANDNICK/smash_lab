// Shared types between the quiz UI and the two recommendation engines.

export type TensionUnit = 'kg' | 'lbs'

export interface QuizAnswers {
  level?: string
  style?: string
  /** Self-assessed power generation: do they need the string/racket to help, or do they already hit hard themselves? */
  powerGeneration?: string
  priority?: string
  durabilityImportance?: string
  hittingFeel?: string
  frequency?: string
  breakStrings?: string
  racketGoal?: string
  currentTensionKnown?: string
  currentTensionValue?: number // stored in kg
  currentTensionFeel?: string
  maxTensionKnown?: string
  maxTensionValue?: number // stored in kg
}
