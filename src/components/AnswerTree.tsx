import { useMemo, useState } from 'react'
import type { StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { buildAnswerTree } from '../logic/answerTree'
import type { QuizAnswers } from '../logic/types'

interface AnswerTreeProps {
  answers: QuizAnswers
  pool?: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** The string currently shown at the top of the results page. */
  featuredId: string
  /** Shows a string at the top of the results page. */
  onFeature: (id: string) => void
}

/**
 * "How your answers led here": one branch per quiz question, the player's own answer highlighted,
 * and — for every other answer that would have changed the result — the string it would have led
 * to. Tapping a string shows it at the top of the page. Answers that lead to the same string are
 * hidden by default so ten-option questions stay readable.
 */
export default function AnswerTree({ answers, pool, specialistProfiles, featuredId, onFeature }: AnswerTreeProps) {
  const tree = useMemo(() => buildAnswerTree(answers, pool, specialistProfiles), [answers, pool, specialistProfiles])
  const [showAll, setShowAll] = useState(false)

  return (
    <section aria-labelledby="answer-tree-heading" className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="answer-tree-heading" className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">
            How your answers led here
          </h3>
          <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70 mt-1">Your answers in orange. Tap a string to see it at the top.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-700/80 dark:text-shuttle-100/80 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show answers that change nothing
        </label>
      </div>

      <ol className="mt-5">
        {tree.nodes.map((node) => {
          const visible = showAll ? node.alternatives : node.alternatives.filter((a) => a.changesResult)
          const hidden = node.alternatives.length - visible.length
          return (
            <li key={node.questionId} className="relative border-l-2 border-court-900/15 dark:border-white/15 pl-5 pb-5 ml-2">
              <span aria-hidden="true" className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-court-800 dark:bg-shuttle-100" />
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">{node.title}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-shuttle-500 text-court-900 text-sm font-bold px-3 py-1">{node.chosenLabels.join(' + ')}</span>
                <span aria-hidden="true" className="text-ink-700/50 dark:text-shuttle-100/50">→</span>
                <StringChip id={tree.bestId} name={tree.bestName} featured={featuredId === tree.bestId} onFeature={onFeature} />
              </div>

              {visible.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-l border-dashed border-court-900/20 dark:border-white/20 ml-3 pl-4">
                  {visible.map((alt) => (
                    <li key={alt.label} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink-700/80 dark:text-shuttle-100/80">{alt.label}</span>
                      <span aria-hidden="true" className="text-ink-700/50 dark:text-shuttle-100/50">→</span>
                      <StringChip id={alt.bestId} name={alt.bestName} featured={featuredId === alt.bestId} onFeature={onFeature} muted={!alt.changesResult} />
                    </li>
                  ))}
                </ul>
              )}
              {!showAll && hidden > 0 && (
                <p className="mt-1.5 ml-3 text-xs text-ink-700/60 dark:text-shuttle-100/60">
                  {visible.length === 0 ? 'Any other answer here gives the same result.' : `${hidden} other answer${hidden === 1 ? '' : 's'} give the same result.`}
                </p>
              )}
            </li>
          )
        })}
        <li className="relative ml-2 pl-5">
          <span aria-hidden="true" className="absolute -left-[9px] top-0.5 text-base">🏆</span>
          <p className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">
            Your best match: <StringChip id={tree.bestId} name={tree.bestName} featured={featuredId === tree.bestId} onFeature={onFeature} />
          </p>
        </li>
      </ol>
    </section>
  )
}

function StringChip({ id, name, featured, onFeature, muted = false }: { id: string; name: string; featured: boolean; onFeature: (id: string) => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onFeature(id)}
      aria-pressed={featured}
      title={featured ? 'Shown at the top' : `Show ${name} at the top`}
      className={`focus-ring rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold transition-colors cursor-pointer ${
        featured
          ? 'border-shuttle-500 text-ink-900 dark:text-shuttle-50'
          : muted
            ? 'border-court-900/10 dark:border-white/10 text-ink-700/70 dark:text-shuttle-100/70 hover:border-shuttle-400'
            : 'border-court-900/20 dark:border-white/25 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
      }`}
    >
      {name}
    </button>
  )
}
