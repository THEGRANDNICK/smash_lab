import { useEffect, useMemo, useRef, useState } from 'react'
import { strings as defaultStrings, type StringItem } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import type { RetailerListing } from '../services/retailerPriceService'
import { sortStrings, SORT_OPTIONS, type SortOption } from '../logic/sortStrings'
import { getPerformanceValues, RADAR_COMPARE_COLORS } from './performanceAxes'
import { readStoredComparisonView, writeStoredComparisonView, type ComparisonView } from '../logic/comparisonViewPreference'
import { consumePendingComparisonSelection } from '../logic/pendingComparisonSelection'
import { type PerformanceView } from './StringCard'
import StringTile from './StringTile'
import RadarChart from './RadarChart'
import ComparisonTable from './ComparisonTable'
import ComparisonOverlayBars from './ComparisonOverlayBars'
import StringMap from './StringMap'
import StringBasics from './StringBasics'

type CategoryFilter = 'all' | 'repulsion' | 'control' | 'durability'

const MAX_COMPARE = 3

interface StringComparisonProps {
  /** Defaults to the static catalog import when omitted — pass the live, Supabase-merged array from useStringPool() to reflect current stock. */
  strings?: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Purchase options, keyed by string id, from useRetailerPrices(). Omitted or empty renders no purchase options. */
  retailerListingsByStringId?: Record<string, RetailerListing[]>
}

