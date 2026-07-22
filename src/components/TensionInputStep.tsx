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

export default function TensionInputStep({ title, subtitle, valueKg, onChange, min = 5, max = 15 }: TensionInputStepProps) {
  const [unit, setUnit] = useState<TensionUnit>('kg')
  const displayValue = valueKg == null ? '' : unit === 'kg' ? round1(valueKg) : round1(kgToLbs(valueKg))

  function handleInput(raw: string) {
    if (raw.trim() === '') {
      onChange(undefined)
      return
    }
    const num = Number(raw)
    if (Number.isNaN(num)) return
    onChange(unit === 'kg' ? num : lbsToKg(num))
  }

  function handleUnitChange(next: TensionUnit) {
    setUnit(next)
  }

  const converted = valueKg != null ? (unit === 'kg' ? `≈ ${round1(kgToLbs(valueKg))} lbs` : `≈ ${round1(valueKg)} kg`) : null

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{title}</h2>
      {subtitle && <p className="text-ink-700/70 dark:text-shuttle-100/70 mb-6">{subtitle}</p>}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-6">
        <div className="flex items-stretch gap-3 max-w-sm">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={unit === 'kg' ? min : round1(kgToLbs(min))}
            max={unit === 'kg' ? max : round1(kgToLbs(max))}
            value={displayValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={unit === 'kg' ? 'e.g. 10' : 'e.g. 22'}
            aria-label={`Tension in ${unit}`}
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
        {converted && <p className="mt-3 text-sm text-ink-700/60 dark:text-shuttle-100/60">{converted}</p>}
      </motion.div>
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
