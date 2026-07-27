import { useEffect, useMemo, useState } from 'react'
import CatalogAdminCard from './CatalogAdminCard'
import CatalogStringForm from './CatalogStringForm'
import {
  fetchAdminCatalog,
  createString,
  emptyCatalogFormInput,
  type AdminCatalogRow,
  type ValidatedCatalogPayload,
} from '../../services/catalogAdminService'

type LoadState = 'loading' | 'loaded' | 'error'
type SortOption = 'popularity' | 'brand' | 'name'

export default function CatalogAdminPage() {
  const [rows, setRows] = useState<AdminCatalogRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('brand')

  const [creating, setCreating] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminCatalog().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setRows(result.data)
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

  const existingIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows])
  const existingBrandNamePairs = useMemo(() => new Set(rows.map((r) => `${r.brand.toLowerCase()}|${r.name.toLowerCase()}`)), [rows])
  const brands = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filtered = rows.filter((r) => {
      if (brandFilter !== 'all' && r.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (q !== '' && !`${r.brand} ${r.name} ${r.id}`.toLowerCase().includes(q)) return false
      return true
    })
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'brand') return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      // popularity — unranked sorts after every ranked string
      if (a.popularityRank == null && b.popularityRank == null) return a.brand.localeCompare(b.brand)
      if (a.popularityRank == null) return 1
      if (b.popularityRank == null) return -1
      return a.popularityRank - b.popularityRank
    })
    return filtered
  }, [rows, search, brandFilter, categoryFilter, sortBy])

  function handleSaved(updated: AdminCatalogRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleCreate(payload: ValidatedCatalogPayload) {
    if (!payload.insert) return
    setCreateSaving(true)
    setCreateError(null)
    const result = await createString(payload.insert)
    setCreateSaving(false)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    setRows((prev) => [...prev, result.data])
    setCreating(false)
  }

  if (loadState === 'loading') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading catalog…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load the catalog.</p>
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
          placeholder="Search brand, name, or ID…"
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50 capitalize"
        >
          <option value="all">All categories</option>
          <option value="repulsion">Repulsion</option>
          <option value="control">Control</option>
          <option value="durability">Durability</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="brand">Sort: Brand</option>
          <option value="name">Sort: Name</option>
          <option value="popularity">Sort: Popularity</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setCreateError(null)
            setCreating((c) => !c)
          }}
          className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
        >
          {creating ? 'Cancel new string' : '+ New string'}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-shuttle-500/40 bg-white/90 dark:bg-white/5 p-5">
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">New string</h3>
          <CatalogStringForm
            mode="create"
            initial={emptyCatalogFormInput()}
            context={{ isNew: true, existingIds, existingBrandNamePairs }}
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
        {visible.length} of {rows.length} string(s) shown.
      </p>

      {visible.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No strings match these filters.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <CatalogAdminCard
              key={row.id}
              row={row}
              otherRows={rows.filter((r) => r.id !== row.id)}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
