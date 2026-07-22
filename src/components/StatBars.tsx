import type { StringItem } from '../data/strings'

const STATS: { key: keyof Pick<StringItem, 'repulsion' | 'durability' | 'hittingSound' | 'shockAbsorption' | 'control'>; label: string; emoji: string }[] = [
  { key: 'repulsion', label: 'Repulsion', emoji: '🚀' },
  { key: 'control', label: 'Control', emoji: '🎯' },
  { key: 'durability', label: 'Durability', emoji: '🧵' },
  { key: 'hittingSound', label: 'Hitting sound', emoji: '🔊' },
  { key: 'shockAbsorption', label: 'Shock absorption', emoji: '🤲' },
]

const MAX = 11

export default function StatBars({ item, compact = false }: { item: StringItem; compact?: boolean }) {
  return (
    <div className="space-y-2">
      {STATS.map((stat) => {
        const value = item[stat.key]
        return (
          <div key={stat.key} className="flex items-center gap-2 text-sm">
            <span className={`w-6 text-center shrink-0 ${compact ? 'text-xs' : ''}`} aria-hidden="true">
              {stat.emoji}
            </span>
            <span className="w-32 shrink-0 text-ink-700/70 dark:text-shuttle-100/70">{stat.label}</span>
            <span className="flex-1 h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden" role="img" aria-label={`${stat.label}: ${value == null ? 'unknown' : `${value} out of ${MAX}`}`}>
              {value != null && (
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-court-700 to-court-600 dark:from-shuttle-500 dark:to-shuttle-400"
                  style={{ width: `${(value / MAX) * 100}%` }}
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
