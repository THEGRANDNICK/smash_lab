import { useEffect, useMemo, useState } from 'react'
import RetailerAdminCard from './RetailerAdminCard'
import RetailerForm from './RetailerForm'
import { fetchAdminRetailers, createRetailer, emptyRetailerFormInput, type AdminRetailerRow, type ValidatedRetailerPayload } from '../../services/retailerAdminService'

type LoadState = 'loading' | 'loaded' | 'error'
type ActiveFilter = 'all' | 'active' | 'inactive'

export default function RetailerAdminPage() {
  const [rows, setRows] = useState<AdminRetailerRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  const [creating, setCreating] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminRetailers().then((result) => {
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (activeFilter === 'active' && !r.active) return false
      if (activeFilter === 'inactive' && r.active) return false
      if (q !== '' && !r.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, activeFilter])

  function handleSaved(updated: AdminRetailerRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  function handleDeleted(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleCreate(payload: ValidatedRetailerPayload) {
    if (!payload.insert) return
    setCreateSaving(true)
    setCreateError(null)
    const result = await createRetailer(payload.insert)
    setCreateSaving(false)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    setRows((prev) => [...prev, result.data])
    setCreating(false)
  }

  if (loadState === 'loading') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading retailers…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load retailers.</p>
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
          placeholder="Search retailer name…"
          className="focus-ring flex-1 min-w-[180px] rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        />
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All retailers</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setCreateError(null)
            setCreating((c) => !c)
          }}
          className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
        >
          {creating ? 'Cancel new retailer' : '+ New retailer'}
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-shuttle-500/40 bg-white/90 dark:bg-white/5 p-5">
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">New retailer</h3>
          <RetailerForm
            initial={emptyRetailerFormInput()}
            context={{ otherRetailers: rows }}
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
        {visible.length} of {rows.length} retailer(s) shown.
      </p>

      {visible.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No retailers match these filters.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <RetailerAdminCard
              key={row.id}
              row={row}
              context={{ otherRetailers: rows.filter((r) => r.id !== row.id) }}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
