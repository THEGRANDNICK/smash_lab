import { useEffect, useState } from 'react'
import { fetchAdminInventory, type AdminInventoryRow } from '../../services/adminInventoryService'
import InventoryAdminRow from './InventoryAdminRow'

type LoadState = 'loading' | 'loaded' | 'error'

export default function InventoryAdminPage() {
  const [rows, setRows] = useState<AdminInventoryRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminInventory().then((result) => {
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

  function handleSaved(updated: AdminInventoryRow) {
    setRows((prev) => prev.map((r) => (r.stringId === updated.stringId ? updated : r)))
  }

  if (loadState === 'loading') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading inventory…</p>
  }

  if (loadState === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load inventory.</p>
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">No inventory rows found.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">{rows.length} string(s), sorted by brand then name.</p>
      {rows.map((row) => (
        <InventoryAdminRow key={row.stringId} row={row} onSaved={handleSaved} />
      ))}
    </div>
  )
}
