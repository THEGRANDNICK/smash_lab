import { useMemo } from 'react'
import { useSessionState } from '../hooks/useSessionState'
import { writeWorkshopPreset } from '../logic/workshopPreset'
import { strings as defaultStrings, type StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { sortStrings, SORT_OPTIONS, type SortOption } from '../logic/sortStrings'
import { type PerformanceView } from './StringCard'
import StringTile from './StringTile'
import StringBasics from './StringBasics'

type CategoryFilter = 'all' | 'repulsion' | 'control' | 'durability'


interface StringComparisonProps {
  /** Defaults to the static catalog import when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. */
  strings?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Omitted or empty renders no purchase options. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

export default function StringComparison({ strings: stringsProp, retailerListingsByStringId }: StringComparisonProps) {
  const strings = stringsProp ?? defaultStrings
  // Filters survive a visit to a string page and "back to all strings" (sessionStorage).
  const [category, setCategory] = useSessionState<CategoryFilter>('smashlab.lineup.category', 'all')
  const [brand, setBrand] = useSessionState<string>('smashlab.lineup.brand', 'all')
  const [availableOnly, setAvailableOnly] = useSessionState<boolean>('smashlab.lineup.available', false)
  const [sortBy, setSortBy] = useSessionState<SortOption>('smashlab.lineup.sort', 'recommended', (v): v is SortOption => SORT_OPTIONS.some((o) => o.id === v))
  const [view, setView] = useSessionState<PerformanceView>('smashlab.lineup.view', 'bars')


  const brands = useMemo(() => Array.from(new Set(strings.map((s) => s.brand))).sort(), [strings])

  const filtered = strings.filter((s) => {
    if (category !== 'all' && s.category !== category) return false
    if (brand !== 'all' && s.brand !== brand) return false
    if (availableOnly && s.stock === 'unavailable') return false
    return true
  })

  const sorted = sortStrings(filtered, sortBy, retailerListingsByStringId)

  // The comparison panel renders above the whole grid — often thousands of pixels away from the
  // card whose "+ Compare" was just clicked. Track whether it's on screen, and if not, show a
  // sticky bar so the selection is visible and one tap away.


  return (
    <section id="strings" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-8">
        <p className="tape">The lineup</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Browse every string</h2>
        <p className="hidden sm:block text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          Not into quizzes? Compare the full lineup directly — repulsion, control, durability, sound and comfort, side by side.
        </p>
      </div>

      {/* One compact toolbar instead of four stacked control blocks: on a phone the filters are a
          single swipeable row and brand / sort / view share the second row. */}
      <div className="mb-4 space-y-2">
        <div role="group" aria-label="Filter strings" className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:justify-center sm:flex-wrap sm:overflow-visible">
          <FilterPills
            value={category}
            onChange={setCategory}
            options={[
              { id: 'all', label: 'All' },
              { id: 'repulsion', label: '🚀 Repulsion' },
              { id: 'control', label: '🎯 Control' },
              { id: 'durability', label: '🧵 Durability' },
            ]}
          />
          <label className="shrink-0 whitespace-nowrap flex items-center gap-2 rounded-full border-2 border-court-900/10 dark:border-white/15 card-stock px-3 py-1.5 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="focus-ring w-4 h-4 accent-shuttle-500" />
            Available now
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 card-stock px-3 py-1.5 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
            aria-label="Filter by brand"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="focus-ring max-w-[11rem] rounded-full border-2 border-court-900/10 dark:border-white/15 card-stock px-3 py-1.5 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
            aria-label="Sort strings"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.id === 'recommended' ? 'Sort: Recommended' : opt.label}
              </option>
            ))}
          </select>
          <div className="flex rounded-full border-2 border-court-900/10 dark:border-white/15 overflow-hidden" role="group" aria-label="Performance view">
            {(['bars', 'radar'] as PerformanceView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`focus-ring px-3 py-1.5 text-sm font-semibold capitalize cursor-pointer transition-colors ${
                  view === v ? 'bg-court-800 text-white' : 'card-stock text-ink-900 dark:text-shuttle-50 hover:bg-shuttle-50 dark:hover:bg-white/10'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {sortBy === 'popularity' && <p className="text-center text-xs text-ink-700/70 dark:text-shuttle-100/70">★ Popular among players at my club — not a global sales ranking.</p>}
      </div>

      <StringBasics className="mb-5 max-w-3xl mx-auto" />

      {sorted.length === 0 ? (
        <p className="text-center text-ink-700/70 dark:text-shuttle-100/70 py-12">No strings match these filters. Try another category or turn off “Available now”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {sorted.map((item, index) => (
            <StringTile
              key={item.id}
              index={index}
              item={item}
              view={view}
              onTryInWorkshop={(id) => {
                writeWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage, { stringId: id, tensionKg: 11.5 })
                window.location.hash = 'workshop'
              }}
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
          className={`focus-ring shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
            value === opt.id
              ? 'bg-court-800 text-white'
              : 'card-stock border-2 border-court-900/10 dark:border-white/15 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </>
  )
}
