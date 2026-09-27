import { useState } from 'react'
import type { QuizAnswers } from '../logic/types'
import { getQuestion } from '../data/quizQuestions'
import TensionInputStep from './TensionInputStep'

interface TensionTunerProps {
  answers: QuizAnswers
  onChange: (next: QuizAnswers) => void
}

/**
 * Optional tension details on the results page. These questions used to be
 * part of the quiz, but they never changed WHICH string is recommended —
 * only the tension — so they now live here, where the player can see the
 * number update as they answer.
 */
export default function TensionTuner({ answers, onChange }: TensionTunerProps) {
  const alreadyTuned = answers.racketGoal != null || answers.currentTensionValue != null || answers.maxTensionValue != null
  const [open, setOpen] = useState(alreadyTuned)
  const goal = getQuestion('racketGoal')
  const feel = getQuestion('currentTensionFeel')

  function set(patch: Partial<QuizAnswers>) {
    onChange({ ...answers, ...patch })
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-5 sm:p-6" aria-labelledby="tension-tuner-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tension-tuner-heading" className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">
            Fine-tune your tension
          </h2>
          <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">Optional. Tell us about your racket and the tension above updates straight away.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-4 py-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 hover:border-shuttle-500 cursor-pointer"
        >
          {open ? 'Hide' : 'Add racket details'}
        </button>
      </div>

      {open && (
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {goal && (
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">{goal.title}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {goal.options.map((o) => (
                  <Chip key={o.id} selected={answers.racketGoal === o.id} onClick={() => set({ racketGoal: answers.racketGoal === o.id ? undefined : o.id })}>
                    {o.emoji} {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <TensionInputStep
              compact
              title="Your current tension"
              subtitle="Leave empty if you don't know it."
              valueKg={answers.currentTensionValue}
              onChange={(kg) => set({ currentTensionValue: kg, currentTensionKnown: kg != null ? 'yes' : 'no' })}
            />
            {answers.currentTensionValue != null && feel && (
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">{feel.title}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {feel.options.map((o) => (
                    <Chip key={o.id} selected={answers.currentTensionFeel === o.id} onClick={() => set({ currentTensionFeel: o.id })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          <TensionInputStep
            compact
            title="Your racket's maximum tension"
            subtitle="Usually printed on the racket's throat. We'll never recommend more."
            valueKg={answers.maxTensionValue}
            onChange={(kg) => set({ maxTensionValue: kg, maxTensionKnown: kg != null ? 'yes' : 'no' })}
          />
        </div>
      )}
    </section>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`focus-ring rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
        selected ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
      }`}
    >
      {children}
    </button>
  )
}
