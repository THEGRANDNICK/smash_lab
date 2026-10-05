import { useState } from 'react'

const LB = 0.45359237

interface RacketMaxInputProps {
  /** Current maximum in kg (undefined = not checked yet). */
  valueKg?: number
  onChange: (kg: number) => void
  className?: string
}

/**
 * The racket's maximum tension, in kg (default, like everything else on the site) or lbs (what's
 * usually printed on the shaft, e.g. "20–28 lbs" → 28). Plausible range only: 6.5–18 kg / 14–40 lbs.
 */
export default function RacketMaxInput({ valueKg, onChange, className = '' }: RacketMaxInputProps) {
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg')
  const shown = valueKg == null ? '' : unit === 'kg' ? valueKg.toFixed(1) : String(Math.round(valueKg / LB))

  function commit(raw: string) {
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    const kg = unit === 'kg' ? n : n * LB
    if (kg < 6.5 || kg > 18) return
    onChange(Math.round(kg * 10) / 10)
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <label className="flex items-center gap-2">
        <span className="font-semibold text-ink-900 dark:text-shuttle-50">My racket's max:</span>
        <input
          key={`${unit}-${valueKg ?? 'none'}`}
          type="text"
          inputMode="decimal"
          defaultValue={shown}
          placeholder={unit === 'kg' ? 'e.g. 12.7' : 'e.g. 28'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
          }}
          onBlur={(e) => commit(e.target.value)}
          className="focus-ring w-20 rounded-lg border-2 border-court-900/20 dark:border-white/25 card-stock px-2 py-1 text-ink-900 dark:text-shuttle-50"
        />
      </label>
      <span className="flex rounded-full border-2 border-court-900/15 dark:border-white/20 overflow-hidden" role="group" aria-label="Unit">
        {(['kg', 'lbs'] as const).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => setUnit(u)}
            className={`focus-ring px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${unit === u ? 'bg-court-800 text-white dark:bg-shuttle-500 dark:text-court-900' : 'text-ink-900 dark:text-shuttle-50'}`}
          >
            {u}
          </button>
        ))}
      </span>
      <span className="text-xs text-ink-700/80 dark:text-shuttle-100/80">{valueKg != null ? '✓ checked' : 'not checked — 12.5 kg assumed'}</span>
    </div>
  )
}
