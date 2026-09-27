import { useState } from 'react'
import type { StringItem } from '../data/strings'
import { AXIS_EXPLANATION, PERFORMANCE_AXES, PERFORMANCE_MAX, getPerformanceValues } from './performanceAxes'

export default function StatBars({ item, compact = false }: { item: StringItem; compact?: boolean }) {
  const values = getPerformanceValues(item)
  // Tapping a label shows what it means — hover tooltips (title) don't exist on phones.
  const [explained, setExplained] = useState<string | null>(null)
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {PERFORMANCE_AXES.map((axis) => {
        const value = values[axis.key]
        return (
          <div key={axis.key}>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-6 text-center shrink-0 ${compact ? 'text-xs' : ''}`} aria-hidden="true">
              {axis.emoji}
            </span>
            <button
              type="button"
              onClick={() => setExplained((cur) => (cur === axis.key ? null : axis.key))}
              aria-expanded={explained === axis.key}
              title={AXIS_EXPLANATION[axis.key]}
              className="focus-ring w-32 shrink-0 rounded text-left text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-help"
            >
              {axis.label} <span aria-hidden="true" className="text-[10px]">ⓘ</span>
              <span className="sr-only"> (what does this mean?)</span>
            </button>
            <span
              className="flex-1 h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden"
              role="img"
              aria-label={`${axis.label}: ${value == null ? 'unknown' : `${value} out of ${PERFORMANCE_MAX}`}`}
            >
              {value != null && (
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-court-700 to-court-600 dark:from-shuttle-500 dark:to-shuttle-400"
                  style={{ width: `${(value / PERFORMANCE_MAX) * 100}%` }}
                />
              )}
            </span>
            <span className="w-8 text-right tabular-nums text-xs text-ink-700/70 dark:text-shuttle-100/60">{value ?? '—'}</span>
          </div>
          {explained === axis.key && <p className="mt-1 mb-2 pl-8 text-xs text-ink-700/80 dark:text-shuttle-100/80">{AXIS_EXPLANATION[axis.key]}</p>}
          </div>
        )
      })}
    </div>
  )
}
