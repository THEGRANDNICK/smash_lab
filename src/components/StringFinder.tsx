import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getQuestion } from '../data/quizQuestions'
import type { QuizAnswers } from '../logic/types'
import QuizQuestion from './QuizQuestion'
import TensionInputStep from './TensionInputStep'
import ProgressBar from './ProgressBar'
import CalculatingAnimation from './CalculatingAnimation'
import RecommendationResult from './RecommendationResult'

type Phase = 'quiz' | 'calculating' | 'result'

interface StringFinderProps {
  onExit: () => void
  onCompare: () => void
}

function buildSteps(answers: QuizAnswers): string[] {
  const steps = ['level', 'playStyles', 'powerGeneration', 'priorities', 'hittingFeel', 'frequency']
  if (answers.priorities?.includes('durability')) steps.push('restringReason')
  steps.push('racketGoal', 'currentTensionKnown')
  if (answers.currentTensionKnown === 'yes') steps.push('currentTensionValue', 'currentTensionFeel')
  steps.push('maxTensionKnown')
  if (answers.maxTensionKnown === 'yes') steps.push('maxTensionValue')
  return steps
}

export default function StringFinder({ onExit, onCompare }: StringFinderProps) {
  const [answers, setAnswers] = useState<QuizAnswers>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('quiz')
  const [direction, setDirection] = useState(1)

  const steps = useMemo(() => buildSteps(answers), [answers])
  const currentStepId = steps[stepIndex]

  function goToIndex(nextIndex: number, dir: number) {
    setDirection(dir)
    if (nextIndex >= steps.length) {
      setPhase('calculating')
    } else {
      setStepIndex(Math.max(0, nextIndex))
    }
  }

  /** Single-select: replace the answer and auto-advance. Multi-select: toggle within the array and wait for an explicit Continue. */
  function handleToggle(questionId: string, optionId: string) {
    const question = getQuestion(questionId)
    const maxSelect = question?.maxSelect

    if (maxSelect == null) {
      const nextAnswers: QuizAnswers = { ...answers, [questionId]: optionId }
      setAnswers(nextAnswers)
      const nextSteps = buildSteps(nextAnswers)
      setDirection(1)
      window.setTimeout(() => {
        if (stepIndex + 1 >= nextSteps.length) {
          setPhase('calculating')
        } else {
          setStepIndex(stepIndex + 1)
        }
      }, 220)
      return
    }

    setAnswers((prev) => {
      const current = ((prev as Record<string, unknown>)[questionId] as string[] | undefined) ?? []
      let next: string[]
      if (current.includes(optionId)) {
        next = current.filter((id) => id !== optionId)
      } else if (current.length < maxSelect) {
        next = [...current, optionId]
      } else {
        next = current
      }
      return { ...prev, [questionId]: next }
    })
  }

  function handleContinue() {
    goToIndex(stepIndex + 1, 1)
  }

  function handleBack() {
    goToIndex(stepIndex - 1, -1)
  }

  if (phase === 'calculating') {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <CalculatingAnimation onDone={() => setPhase('result')} />
      </div>
    )
  }

  if (phase === 'result') {
    return (
      <div className="px-4">
        <RecommendationResult answers={answers} onRetake={restart} onCompare={onCompare} />
      </div>
    )
  }

  function restart() {
    setAnswers({})
    setStepIndex(0)
    setPhase('quiz')
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={stepIndex === 0 ? onExit : handleBack}
          className="focus-ring text-sm font-semibold text-ink-700/60 dark:text-shuttle-100/60 hover:text-ink-900 dark:hover:text-shuttle-50 flex items-center gap-1 cursor-pointer"
        >
          ← {stepIndex === 0 ? 'Exit' : 'Back'}
        </button>
      </div>

      <ProgressBar step={stepIndex} total={steps.length} />

      <div className="mt-8 min-h-[420px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStepId}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <StepContent stepId={currentStepId} answers={answers} onToggle={handleToggle} onContinue={handleContinue} setAnswers={setAnswers} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

interface StepContentProps {
  stepId: string
  answers: QuizAnswers
  onToggle: (questionId: string, optionId: string) => void
  onContinue: () => void
  setAnswers: React.Dispatch<React.SetStateAction<QuizAnswers>>
}

function StepContent({ stepId, answers, onToggle, onContinue, setAnswers }: StepContentProps) {
  if (stepId === 'currentTensionValue') {
    return (
      <div>
        <TensionInputStep
          title="What's your current tension?"
          subtitle="Enter it in whichever unit you know."
          valueKg={answers.currentTensionValue}
          onChange={(kg) => setAnswers((a) => ({ ...a, currentTensionValue: kg }))}
        />
        <ContinueButton onClick={onContinue} disabled={answers.currentTensionValue == null} />
      </div>
    )
  }

  if (stepId === 'maxTensionValue') {
    return (
      <div>
        <TensionInputStep
          title="What's the maximum recommended tension for your racket?"
          subtitle="Check your racket's throat or manufacturer spec sheet."
          valueKg={answers.maxTensionValue}
          onChange={(kg) => setAnswers((a) => ({ ...a, maxTensionValue: kg }))}
        />
        <ContinueButton onClick={onContinue} disabled={answers.maxTensionValue == null} />
      </div>
    )
  }

  const question = getQuestion(stepId)
  if (!question) return null

  const raw = (answers as Record<string, unknown>)[stepId]
  const isMulti = question.maxSelect != null
  const selected: string[] = isMulti ? ((raw as string[] | undefined) ?? []) : raw ? [raw as string] : []

  return (
    <div>
      <QuizQuestion question={question} selected={selected} onToggle={(optionId) => onToggle(stepId, optionId)} />
      {isMulti && <ContinueButton onClick={onContinue} disabled={selected.length === 0} />}
    </div>
  )
}

function ContinueButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring mt-6 rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-40 disabled:cursor-not-allowed text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
    >
      Continue
    </button>
  )
}
