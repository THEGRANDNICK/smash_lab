import { useState } from 'react'
import { motion } from 'framer-motion'
import { kgToLbs, lbsToKg } from '../logic/units'
import type { TensionUnit } from '../logic/types'

interface TensionInputStepProps {
  title: string
  subtitle?: string
  valueKg?: number
  onChange: (kg: number | undefined) => void
  min?: number
  max?: number
}

/** Parses a raw input string (accepting either "." or "," as the decimal separator) into kg, or undefined if it isn't a complete number yet. */
function parseToKg(raw: string, unit: TensionUnit): number | undefined {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') return undefined
  const num = Number(normalized)
  if (!Number.isFinite(num)) return undefined
  return unit === 'kg' ? num : lbsToKg(num)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export default function TensionInputStep({ title, subtitle, valueKg, onChange, min = 5, max = 20 }: TensionInputStepProps) {
  const [unit, setUnit] = useState<TensionUnit>('kg')
  // The text the user is actively typing lives in its own state, decoupled from
  // valueKg — deriving it straight from valueKg on every keystroke was what
  // snapped "11." back to "11" and made decimals impossible to type.
  const [rawText, setRawText] = useState(() => (valueKg == null ? '' : String(round1(valueKg))))

  const parsedKg = parseToKg(rawText, unit)
  // Rounded to the same 1-decimal precision the rest of the app displays kg
  // at, so a converted lbs boundary (e.g. 44.1 lbs, ~20.0018 kg) isn't
  // rejected by float drift from its own kg equivalent.
  const inRange = (kg: number) => round1(kg) >= min && round1(kg) <= max
  const outOfRange = parsedKg != null && !inRange(parsedKg)

  function handleInput(raw: string) {
    setRawText(raw)
    const kg = parseToKg(raw, unit)
    onChange(kg != null && inRange(kg) ? kg : undefined)
  }

  function handleUnitChange(nextUnit: TensionUnit) {
    const currentKg = parseToKg(rawText, unit)
    setUnit(nextUnit)
    setRawText(currentKg == null ? '' : String(round1(nextUnit === 'kg' ? currentKg : kgToLbs(currentKg))))
  }

  const converted = parsedKg != null ? (unit === 'kg' ? `≈ ${round1(kgToLbs(parsedKg))} lbs` : `≈ ${round1(parsedKg)} kg`) : null
  const minLbs = Math.round(kgToLbs(min))
  const maxLbs = Math.round(kgToLbs(max))

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{title}</h2>
      {subtitle && <p className="text-ink-700/70 dark:text-shuttle-100/70 mb-6">{subtitle}</p>}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-6">
        <div className="flex items-stretch gap-3 max-w-sm">
          <input
            type="text"
            inputMode="decimal"
            value={rawText}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={unit === 'kg' ? 'e.g. 10' : 'e.g. 22'}
            aria-label={`Tension in ${unit}`}
            aria-invalid={outOfRange}
            className="focus-ring flex-1 min-w-0 rounded-xl border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-3 text-lg font-semibold text-ink-900 dark:text-shuttle-50"
          />
          <div className="flex rounded-xl border-2 border-court-900/10 dark:border-white/15 overflow-hidden shrink-0" role="group" aria-label="Unit">
            {(['kg', 'lbs'] as TensionUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                className={`focus-ring px-4 py-2 font-semibold text-sm cursor-pointer transition-colors ${
                  unit === u ? 'bg-court-800 text-white' : 'bg-white/80 dark:bg-white/5 text-ink-900 dark:text-shuttle-50'
                }`}
                aria-pressed={unit === u}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        {outOfRange ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Please enter a tension between {min} and {max} kg ({minLbs}–{maxLbs} lbs).
          </p>
        ) : (
          converted && <p className="mt-3 text-sm text-ink-700/60 dark:text-shuttle-100/60">{converted}</p>
        )}
      </motion.div>
    </div>
  )
}
