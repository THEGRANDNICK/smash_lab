import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getQuestion } from '../data/quizQuestions'
import type { QuizAnswers } from '../logic/types'
import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { type DataSource, DEFAULT_DATA_SOURCE, resolveSpecialistProfiles } from '../logic/dataSourcePreference'
import QuizQuestion from './QuizQuestion'
import ProgressBar from './ProgressBar'
import CalculatingAnimation from './CalculatingAnimation'
import RecommendationResult from './RecommendationResult'
import { TensionFields } from './TensionTuner'
import { type QuizHistoryState, clearStoredQuiz, loadStoredQuiz, newRunId, readHistoryState, safeSessionStorage, saveStoredQuiz } from '../logic/quizSession'

type Phase = 'quiz' | 'calculating' | 'result'

// Product feedback: players should eventually be able to edit a single
// quiz answer without restarting entirely. Not built this phase (too
// risky to rush), but the existing shape already makes it a small,
// additive change later: `steps` is recomputed from `answers` on every
// render (not a fixed list), and `stepIndex`/`goToIndex()` already jump
// to an arbitrary index. A future "Edit an answer" entry point from the
// result page would just need to call goToIndex() with the target
// step's position in `steps` and set phase back to 'quiz' — no restructuring
// of the state model required.


interface StringFinderProps {
  onExit: () => void
  onCompare: () => void
  /** Defaults to the full static catalog when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. */
  pool?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Omitted or empty renders no purchase options. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

/**
 * The questions that decide WHICH string is recommended, followed by ONE optional tension step.
 * Tension used to be three separate questions (too long), then only a panel on the results page
 * (players overlooked it) — now it's a single, skippable screen with all three inputs together.
 */
function buildSteps(answers: QuizAnswers): string[] {
  const steps = ['level', 'playStyles', 'powerGeneration', 'priorities', 'hittingFeel', 'frequency']
  if (answers.priorities?.includes('durability')) steps.push('restringReason')
  steps.push(TENSION_STEP)
  return steps
}

const TENSION_STEP = 'tension'

export default function StringFinder({ onExit, onCompare, pool, specialistProfiles, retailerListingsByStringId }: StringFinderProps) {
  // Restore only when this history entry is one of ours (reload, or Back-then-Forward into the quiz).
  // A fresh visit from the home page carries no marker and always starts clean.
  const [initial] = useState(() => {
    const entry = typeof window === 'undefined' ? undefined : readHistoryState(window.history.state)
    const stored = entry ? loadStoredQuiz(safeSessionStorage()) : undefined
    if (!entry || !stored || stored.runId !== entry.runId) {
      clearStoredQuiz(safeSessionStorage())
      return { runId: newRunId(), answers: {} as QuizAnswers, stepIndex: 0, phase: 'quiz' as Phase, dataSource: DEFAULT_DATA_SOURCE }
    }
    return { runId: stored.runId, answers: stored.answers, stepIndex: entry.stepIndex, phase: entry.phase as Phase, dataSource: stored.dataSource ?? DEFAULT_DATA_SOURCE }
  })
  const [runId, setRunId] = useState(initial.runId)
  const [answers, setAnswers] = useState<QuizAnswers>(initial.answers)
  const [stepIndex, setStepIndex] = useState(initial.stepIndex)
  const [phase, setPhase] = useState<Phase>(initial.phase)
  const [direction, setDirection] = useState(1)
  // A setting, not a scored quiz answer — its only effect is which
  // specialist-profile map the recommendation receives (the real one, or {}
  // for a manufacturer-only run). Switched on the results page.
  // v2: always calibrated (manufacturer data + Smash Lab specialist profiles); no switch on the site.
  const [dataSource] = useState<DataSource>(initial.dataSource)
  const resolvedSpecialistProfiles = resolveSpecialistProfiles(dataSource, specialistProfiles)

  // Mark the entry we were opened on as ours, so a reload restores it.
  useEffect(() => {
    const state: QuizHistoryState = { smashQuiz: { stepIndex: initial.stepIndex, phase: initial.phase === 'result' ? 'result' : 'quiz', runId: initial.runId } }
    window.history.replaceState(state, '', window.location.href)
  }, [initial])

  useEffect(() => {
    saveStoredQuiz(safeSessionStorage(), { runId, answers, dataSource })
  }, [runId, answers, dataSource])

  // Browser Back / Forward (incl. the Android back gesture) move between questions.
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const entry = readHistoryState(e.state)
      if (!entry) return // left the quiz entirely — App's hashchange handler takes over
      if (entry.runId !== runId) {
        // An entry from an earlier quiz run: its answers are gone, so show the start of the current run instead.
        window.history.replaceState({ smashQuiz: { stepIndex: 0, phase: 'quiz', runId } } satisfies QuizHistoryState, '', window.location.href)
        setDirection(-1)
        setPhase('quiz')
        setStepIndex(0)
        return
      }
      setDirection(entry.stepIndex < stepIndex || entry.phase === 'quiz' ? -1 : 1)
      setPhase(entry.phase)
      setStepIndex(entry.stepIndex)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [stepIndex, runId])

