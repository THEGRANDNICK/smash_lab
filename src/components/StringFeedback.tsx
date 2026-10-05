import { useState } from 'react'
import { EMPTY_FEEDBACK, buildFeedbackRow, canSendFeedback, markFeedbackSent, type Balance, type FeedbackInput, type Level, type PlayStyle, type RatingKey } from '../logic/feedback'
import { feedbackAvailable, submitFeedback } from '../services/feedbackService'

const BALANCES: [Balance, string][] = [
  ['headHeavy', 'Head-heavy'],
  ['even', 'Medium balance'],
  ['headLight', 'Head-light'],
]
const LEVELS: [Level, string][] = [
  ['beginner', 'Beginner'],
  ['intermediate', 'Club player'],
  ['advanced', 'Advanced'],
  ['tournament', 'Tournament'],
]
const STYLES: [PlayStyle, string][] = [
  ['attacking', 'Attacking'],
  ['doubles', 'Fast doubles'],
  ['control', 'Control / net'],
  ['defensive', 'Defensive'],
  ['allRound', 'All-round'],
]
const RATINGS: [RatingKey, string][] = [
  ['power', 'Power'],
  ['control', 'Control'],
  ['comfort', 'Comfort'],
  ['durability', 'Durability'],
]

/**
 * "Played with this string? Tell us" — optional feedback that makes the hands-on data broader
 * than one person's view. Every field is optional; no name or e-mail is asked for.
 */
export default function StringFeedback({ stringId, stringName }: { stringId: string; stringName: string }) {
  const [input, setInput] = useState<FeedbackInput>(EMPTY_FEEDBACK)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const storage = typeof window === 'undefined' ? null : window.localStorage
  const set = (patch: Partial<FeedbackInput>) => setInput((i) => ({ ...i, ...patch }))

  if (!feedbackAvailable()) return null

  async function send() {
    if (!canSendFeedback(storage, stringId)) {
      setState('error')
      setMessage('Thanks — you already sent feedback on this string today.')
      return
    }
    const built = buildFeedbackRow(stringId, input)
    if (!built.ok) {
      setState('error')
      setMessage(built.error)
      return
    }
    setState('sending')
    const result = await submitFeedback(built.row)
    if (result.ok) {
      markFeedbackSent(storage, stringId)
      setState('sent')
      setMessage(null)
    } else {
      setState('error')
      setMessage('Could not send right now — please try again later.')
    }
  }

  return (
    <details className="paper group mt-5">
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display font-bold text-ink-900 dark:text-shuttle-50">Played with {stringName}? Tell us</span>
          <span className="block text-xs text-ink-700/80 dark:text-shuttle-100/80">Optional, anonymous, 30 seconds — it makes the ratings less one person's view.</span>
        </span>
        <span aria-hidden="true" className="text-shuttle-700 dark:text-shuttle-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="px-5 pb-5">
        {state === 'sent' ? (
          <p role="status" className="rounded-xl bg-emerald-600/10 p-4 font-semibold text-emerald-800 dark:text-emerald-300">
            ✓ Thank you! Your feedback helps make the ratings better.
          </p>
        ) : (
          <div className="space-y-5 text-sm">
            <fieldset>
              <legend className="font-semibold text-ink-900 dark:text-shuttle-50">Your racket</legend>
              <input
                type="text"
                value={input.racketName}
                maxLength={80}
                onChange={(e) => set({ racketName: e.target.value })}
                placeholder="Name, e.g. Astrox 88D Pro (optional)"
                aria-label="Racket name"
                className="focus-ring mt-2 w-full rounded-lg border-2 border-court-900/15 dark:border-white/20 card-stock px-3 py-2 text-ink-900 dark:text-shuttle-50"
              />
              <Chips options={BALANCES} value={input.racketBalance} onChange={(v) => set({ racketBalance: v })} label="Racket balance" />
            </fieldset>

            <fieldset>
              <legend className="font-semibold text-ink-900 dark:text-shuttle-50">Your tension</legend>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={input.tension}
                  onChange={(e) => set({ tension: e.target.value })}
                  placeholder={input.tensionUnit === 'kg' ? 'e.g. 11.5' : 'e.g. 25'}
                  aria-label="Tension"
                  className="focus-ring w-24 rounded-lg border-2 border-court-900/15 dark:border-white/20 card-stock px-3 py-2 text-ink-900 dark:text-shuttle-50"
                />
                <Chips options={[['kg', 'kg'], ['lbs', 'lbs']] as ['kg' | 'lbs', string][]} value={input.tensionUnit} onChange={(v) => set({ tensionUnit: v ?? 'kg' })} label="Unit" required />
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-semibold text-ink-900 dark:text-shuttle-50">You</legend>
              <Chips options={LEVELS} value={input.level} onChange={(v) => set({ level: v })} label="Level" />
              <Chips options={STYLES} value={input.playStyle} onChange={(v) => set({ playStyle: v })} label="Playing style" />
            </fieldset>

            <fieldset>
              <legend className="font-semibold text-ink-900 dark:text-shuttle-50">How did it play? (1 = poor, 5 = great)</legend>
              <div className="mt-2 space-y-2">
                {RATINGS.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-20 text-ink-700/90 dark:text-shuttle-100/90">{label}</span>
                    <div role="group" aria-label={label} className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={input.ratings[key] === n}
                          onClick={() => set({ ratings: { ...input.ratings, [key]: input.ratings[key] === n ? undefined : n } })}
                          className={`focus-ring h-8 w-8 rounded-full border-2 text-xs font-bold cursor-pointer ${
                            input.ratings[key] === n ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">Anything else?</span>
              <textarea
                value={input.comment}
                maxLength={500}
                rows={3}
                onChange={(e) => set({ comment: e.target.value })}
                placeholder="e.g. great control, but broke after 6 weeks (optional)"
                className="focus-ring mt-2 w-full rounded-lg border-2 border-court-900/15 dark:border-white/20 card-stock px-3 py-2 text-ink-900 dark:text-shuttle-50"
              />
            </label>

            {/* honeypot: invisible to people, tempting for bots */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={input.website} onChange={(e) => set({ website: e.target.value })} className="hidden" name="website" />

            {message && (
              <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-400">
                {message}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={send} disabled={state === 'sending'} className="press focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold px-5 py-2.5 cursor-pointer disabled:opacity-50">
                {state === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
              <span className="text-xs text-ink-700/70 dark:text-shuttle-100/70">No name or e-mail — just what you tell us here.</span>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

function Chips<T extends string>({ options, value, onChange, label, required = false }: { options: [T, string][]; value?: T; onChange: (v: T | undefined) => void; label: string; required?: boolean }) {
  return (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-2">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(value === id && !required ? undefined : id)}
          className={`focus-ring rounded-full border-2 px-3 py-1 text-xs font-semibold cursor-pointer ${
            value === id ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
