import { useMemo, useState } from 'react'
import { strings } from '../data/strings'
import StringCard from './StringCard'

type CategoryFilter = 'all' | 'repulsion' | 'control' | 'durability'

export default function StringComparison() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [brand, setBrand] = useState<string>('all')
  const [availableOnly, setAvailableOnly] = useState(false)

  const brands = useMemo(() => Array.from(new Set(strings.map((s) => s.brand))).sort(), [])

  const filtered = strings.filter((s) => {
    if (category !== 'all' && s.category !== category) return false
    if (brand !== 'all' && s.brand !== brand) return false
    if (availableOnly && s.stock === 'unavailable') return false
    return true
  })

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

      {filtered.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No strings match those filters right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <StringCard key={item.id} item={item} />
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