  const steps = useMemo(() => buildSteps(answers), [answers])
  // For the progress bar only: count the conditional follow-up as long as it's still possible,
  // so the total can only shrink ("7" -> "6") instead of growing mid-quiz.
  const displayTotal = useMemo(() => buildSteps({ ...answers, priorities: answers.priorities ?? ['durability'] }).length, [answers])
  const currentStepId = steps[Math.min(stepIndex, steps.length - 1)]

  function pushEntry(next: Omit<QuizHistoryState['smashQuiz'], 'runId'>, forRun: string = runId) {
    const state: QuizHistoryState = { smashQuiz: { ...next, runId: forRun } }
    window.history.pushState(state, '', window.location.href)
  }

  function advance(fromIndex: number, stepsForAnswers: string[]) {
    setDirection(1)
    if (fromIndex + 1 >= stepsForAnswers.length) {
      pushEntry({ stepIndex: fromIndex, phase: 'result' })
      setPhase('calculating')
    } else {
      pushEntry({ stepIndex: fromIndex + 1, phase: 'quiz' })
      setStepIndex(fromIndex + 1)
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
      const from = stepIndex
      window.setTimeout(() => advance(from, nextSteps), 220)
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
    advance(stepIndex, steps)
  }

  /** The on-screen Back button uses the same history as the browser's, so both always agree. */
  function handleBack() {
    window.history.back()
  }

  function handleExit() {
    clearStoredQuiz(safeSessionStorage())
    onExit()
  }

  function restart() {
    clearStoredQuiz(safeSessionStorage())
    const fresh = newRunId()
    setRunId(fresh)
    setAnswers({})
    setStepIndex(0)
    setPhase('quiz')
    pushEntry({ stepIndex: 0, phase: 'quiz' }, fresh)
    window.scrollTo({ top: 0 })
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
        <RecommendationResult
          answers={answers}
          onChangeAnswers={setAnswers}
          onRetake={restart}
          onCompare={onCompare}
          dataSource={dataSource}
          pool={pool}
          specialistProfiles={resolvedSpecialistProfiles}
          retailerListingsByStringId={retailerListingsByStringId}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={stepIndex === 0 ? handleExit : handleBack}
          className="focus-ring text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 flex items-center gap-1 cursor-pointer"
        >
          {stepIndex === 0 ? '← Exit' : '← Back'}
        </button>
      </div>

      <ProgressBar step={stepIndex} total={displayTotal} />

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
            <StepContent stepId={currentStepId} answers={answers} onToggle={handleToggle} onContinue={handleContinue} onPatch={setAnswers} />
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
  onPatch: (next: QuizAnswers) => void
}

function StepContent({ stepId, answers, onToggle, onContinue, onPatch }: StepContentProps) {
  if (stepId === TENSION_STEP) {
    const hasInput = answers.racketGoal != null || answers.currentTensionValue != null || answers.maxTensionValue != null
    return (
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Let's dial in your tension</h1>
        <p className="text-ink-700/70 dark:text-shuttle-100/70">
          Optional, but it makes your tension much more precise. Don't know these? Just skip — you'll still get a solid starting tension.
        </p>
        <TensionFields answers={answers} onChange={onPatch} className="mt-6" />
        <ContinueButton onClick={onContinue} label={hasInput ? 'See my result' : 'Skip — see my result'} />
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
      {isMulti && <ContinueButton onClick={onContinue} disabled={selected.length === 0} selectedCount={selected.length} />}
    </div>
  )
}

/** Sticks to the bottom of the screen on phones, where long multi-select lists pushed it below the fold. */
function ContinueButton({ onClick, disabled, selectedCount, label }: { onClick: () => void; disabled?: boolean; selectedCount?: number; label?: string }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 px-4 py-3 bg-gradient-to-t from-shuttle-50 via-shuttle-50/95 to-shuttle-50/0 dark:from-[#0c1210] dark:via-[#0c1210]/95 dark:to-[#0c1210]/0 sm:static sm:mx-0 sm:p-0 sm:bg-none">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="focus-ring w-full sm:w-auto rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-40 disabled:cursor-not-allowed text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
      >
        {label ?? `Continue${selectedCount ? ` (${selectedCount} selected)` : ''}`}
      </button>
    </div>
  )
}
