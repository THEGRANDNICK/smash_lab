// Quiz content — the words the player sees. Edit freely to change copy,
// add options, or add whole new questions (then wire the option's scoring
// impact in config/recommendationWeights.ts and/or config/specialistWeights.ts,
// and config/tensionRules.ts for tension-related questions).

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
  /** Set for multi-select questions — the player can pick up to this many options. Omit for classic single-select. */
  maxSelect?: number
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
    id: 'playStyles',
    title: "What best describes your playing style?",
    subtitle: 'Choose up to 2.',
    maxSelect: 2,
    options: [
      { id: 'aggressive', label: 'Aggressive attacking / smashing', emoji: '💥', blurb: 'Live for the kill shot' },
      { id: 'fastDoubles', label: 'Fast doubles / drives / counterattacking', emoji: '⚡', blurb: 'Quick hands at the net and mid-court' },
      { id: 'control', label: 'Control / placement / net play', emoji: '🎯', blurb: 'Precision over power' },
      { id: 'defensive', label: 'Defensive / rally player', emoji: '🛡️', blurb: 'Patient, consistent, wears opponents down' },
      { id: 'balanced', label: 'Balanced / all-round', emoji: '⚖️', blurb: 'A bit of everything' },
    ],
  },
  {
    id: 'powerGeneration',
    title: 'How would you describe your own power generation?',
    subtitle: 'Be honest about your swing, not your playing style — this is about how you hit, not what shots you play.',
    options: [
      { id: 'needsHelp', label: 'I want help generating easier power', emoji: '🌊', blurb: "My technique is still developing, or I don't naturally hit that hard" },
      { id: 'balanced', label: 'Balanced — I generate decent power myself', emoji: '⚖️', blurb: 'A comfortable mix, nothing extreme either way' },
      { id: 'ownPower', label: 'I generate plenty of power / I hit hard', emoji: '💪', blurb: 'Strong technique, fast swing — the string just needs to keep up' },
    ],
  },
  {
    id: 'priorities',
    title: 'What matters most to you in a string?',
    subtitle: 'Choose up to 3.',
    maxSelect: 3,
    options: [
      { id: 'easyPower', label: 'Easy power / repulsion', emoji: '🚀' },
      { id: 'hardAttack', label: 'Hard-hitting attack', emoji: '💥' },
      { id: 'fastDrives', label: 'Fast drives / doubles', emoji: '⚡' },
      { id: 'directPrecision', label: 'Direct precision', emoji: '🎯' },
      { id: 'shuttleGrip', label: 'Shuttle grip / hold', emoji: '🤏', blurb: 'A rougher texture that "bites" the shuttle for slices and spin' },
      { id: 'netTechnical', label: 'Net / technical play', emoji: '🕸️' },
      { id: 'durability', label: 'Maximum durability', emoji: '🧵' },
      { id: 'comfort', label: 'Comfort / softer feel', emoji: '🤲' },
      { id: 'tensionRetention', label: 'Long-lasting tension / feel', emoji: '⏳', blurb: 'Stays lively instead of going dead after a few sessions' },
      { id: 'sound', label: 'Sound / crisp feedback', emoji: '🔊' },
    ],
  },
  {
    id: 'hittingFeel',
    title: 'What kind of stringbed feel do you prefer?',
    subtitle: "This is about how the string responds under your racket arm, not your playing style.",
    options: [
      { id: 'hardCrisp', label: 'Hard & direct / crisp', emoji: '🔨', blurb: 'Crisp feedback, precision, and a more connected feel' },
      { id: 'mediumBalanced', label: 'Balanced / medium', emoji: '🎚️', blurb: 'A mix of comfort, feedback and response' },
      { id: 'softComfortable', label: 'Soft & forgiving', emoji: '☁️', blurb: 'Comfortable, easier power, less harsh feedback' },
      { id: 'dontKnow', label: "Not sure", emoji: '🤷', blurb: "No strong preference — we won't lean on this too heavily" },
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
    id: 'restringReason',
    title: 'What usually makes you restring?',
    subtitle: "You picked durability as a priority — this helps us figure out what kind of durability you actually need.",
    options: [
      { id: 'wearFraying', label: 'Strings gradually wear/fray and eventually break', emoji: '🪢' },
      { id: 'mishitBreakage', label: 'I often break strings from mishits', emoji: '💥', blurb: 'A single bad off-centre hit snaps it' },
      { id: 'tensionLoss', label: 'They lose tension/feel before they break', emoji: '⏳' },
      { id: 'rarelyBreak', label: "I rarely break strings — I just want them to last", emoji: '😌' },
      { id: 'notSure', label: 'Not sure', emoji: '🤷' },
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
