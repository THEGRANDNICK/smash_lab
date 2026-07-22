import { motion } from 'framer-motion'
import type { QuizQuestionDef } from '../data/quizQuestions'

interface QuizQuestionProps {
  question: QuizQuestionDef
  selectedId?: string
  onSelect: (optionId: string) => void
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
}

export default function QuizQuestion({ question, selectedId, onSelect }: QuizQuestionProps) {
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{question.title}</h2>
      {question.subtitle && <p className="text-ink-700/70 dark:text-shuttle-100/70 mb-6">{question.subtitle}</p>}
      <div role="radiogroup" aria-label={question.title} className={`grid gap-3 mt-6 ${question.options.length > 4 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {question.options.map((option, i) => {
          const selected = option.id === selectedId
          return (
            <motion.button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(option.id)}
              className={`focus-ring group flex items-center gap-4 text-left w-full rounded-2xl border-2 p-4 sm:p-5 transition-colors cursor-pointer
                ${
                  selected
                    ? 'border-shuttle-500 bg-shuttle-100 dark:bg-shuttle-500/10'
                    : 'border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:border-shuttle-400 hover:bg-shuttle-50 dark:hover:bg-white/10'
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
                className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selected ? 'border-shuttle-500 bg-shuttle-500' : 'border-court-900/20 dark:border-white/20'
                }`}
                aria-hidden="true"
              >
                {selected && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
