import { useMemo, useState } from 'react'
import { strings, type StringItem } from '../data/strings'
import { sortStrings, SORT_OPTIONS, type SortOption } from '../logic/sortStrings'
import { getPerformanceValues, RADAR_COMPARE_COLORS } from './performanceAxes'
import StringCard, { type PerformanceView } from './StringCard'
import RadarChart from './RadarChart'

type CategoryFilter = 'all' | 'repulsion' | 'control' | 'durability'

const MAX_COMPARE = 3

export default function StringComparison() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [brand, setBrand] = useState<string>('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('recommended')
  const [view, setView] = useState<PerformanceView>('bars')
  const [compareIds, setCompareIds] = useState<string[]>([])

  const brands = useMemo(() => Array.from(new Set(strings.map((s) => s.brand))).sort(), [])

  const filtered = strings.filter((s) => {
    if (category !== 'all' && s.category !== category) return false
    if (brand !== 'all' && s.brand !== brand) return false
    if (availableOnly && s.stock === 'unavailable') return false
    return true
  })

  const sorted = sortStrings(filtered, sortBy)
  const compareItems = compareIds.map((id) => strings.find((s) => s.id === id)).filter((s): s is StringItem => s != null)

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

  return (
    <section id="strings" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">The lineup</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Browse every string</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          Not into quizzes? Compare the full lineup directly — repulsion, control, durability, sound and comfort, side by side.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-8" role="group" aria-label="Filter strings">
        <FilterPills
          value={category}
          onChange={setCategory}
          options={[
            { id: 'all', label: 'All' },
            { id: 'repulsion', label: '🚀 Quick Repulsion' },
            { id: 'control', label: '🎯 Control' },
            { id: 'durability', label: '🧵 Durability' },
          ]}
        />
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
          aria-label="Filter by brand"
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="focus-ring w-4 h-4 accent-shuttle-500"
          />
          Available now
        </label>
      </div>

      <div className="flex flex-col items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50">
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
            aria-label="Sort strings"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {sortBy === 'popularity' && (
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
            ★ Popular with players I string for at my club — not a global sales ranking.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50">
          Performance view
          <div className="flex rounded-full border-2 border-court-900/10 dark:border-white/15 overflow-hidden" role="group" aria-label="Performance view">
            {(['bars', 'radar'] as PerformanceView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`focus-ring px-4 py-2 text-sm font-semibold capitalize cursor-pointer transition-colors ${
                  view === v ? 'bg-court-800 text-white' : 'bg-white/80 dark:bg-white/5 text-ink-900 dark:text-shuttle-50 hover:bg-shuttle-50 dark:hover:bg-white/10'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 text-center max-w-md">
          Performance ratings are based on manufacturer data. Playing-feel descriptions below add practical, real-world nuance.
        </p>
      </div>

      {compareItems.length > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-shuttle-500/40 bg-shuttle-100/60 dark:bg-shuttle-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-court-800 dark:text-shuttle-400">
                Comparing {compareItems.length} string{compareItems.length > 1 ? 's' : ''}
              </p>
              {compareItems.map((item, i) => (
                <span key={item.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900 dark:text-shuttle-50">
                  <span className={`w-2.5 h-2.5 rounded-full ${RADAR_COMPARE_COLORS[i].dotClassName}`} aria-hidden="true" />
                  {item.name}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="focus-ring text-xs font-semibold text-ink-700/60 dark:text-shuttle-100/60 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
            >
              Clear comparison
            </button>
          </div>
          {compareItems.length === 1 ? (
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">Pick one more string (up to {MAX_COMPARE}) to see them overlaid.</p>
          ) : (
            <RadarChart
              size={280}
              series={compareItems.map((item, i) => ({
                id: item.id,
                label: item.name,
                values: getPerformanceValues(item),
                strokeClassName: RADAR_COMPARE_COLORS[i].strokeClassName,
                fillClassName: RADAR_COMPARE_COLORS[i].fillClassName,
              }))}
            />
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No strings match those filters right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => (
            <StringCard
              key={item.id}
              item={item}
              view={view}
              compareSelected={compareIds.includes(item.id)}
              compareDisabled={compareIds.length >= MAX_COMPARE}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            value === opt.id
              ? 'bg-court-800 text-white'
              : 'bg-white/80 dark:bg-white/5 border-2 border-court-900/10 dark:border-white/15 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </>
  )
}
