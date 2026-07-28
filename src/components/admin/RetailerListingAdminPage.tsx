import { useEffect, useMemo, useState } from 'react'
import RetailerListingAdminCard from './RetailerListingAdminCard'
import RetailerListingForm from './RetailerListingForm'
import {
  fetchAdminRetailerListings,
  createRetailerListing,
  emptyRetailerListingFormInput,
  type AdminRetailerListingRow,
  type ValidatedRetailerListingPayload,
  type RetailerOption,
} from '../../services/retailerListingAdminService'
import { AVAILABILITY_LABELS, RETAILER_AVAILABILITY_STATUSES } from '../../services/retailerPriceService'
import type { RetailerAvailabilityStatus } from '../../types/database'

type LoadState = 'loading' | 'loaded' | 'error'
type SortOption = 'string' | 'retailer' | 'price' | 'lastChecked'
type PreferredFilter = 'all' | 'preferred' | 'notPreferred'
type RetailerActiveFilter = 'all' | 'active' | 'inactive'

export default function RetailerListingAdminPage() {
  const [rows, setRows] = useState<AdminRetailerListingRow[]>([])
  const [catalogOptions, setCatalogOptions] = useState<{ id: string; brand: string; name: string }[]>([])
  const [retailers, setRetailers] = useState<RetailerOption[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [retailerFilter, setRetailerFilter] = useState('all')
  const [retailerActiveFilter, setRetailerActiveFilter] = useState<RetailerActiveFilter>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | RetailerAvailabilityStatus>('all')
  const [preferredFilter, setPreferredFilter] = useState<PreferredFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('string')

  const [creating, setCreating] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminRetailerListings().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setRows(result.data.rows)
        setCatalogOptions(result.data.catalog)
        setRetailers(result.data.retailers)
        setLoadState('loaded')
      } else {
        setError(result.error)
        setLoadState('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const validStringIds = useMemo(() => new Set(catalogOptions.map((c) => c.id)), [catalogOptions])
  const brands = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filtered = rows.filter((r) => {
      if (brandFilter !== 'all' && r.brand !== brandFilter) return false
      if (retailerFilter !== 'all' && String(r.retailerId) !== retailerFilter) return false
      if (retailerActiveFilter === 'active' && !r.retailerActive) return false
      if (retailerActiveFilter === 'inactive' && r.retailerActive) return false
      if (availabilityFilter !== 'all' && r.availabilityStatus !== availabilityFilter) return false
      if (preferredFilter === 'preferred' && !r.isPreferred) return false
      if (preferredFilter === 'notPreferred' && r.isPreferred) return false
      if (q !== '' && !`${r.brand} ${r.name} ${r.retailerName}`.toLowerCase().includes(q)) return false
      return true
    })
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'retailer') return a.retailerName.localeCompare(b.retailerName)
      if (sortBy === 'price') {
        const ap = a.price ?? Number.POSITIVE_INFINITY
        const bp = b.price ?? Number.POSITIVE_INFINITY
        return ap - bp
      }
      if (sortBy === 'lastChecked') {
        const at = a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : -Infinity
        const bt = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : -Infinity
        return bt - at
      }
      // string — brand then name then retailer, for a stable default order
      return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name) || a.retailerName.localeCompare(b.retailerName)
    })
    return filtered
  }, [rows, search, brandFilter, retailerFilter, retailerActiveFilter, availabilityFilter, preferredFilter, sortBy])

  function handleSaved(updated: AdminRetailerListingRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  function handleDeleted(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleCreate(payload: ValidatedRetailerListingPayload) {
    if (!payload.insert) return
    setCreateSaving(true)
    setCreateError(null)
    const result = await createRetailerListing(payload.insert)
    setCreateSaving(false)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    setRows((prev) => [...prev, result.data])
    setCreating(false)
  }

  if (loadState === 'loading') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading retailer listings…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load retailer listings.</p>
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand, string, or retailer…"
          className="focus-ring flex-1 min-w-[180px] rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        />
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={retailerFilter}
          onChange={(e) => setRetailerFilter(e.target.value)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All retailers</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.active ? r.name : `${r.name} (inactive)`}
            </option>
          ))}
        </select>
        <select
          value={retailerActiveFilter}
          onChange={(e) => setRetailerActiveFilter(e.target.value as RetailerActiveFilter)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">Active + inactive retailers</option>
          <option value="active">Active retailers only</option>
          <option value="inactive">Inactive retailers only</option>
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value as 'all' | RetailerAvailabilityStatus)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All availability</option>
          {RETAILER_AVAILABILITY_STATUSES.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          value={preferredFilter}
          onChange={(e) => setPreferredFilter(e.target.value as PreferredFilter)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All listings</option>
          <option value="preferred">Preferred only</option>
          <option value="notPreferred">Not preferred</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="string">Sort: String</option>
          <option value="retailer">Sort: Retailer</option>
          <option value="price">Sort: Price</option>
          <option value="lastChecked">Sort: Last checked</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setCreateError(null)
            setCreating((c) => !c)
          }}
          className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
        >
          {creating ? 'Cancel new listing' : '+ New listing'}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-shuttle-500/40 bg-white/90 dark:bg-white/5 p-5">
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">New retailer listing</h3>
          <RetailerListingForm
            initial={emptyRetailerListingFormInput()}
            context={{ validStringIds, retailers, otherRows: rows }}
            catalogOptions={catalogOptions}
            saving={createSaving}
            saveError={createError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreateError(null)
              setCreating(false)
            }}
          />
        </div>
      )}

      <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">
        {visible.length} of {rows.length} listing(s) shown.
      </p>

      {visible.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No listings match these filters.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <RetailerListingAdminCard
              key={row.id}
              row={row}
              context={{ validStringIds, retailers, otherRows: rows.filter((r) => r.id !== row.id) }}
              catalogOptions={catalogOptions}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
