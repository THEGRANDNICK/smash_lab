import type { StringItem } from '../data/strings'
import { PERFORMANCE_AXES, PERFORMANCE_MAX, getPerformanceValues } from './performanceAxes'

export default function StatBars({ item, compact = false }: { item: StringItem; compact?: boolean }) {
  const values = getPerformanceValues(item)
  return (
    <div className="space-y-2">
      {PERFORMANCE_AXES.map((axis) => {
        const value = values[axis.key]
        return (
          <div key={axis.key} className="flex items-center gap-2 text-sm">
            <span className={`w-6 text-center shrink-0 ${compact ? 'text-xs' : ''}`} aria-hidden="true">
              {axis.emoji}
            </span>
            <span className="w-32 shrink-0 text-ink-700/70 dark:text-shuttle-100/70">{axis.label}</span>
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
            <span className="w-8 text-right tabular-nums text-xs text-ink-700/60 dark:text-shuttle-100/60">{value ?? '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
