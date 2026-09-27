import { DATA_SOURCE_OPTIONS, type DataSource } from '../logic/dataSourcePreference'

const SHORT_LABEL: Record<DataSource, string> = {
  'manufacturer-specialist': 'Smash Lab calibrated',
  'manufacturer-only': 'Manufacturer data only',
}

/**
 * Compact switch shown above the podium. Replaces the old "Which data should
 * we base this on?" quiz step: the default (calibrated) is what nearly
 * everyone wants, and here the player sees immediately what the choice does.
 */
export default function DataSourceSwitch({ value, onChange }: { value: DataSource; onChange: (next: DataSource) => void }) {
  const active = DATA_SOURCE_OPTIONS.find((o) => o.id === value)
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div role="radiogroup" aria-label="Ranking based on" className="inline-flex rounded-full border-2 border-court-900/10 dark:border-white/15 p-0.5 text-xs font-semibold">
        {(['manufacturer-specialist', 'manufacturer-only'] as DataSource[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className={`focus-ring rounded-full px-3 py-1 transition-colors cursor-pointer ${
              value === id ? 'bg-shuttle-500 text-court-900' : 'text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50'
            }`}
          >
            {SHORT_LABEL[id]}
          </button>
        ))}
      </div>
      {active && <p className="text-center text-[11px] text-ink-700/70 dark:text-shuttle-100/50 max-w-md">{active.blurb}</p>}
    </div>
  )
}
