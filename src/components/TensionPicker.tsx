import { useMemo, useState } from 'react'
import { strings as builtInStrings, type StringItem } from '../data/strings'
import type { QuizAnswers } from '../logic/types'
import { recommendTension } from '../logic/tensionRecommendation'
import { tensionTradeoffs } from '../logic/tensionTradeoffs'
import { formatKg, formatLbs } from '../logic/units'
import { CROSS_OFFSET_KG, DEFAULT_RACKET_MAX_KG } from '../config/tensionRules'
import { TensionFields } from './TensionTuner'

const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Club player' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'tournament', label: 'Tournament' },
]

function gaugeOf(s: StringItem | undefined): number | undefined {
  if (!s) return undefined
  if (s.isHybrid) {
    const g = [s.mainString?.gauge, s.crossString?.gauge].filter((x): x is number => typeof x === 'number')
    return g.length ? Math.min(...g) : undefined
  }
  return s.tension?.gauge
}

/**
 * Tension Picker: the same tension logic as the quiz, on its own — for players who already know
 * their string. A paper racket shows what the number means: drag the slider and the strings
 * tighten, the sweet spot shrinks, and three rule-of-thumb bars show what you gain and give up.
 * The slider never goes past the point where the crosses would exceed the racket's maximum.
 */
export default function TensionPicker({ pool }: { pool?: StringItem[] }) {
  const items = pool ?? builtInStrings
  const [answers, setAnswers] = useState<QuizAnswers>({ level: 'intermediate' })
  const [stringId, setStringId] = useState<string>(items.find((s) => s.id === 'yonex-bg80')?.id ?? items[0]?.id ?? '')
  const string = items.find((s) => s.id === stringId)
  const rec = useMemo(() => recommendTension(answers, string), [answers, string])
  const maxKg = (typeof answers.maxTensionValue === 'number' ? answers.maxTensionValue : DEFAULT_RACKET_MAX_KG) - CROSS_OFFSET_KG
  const [explored, setExplored] = useState<number | null>(null)
  const shown = explored ?? rec.recommendedKg
  const trade = tensionTradeoffs(shown, gaugeOf(string))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center max-w-2xl mx-auto">
        <span className="tape">Tension picker</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">Which tension should you string?</h1>
        <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">Already know your string? Tell us a little about you and your racket.</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="paper p-5 space-y-6" aria-label="About you and your racket">
          <fieldset>
            <legend className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">Your level</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={answers.level === l.id}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, level: l.id }))
                    setExplored(null)
                  }}
                  className={`press focus-ring rounded-full border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer ${
                    answers.level === l.id ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">Your string</span>
            <select
              value={stringId}
              onChange={(e) => {
                setStringId(e.target.value)
                setExplored(null)
              }}
              className="focus-ring mt-2 w-full rounded-xl border-2 border-court-900/15 dark:border-white/20 card-stock px-3 py-2 text-ink-900 dark:text-shuttle-50"
            >
              {items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.name}
                  {gaugeOf(s) != null ? ` — ${gaugeOf(s)} mm` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.restringReason === 'mishitBreakage'}
              onChange={(e) => {
                setAnswers((a) => ({ ...a, restringReason: e.target.checked ? 'mishitBreakage' : undefined }))
                setExplored(null)
              }}
              className="h-4 w-4 accent-shuttle-500"
            />
            My strings often break from mishits
          </label>

          <TensionFields
            answers={answers}
            onChange={(next) => {
              setAnswers(next)
              setExplored(null)
            }}
          />
        </section>

        <section className="paper p-5 text-center" aria-label="Your tension">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">{explored == null ? 'Recommended' : 'Exploring'}</p>
          <p className="font-display text-5xl font-bold text-ink-900 dark:text-shuttle-50">{formatKg(shown)}</p>
          <p className="text-ink-700/80 dark:text-shuttle-100/80">
            ≈ {formatLbs(shown)} · Mains {formatKg(shown - CROSS_OFFSET_KG)} · Crosses {formatKg(shown + CROSS_OFFSET_KG)}
          </p>

          <PaperRacket kg={shown} />

          <label className="block mt-2">
            <span className="sr-only">Explore tensions</span>
            <input
              type="range"
              min={8}
              max={maxKg}
              step={0.5}
              value={shown}
              onChange={(e) => setExplored(Number(e.target.value))}
              className="w-full accent-shuttle-500"
            />
          </label>
          <p className="flex justify-between text-[11px] text-ink-700/70 dark:text-shuttle-100/70">
            <span>{formatKg(8)}</span>
            <span>max {formatKg(maxKg)} (crosses ≤ {formatKg(maxKg + CROSS_OFFSET_KG)})</span>
          </p>
          {explored != null && explored !== rec.recommendedKg && (
            <button type="button" onClick={() => setExplored(null)} className="focus-ring mt-2 text-sm font-semibold text-court-800 dark:text-shuttle-400 underline underline-offset-4 cursor-pointer">
              ↩ Back to {formatKg(rec.recommendedKg)}
            </button>
          )}

          <ul className="mt-5 space-y-2 text-left text-sm">
            <Bar label="Sweet spot & forgiveness" value={trade.sweetSpot} />
            <Bar label="Control (with clean contact)" value={trade.control} />
            <Bar label="Durability" value={trade.durability} />
          </ul>
          <p className="mt-4 text-left text-xs text-ink-700/80 dark:text-shuttle-100/80">{rec.explanation}</p>
          <p className="mt-2 text-left text-[11px] text-ink-700/60 dark:text-shuttle-100/60">Bars are a rule of thumb, not measurements. Never exceed your racket's maximum.</p>
        </section>
      </div>
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <li>
      <span className="flex justify-between text-xs font-semibold text-ink-900 dark:text-shuttle-50">{label}</span>
      <span className="mt-1 block h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
        <span className="block h-full rounded-full bg-shuttle-500 transition-[width] duration-300 [transition-timing-function:steps(3,end)]" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </li>
  )
}

/** A paper racket whose strings tighten with the tension: straighter, denser look, smaller sweet spot. */
function PaperRacket({ kg }: { kg: number }) {
  const t = Math.max(0, Math.min(1, (kg - 8) / 5))
  const sag = 4 * (1 - t) // looser strings bow a little
  const sweet = 0.7 - t * 0.4
  return (
    <svg viewBox="0 0 120 170" className="mx-auto mt-4 w-40 h-auto" role="img" aria-label={`Racket strung at ${kg} kilograms`}>
      <defs>
        <clipPath id="picker-head">
          <ellipse cx="60" cy="62" rx="40" ry="50" />
        </clipPath>
      </defs>
      <ellipse cx="60" cy="62" rx="42" ry="52" className="fill-[#fff8ea]" />
      <ellipse cx="60" cy="62" rx={40 * sweet} ry={50 * sweet} className="fill-shuttle-400/40" />
      <g clipPath="url(#picker-head)" className="stroke-[#ef7410]" strokeWidth={1.2 + t * 0.8} fill="none">
        {[-30, -20, -10, 0, 10, 20, 30].map((dx) => (
          <path key={`v${dx}`} d={`M${60 + dx} 8 Q ${60 + dx + sag} 62 ${60 + dx} 116`} />
        ))}
        {[22, 34, 46, 58, 70, 82, 94, 106].map((y) => (
          <path key={`h${y}`} d={`M14 ${y} Q 60 ${y + sag} 106 ${y}`} />
        ))}
      </g>
      <ellipse cx="60" cy="62" rx="42" ry="52" className="fill-none stroke-[#d5523b]" strokeWidth="6" />
      <rect x="56" y="113" width="8" height="22" className="fill-[#d5523b]" />
      <rect x="54" y="134" width="12" height="32" rx="3" className="fill-ink-700" />
    </svg>
  )
}
