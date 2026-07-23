import { motion } from 'framer-motion'
import type { QuizQuestionDef } from '../data/quizQuestions'

interface QuizQuestionProps {
  question: QuizQuestionDef
  /** Current selection — a single-item array for classic single-select questions, up to `maxSelect` items for multi-select. */
  selected: string[]
  onToggle: (optionId: string) => void
}

// `animate` leaves its target value as an inline style once the entrance
// finishes, which would permanently out-rank a plain CSS opacity utility
// class applied later (e.g. for disabled dimming). So the disabled-dimmed
// opacity is driven through this same variant rather than a CSS class.
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: ({ i, disabled }: { i: number; disabled: boolean }) => ({
    opacity: disabled ? 0.4 : 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
}

export default function QuizQuestion({ question, selected, onToggle }: QuizQuestionProps) {
  const isMulti = question.maxSelect != null
  const atMax = isMulti && selected.length >= (question.maxSelect as number)

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{question.title}</h2>
      {question.subtitle && <p className={`text-ink-700/70 dark:text-shuttle-100/70 ${isMulti ? 'mb-1' : 'mb-6'}`}>{question.subtitle}</p>}
      {isMulti && (
        <p className="text-sm font-semibold text-shuttle-600 mb-6">
          {selected.length} of {question.maxSelect} selected
        </p>
      )}
      <div
        role={isMulti ? 'group' : 'radiogroup'}
        aria-label={question.title}
        className={`grid gap-3 mt-6 ${question.options.length > 4 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}
      >
        {question.options.map((option, i) => {
          const isSelected = selected.includes(option.id)
          const disabled = isMulti && atMax && !isSelected
          return (
            <motion.button
              key={option.id}
              type="button"
              role={isMulti ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              disabled={disabled}
              custom={{ i, disabled }}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={disabled ? undefined : { scale: 1.02 }}
              whileTap={disabled ? undefined : { scale: 0.98 }}
              onClick={() => onToggle(option.id)}
              className={`focus-ring group flex items-center gap-4 text-left w-full rounded-2xl border-2 p-4 sm:p-5 transition-colors
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                ${
                  isSelected
                    ? 'border-shuttle-500 bg-shuttle-100 dark:bg-shuttle-500/10'
                    : `border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 ${disabled ? '' : 'hover:border-shuttle-400 hover:bg-shuttle-50 dark:hover:bg-white/10'}`
                }`}
            >
              <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                {option.emoji}
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink-900 dark:text-shuttle-50">{option.label}</span>
                {option.blurb && <span className="block text-sm text-ink-700/60 dark:text-shuttle-100/60 mt-0.5">{option.blurb}</span>}
              </span>
              <span
                className={`shrink-0 w-5 h-5 ${isMulti ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'border-shuttle-500 bg-shuttle-500' : 'border-court-900/20 dark:border-white/20'
                }`}
                aria-hidden="true"
              >
                {isSelected && (isMulti ? <span className="text-white text-xs leading-none">✓</span> : <span className="w-2 h-2 rounded-full bg-white" />)}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
