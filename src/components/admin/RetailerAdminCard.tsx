import { useState } from 'react'
import RetailerForm from './RetailerForm'
import {
  updateRetailer,
  deleteRetailer,
  retailerFormInputFromRow,
  type AdminRetailerRow,
  type ValidatedRetailerPayload,
  type RetailerValidationContext,
} from '../../services/retailerAdminService'

interface RetailerAdminCardProps {
  row: AdminRetailerRow
  context: RetailerValidationContext
  onSaved: (updated: AdminRetailerRow) => void
  onDeleted: (id: number) => void
}

type CardState = 'viewing' | 'editing' | 'saving' | 'confirmingDelete' | 'deleting'

export default function RetailerAdminCard({ row, context, onSaved, onDeleted }: RetailerAdminCardProps) {
  const [state, setState] = useState<CardState>('viewing')
  const [error, setError] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  async function handleSubmit(payload: ValidatedRetailerPayload) {
    setState('saving')
    setError(null)
    const result = await updateRetailer(row.id, payload.update, row.listingCount)
    if (!result.ok) {
      setError(result.error)
      setState('editing')
      return
    }
    onSaved(result.data)
    setState('viewing')
  }

  async function handleToggleActive() {
    setState('saving')
    setError(null)
    const result = await updateRetailer(row.id, { active: !row.active }, row.listingCount)
    if (!result.ok) {
      setError(result.error)
      setState('viewing')
      return
    }
    onSaved(result.data)
    setState('viewing')
  }

  async function handleDelete() {
    setState('deleting')
    setError(null)
    const result = await deleteRetailer(row.id, row.listingCount)
    if (!result.ok) {
      setError(result.error)
      setState('confirmingDelete')
      return
    }
    onDeleted(row.id)
  }

  if (state === 'editing' || (state === 'saving' && error == null)) {
    return (
      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
        <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">{row.name}</h3>
        <RetailerForm
          initial={retailerFormInputFromRow(row)}
          context={context}
          editingId={row.id}
          saving={state === 'saving'}
          saveError={error}
          onSubmit={handleSubmit}
          onCancel={() => {
            setError(null)
            setState('viewing')
          }}
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {row.logoUrl && !logoFailed && (
            <img src={row.logoUrl} alt="" onError={() => setLogoFailed(true)} className="w-10 h-10 rounded-lg object-contain bg-white/50 dark:bg-white/10 shrink-0" />
          )}
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 flex items-center gap-2">
              {row.name}
              {!row.active && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-court-900/10 dark:bg-white/10 text-ink-700/60 dark:text-shuttle-100/60">
                  Inactive
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40">
              {row.listingCount} listing{row.listingCount === 1 ? '' : 's'}
              {row.country && ` · ${row.country}`}
            </p>
          </div>
        </div>
      </div>

      {row.websiteUrl && (
        <p className="text-sm mb-3">
          <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="focus-ring text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer">
            {row.websiteUrl} ↗
          </a>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
          {state === 'confirmingDelete' || state === 'deleting' ? 'Delete failed' : 'Error'}: {error}
        </p>
      )}

      {state === 'confirmingDelete' || state === 'deleting' ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300/50 dark:border-red-700/50 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Delete "{row.name}"?</p>
          <p className="text-xs text-red-700/80 dark:text-red-400/80 mb-3">
            {row.listingCount > 0
              ? `This retailer has ${row.listingCount} listing${row.listingCount === 1 ? '' : 's'} and cannot be deleted — delete those listings first, or deactivate this retailer instead.`
              : 'This retailer has no listings and can be safely deleted. This cannot be undone.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={state === 'deleting' || row.listingCount > 0}
              className="focus-ring rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
            >
              {state === 'deleting' ? 'Deleting…' : 'Yes, delete it'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setState('viewing')
              }}
              disabled={state === 'deleting'}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-5 py-2 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40">Updated {new Date(row.updatedAt).toLocaleString()}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setState('editing')}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              disabled={state === 'saving'}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {row.active ? 'Deactivate' : 'Reactivate'}
            </button>
            <button
              type="button"
              onClick={() => setState('confirmingDelete')}
              className="focus-ring rounded-full border-2 border-red-300/50 dark:border-red-700/50 text-red-600 dark:text-red-400 font-semibold text-sm px-4 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