export default function StringComparison({ strings: stringsProp, specialistProfiles, retailerListingsByStringId }: StringComparisonProps) {
  const strings = stringsProp ?? defaultStrings
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [brand, setBrand] = useState<string>('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('recommended')
  const [view, setView] = useState<PerformanceView>('bars')
  const [compareIds, setCompareIds] = useState<string[]>(() => consumePendingComparisonSelection(typeof window === 'undefined' ? null : window.sessionStorage))
  const [compareView, setCompareView] = useState<ComparisonView>(() => readStoredComparisonView(typeof window === 'undefined' ? null : window.sessionStorage))
  const [radarShowMore, setRadarShowMore] = useState(false)

  function chooseCompareView(next: ComparisonView) {
    setCompareView(next)
    writeStoredComparisonView(typeof window === 'undefined' ? null : window.sessionStorage, next)
  }

  const brands = useMemo(() => Array.from(new Set(strings.map((s) => s.brand))).sort(), [strings])

  const filtered = strings.filter((s) => {
    if (category !== 'all' && s.category !== category) return false
    if (brand !== 'all' && s.brand !== brand) return false
    if (availableOnly && s.stock === 'unavailable') return false
    return true
  })

  const sorted = sortStrings(filtered, sortBy, retailerListingsByStringId)
  const compareItems = compareIds.map((id) => strings.find((s) => s.id === id)).filter((s): s is StringItem => s != null)

  // The comparison panel renders above the whole grid — often thousands of pixels away from the
  // card whose "+ Compare" was just clicked. Track whether it's on screen, and if not, show a
  // sticky bar so the selection is visible and one tap away.
  const panelRef = useRef<HTMLDivElement>(null)
  const hasSelection = compareItems.length > 0
  const [panelVisible, setPanelVisible] = useState(false)
  useEffect(() => {
    const el = panelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting), { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasSelection])

  function jumpToPanel() {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    panelRef.current?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

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

      {compareItems.length > 0 && (
        <div ref={panelRef} className="mb-8 scroll-mt-24 rounded-2xl border-2 border-shuttle-500/40 bg-shuttle-100/60 dark:bg-shuttle-500/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 tabIndex={-1} className="font-display text-lg font-bold text-court-800 dark:text-shuttle-400 outline-none">
              Comparing {compareItems.length} string{compareItems.length > 1 ? 's' : ''}
            </h3>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="focus-ring shrink-0 rounded-full border-2 border-court-900/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-ink-700/70 dark:text-shuttle-100/70 hover:border-shuttle-400 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer transition-colors"
            >
              Clear comparison
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {compareItems.map((item, i) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full card-stock border border-court-900/10 dark:border-white/15 pl-1.5 pr-1 py-1 text-xs font-semibold text-ink-900 dark:text-shuttle-50"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${RADAR_COMPARE_COLORS[i].dotClassName}`} aria-hidden="true" title="Chart series color — identifies this string in the radar/table" />
                <span className="truncate max-w-[10rem]">{item.name}</span>
                <button
                  type="button"
                  onClick={() => toggleCompare(item.id)}
                  aria-label={`Remove ${item.name} from comparison`}
                  className="focus-ring shrink-0 rounded-full w-5 h-5 flex items-center justify-center text-ink-700/70 dark:text-shuttle-100/50 hover:bg-court-900/10 dark:hover:bg-white/15 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </span>
            ))}
          </div>

          {compareItems.length === 1 ? (
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">Pick one more string (up to {MAX_COMPARE}) to see them side by side.</p>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-5">
                <div className="flex rounded-full border-2 border-court-900/10 dark:border-white/15 overflow-hidden" role="group" aria-label="Comparison view">
                  {(['radar', 'map', 'table'] as ComparisonView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => chooseCompareView(v)}
                      aria-pressed={compareView === v}
                      className={`focus-ring px-5 py-2 text-sm font-semibold capitalize cursor-pointer transition-colors ${
                        compareView === v
                          ? 'bg-court-800 text-white'
                          : 'card-stock text-ink-900 dark:text-shuttle-50 hover:bg-shuttle-50 dark:hover:bg-white/10'
                      }`}
                    >
                      {v === 'radar' ? 'Radar' : v === 'map' ? 'Feel map' : 'Table'}
                    </button>
                  ))}
                </div>
              </div>

              {compareView === 'radar' && (
                <div className="space-y-6">
                  <div className="flex justify-center -mx-4 sm:-mx-5">
                    <RadarChart
                      size={360}
                      showValues
                      maxWidthClassName="max-w-[440px] sm:max-w-[620px] lg:max-w-[760px] xl:max-w-[840px]"
                      series={compareItems.map((item, i) => ({
                        id: item.id,
                        label: item.name,
                        values: getPerformanceValues(item),
                        strokeClassName: RADAR_COMPARE_COLORS[i].strokeClassName,
                        fillClassName: RADAR_COMPARE_COLORS[i].fillClassName,
                      }))}
                    />
                  </div>
                  <ComparisonOverlayBars items={compareItems} />
                  <div>
                    <button
                      type="button"
                      onClick={() => setRadarShowMore((s) => !s)}
                      aria-expanded={radarShowMore}
                      className="focus-ring text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline cursor-pointer"
                    >
                      {radarShowMore ? 'Show fewer details' : 'Show more details'}
                    </button>
                    {radarShowMore && (
                      <div className="mt-4">
                        <ComparisonTable items={compareItems} specialistProfiles={specialistProfiles} retailerListingsByStringId={retailerListingsByStringId} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {compareView === 'map' && (
                <div className="max-w-md mx-auto">
                  <StringMap items={compareItems} specialistProfiles={specialistProfiles} selectedIds={compareIds} selectionFull={compareIds.length >= MAX_COMPARE} onToggleSelect={toggleCompare} />
                </div>
              )}

              {compareView === 'table' && <ComparisonTable items={compareItems} specialistProfiles={specialistProfiles} retailerListingsByStringId={retailerListingsByStringId} />}
            </div>
          )}
        </div>
      )}

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
              compareSelected={compareIds.includes(item.id)}
              compareDisabled={compareIds.length >= MAX_COMPARE}
              onToggleCompare={toggleCompare}
            />
          ))}
        </div>
      )}

      {compareItems.length > 0 && !panelVisible && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 pointer-events-none">
          <div
            role="region"
            aria-label="Strings selected for comparison"
            className="pointer-events-auto mx-auto max-w-xl flex items-center gap-3 rounded-2xl border-2 border-shuttle-500 bg-court-900 text-white shadow-2xl px-4 py-3"
          >
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-bold">
                {compareItems.length} of {MAX_COMPARE} selected
              </span>
              <span className="block truncate text-white/70">{compareItems.map((i) => i.name).join(', ')}</span>
            </p>
            <button type="button" onClick={() => setCompareIds([])} className="focus-ring shrink-0 text-xs font-semibold text-white/70 hover:text-white cursor-pointer">
              Clear
            </button>
            <button
              type="button"
              onClick={jumpToPanel}
              className="focus-ring shrink-0 rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 text-sm font-bold px-4 py-2 cursor-pointer"
            >
              {compareItems.length === 1 ? 'View' : 'Compare now'}
            </button>
          </div>
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
