// Shared types between the quiz UI and the two recommendation engines.

export type TensionUnit = 'kg' | 'lbs'

export interface QuizAnswers {
  level?: string
  style?: string
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
