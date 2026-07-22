// Quiz content — the words the player sees. Edit freely to change copy,
// add options, or add whole new questions (then wire the option's scoring
// impact in config/recommendationWeights.ts and/or config/tensionRules.ts).

export interface QuizOption {
  id: string
  label: string
  emoji: string
  blurb?: string
}

export interface QuizQuestionDef {
  id: string
  title: string
  subtitle?: string
  options: QuizOption[]
}

export const quizQuestions: QuizQuestionDef[] = [
  {
    id: 'level',
    title: 'What kind of player are you?',
    subtitle: 'Be honest — there are no wrong answers.',
    options: [
      { id: 'beginner', label: 'Beginner / recreational', emoji: '🌱', blurb: 'Still learning the game, playing for fun' },
      { id: 'intermediate', label: 'Intermediate club player', emoji: '🏸', blurb: 'Comfortable on court, plays regularly' },
      { id: 'advanced', label: 'Advanced club / league player', emoji: '🔥', blurb: 'Solid technique, competitive league play' },
      { id: 'tournament', label: 'Tournament / highly competitive', emoji: '🏆', blurb: 'Trains seriously, plays tournaments' },
    ],
  },
  {
    id: 'style',
    title: "What best describes your playing style?",
    options: [
      { id: 'aggressive', label: 'Aggressive attacking / smashing', emoji: '💥', blurb: 'Live for the kill shot' },
      { id: 'fastDoubles', label: 'Fast doubles / drives / counterattacking', emoji: '⚡', blurb: 'Quick hands at the net and mid-court' },
      { id: 'control', label: 'Control / placement / net play', emoji: '🎯', blurb: 'Precision over power' },
      { id: 'defensive', label: 'Defensive / rally player', emoji: '🛡️', blurb: 'Patient, consistent, wears opponents down' },
      { id: 'balanced', label: 'Balanced / all-round', emoji: '⚖️', blurb: 'A bit of everything' },
    ],
  },
  {
    id: 'priority',
    title: 'What matters most to you in a string?',
    options: [
      { id: 'repulsion', label: 'Power / repulsion', emoji: '🚀' },
      { id: 'control', label: 'Control', emoji: '🎯' },
      { id: 'durability', label: 'Durability', emoji: '🧵' },
      { id: 'feel', label: 'Crisp hitting feel / sound', emoji: '🔊' },
      { id: 'comfort', label: 'Comfort / shock absorption', emoji: '🤲' },
      { id: 'balanced', label: 'Balanced performance', emoji: '⚖️' },
    ],
  },
  {
    id: 'durabilityImportance',
    title: 'How important is durability to you?',
    options: [
      { id: 'veryImportant', label: 'Very important', emoji: '🛠️', blurb: "I hate breaking strings" },
      { id: 'somewhat', label: 'Somewhat important', emoji: '🙂' },
      { id: 'performanceFirst', label: 'Performance matters more', emoji: '🚀', blurb: "I'll restring if I have to" },
    ],
  },
  {
    id: 'hittingFeel',
    title: 'What hitting feel do you prefer?',
    options: [
      { id: 'hardCrisp', label: 'Hard / crisp / direct', emoji: '🔨' },
      { id: 'mediumBalanced', label: 'Medium / balanced', emoji: '🎚️' },
      { id: 'softComfortable', label: 'Soft / comfortable', emoji: '☁️' },
      { id: 'dontKnow', label: "I don't know", emoji: '🤷' },
    ],
  },
  {
    id: 'frequency',
    title: 'How often do you play?',
    options: [
      { id: 'occasionally', label: 'Occasionally', emoji: '🗓️' },
      { id: 'oneTwoWeek', label: '1–2 times / week', emoji: '📅' },
      { id: 'threePlusWeek', label: '3+ times / week / competitive', emoji: '🔁' },
    ],
  },
  {
    id: 'breakStrings',
    title: 'Do you frequently break strings?',
    options: [
      { id: 'yes', label: 'Yes', emoji: '💔' },
      { id: 'sometimes', label: 'Sometimes', emoji: '😅' },
      { id: 'rarely', label: 'Rarely / never', emoji: '😌' },
    ],
  },
  {
    id: 'racketGoal',
    title: 'What do you want most from your racket setup?',
    subtitle: 'This helps us dial in your tension.',
    options: [
      { id: 'easyPower', label: 'Easier power & a larger sweet spot', emoji: '🌊' },
      { id: 'balancedGoal', label: 'Balanced power and control', emoji: '⚖️' },
      { id: 'precision', label: 'More precision & direct feedback', emoji: '🎯' },
    ],
  },
  {
    id: 'currentTensionKnown',
    title: 'Do you know your current string tension?',
    options: [
      { id: 'yes', label: 'Yes', emoji: '📏' },
      { id: 'no', label: "No / not sure", emoji: '🤔' },
    ],
  },
  {
    id: 'currentTensionFeel',
    title: 'How does your current tension feel?',
    options: [
      { id: 'wantPower', label: 'I want more easy power / forgiveness', emoji: '🌊' },
      { id: 'aboutRight', label: 'It feels about right', emoji: '👍' },
      { id: 'wantControl', label: 'I want more control / a direct feel', emoji: '🎯' },
      { id: 'notSure', label: "I'm not sure", emoji: '🤷' },
    ],
  },
  {
    id: 'maxTensionKnown',
    title: 'Do you know the maximum recommended tension of your racket?',
    subtitle: "Optional, but helps us keep your setup safe.",
    options: [
      { id: 'yes', label: 'Yes', emoji: '📐' },
      { id: 'no', label: "No / not sure", emoji: '🤷' },
    ],
  },
]

export function getQuestion(id: string): QuizQuestionDef | undefined {
  return quizQuestions.find((q) => q.id === id)
}
