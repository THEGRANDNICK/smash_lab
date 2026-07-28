import { useEffect, useMemo, useState } from 'react'
import SpecialistAdminCard from './SpecialistAdminCard'
import { fetchAdminSpecialistList, type AdminSpecialistRow } from '../../services/specialistAdminService'

type LoadState = 'loading' | 'loaded' | 'error'
type FilterOption = 'all' | 'withProfile' | 'withoutProfile'

export default function SpecialistAdminPage() {
  const [rows, setRows] = useState<AdminSpecialistRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterOption>('all')

  useEffect(() => {
    let cancelled = false
    fetchAdminSpecialistList().then((result) => {
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
      if (filter === 'withProfile' && !r.hasProfile) return false
      if (filter === 'withoutProfile' && r.hasProfile) return false
      if (q !== '' && !`${r.brand} ${r.name}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, filter])

  function handleSaved(updated: AdminSpecialistRow) {
    setRows((prev) => prev.map((r) => (r.stringId === updated.stringId ? updated : r)))
  }

  function handleCleared(stringId: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.stringId === stringId
          ? {
              ...r,
              hasProfile: false,
              feel: null,
              reviewer: null,
              subjectiveNotes: null,
              strengths: null,
              weaknesses: null,
              specialistTags: null,
              personalTensionMinKg: null,
              personalTensionMaxKg: null,
              dimensions: {},
              updatedAt: null,
            }
          : r,
      ),
    )
  }

  if (loadState === 'loading') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading specialist profiles…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load specialist profiles.</p>
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
          placeholder="Search brand or name…"
          className="focus-ring flex-1 min-w-[180px] rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          className="focus-ring rounded-full border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-ink-900 dark:text-shuttle-50"
        >
          <option value="all">All strings</option>
          <option value="withProfile">Has a profile</option>
          <option value="withoutProfile">No profile yet</option>
        </select>
      </div>

      <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">
        {visible.length} of {rows.length} string(s) shown — {rows.filter((r) => r.hasProfile).length} have a specialist profile.
      </p>

      {visible.length === 0 ? (
        <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No strings match these filters.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <SpecialistAdminCard key={row.stringId} row={row} onSaved={handleSaved} onCleared={handleCleared} />
          ))}
        </div>
      )}
    </div>
  )
}
