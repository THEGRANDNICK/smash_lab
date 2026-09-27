import { AXIS_EXPLANATION, PERFORMANCE_AXES } from './performanceAxes'

const EXTRA_TERMS: { term: string; text: string }[] = [
  { term: 'Gauge (mm)', text: 'The string’s thickness. Around 0.70 mm lasts long and suits beginners; 0.61–0.66 mm feels livelier but breaks sooner.' },
  { term: 'Hybrid', text: 'Different strings for the long (main) and short (cross) direction, e.g. AeroBite, for extra spin and shuttle grip.' },
  { term: 'Tension', text: 'How tightly the string is pulled. Lower is more forgiving with easier power; higher gives more control but needs a clean swing.' },
  { term: '0–11 bars vs. 🔬 x/5', text: 'The bars are each manufacturer’s own ratings, so they aren’t fully comparable across brands. The 🔬 Smash Lab ratings out of 5 come from hands-on stringing and playing.' },
]

/**
 * A small, collapsible glossary for the jargon on every card (repulsion,
 * shock absorption, gauge…). Collapsed by default so experienced players
 * aren't slowed down; one tap for everyone else.
 */
export default function StringBasics({ className = '' }: { className?: string }) {
  return (
    <details className={`group rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/70 dark:bg-white/5 ${className}`}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 text-sm font-semibold text-ink-900 dark:text-shuttle-50 [&::-webkit-details-marker]:hidden">
        <span>New to strings? What the ratings mean</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 pt-1 text-sm sm:grid-cols-2">
        {PERFORMANCE_AXES.map((axis) => (
          <div key={axis.key}>
            <dt className="font-semibold text-ink-900 dark:text-shuttle-50">
              <span aria-hidden="true">{axis.emoji}</span> {axis.label}
            </dt>
            <dd className="text-ink-700/80 dark:text-shuttle-100/80">{AXIS_EXPLANATION[axis.key]}</dd>
          </div>
        ))}
        {EXTRA_TERMS.map((t) => (
          <div key={t.term}>
            <dt className="font-semibold text-ink-900 dark:text-shuttle-50">{t.term}</dt>
            <dd className="text-ink-700/80 dark:text-shuttle-100/80">{t.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
