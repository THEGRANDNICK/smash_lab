import { useMemo, useState } from 'react'
import CatalogStringForm from './CatalogStringForm'
import {
  updateString,
  deleteString,
  catalogFormInputFromRow,
  type AdminCatalogRow,
  type ValidatedCatalogPayload,
} from '../../services/catalogAdminService'

interface CatalogAdminCardProps {
  row: AdminCatalogRow
  /** Every other catalog row (this row itself is excluded internally) — used to check id/brand-name uniqueness while editing. */
  otherRows: AdminCatalogRow[]
  onSaved: (updated: AdminCatalogRow) => void
  onDeleted: (id: string) => void
}

type CardState = 'viewing' | 'editing' | 'saving' | 'confirmingDelete' | 'deleting'

export default function CatalogAdminCard({ row, otherRows, onSaved, onDeleted }: CatalogAdminCardProps) {
  const [state, setState] = useState<CardState>('viewing')
  const [error, setError] = useState<string | null>(null)

  const existingIds = useMemo(() => new Set(otherRows.map((r) => r.id)), [otherRows])
  const existingBrandNamePairs = useMemo(() => new Set(otherRows.map((r) => `${r.brand.toLowerCase()}|${r.name.toLowerCase()}`)), [otherRows])

  async function handleSubmit(payload: ValidatedCatalogPayload) {
    setState('saving')
    setError(null)
    const result = await updateString(row.id, payload.update)
    if (!result.ok) {
      setError(result.error)
      setState('editing')
      return
    }
    onSaved(result.data)
    setState('viewing')
  }

  async function handleDelete() {
    setState('deleting')
    setError(null)
    const result = await deleteString(row.id)
    if (!result.ok) {
      setError(result.error)
      setState('confirmingDelete')
      return
    }
    onDeleted(row.id)
  }

  if (state === 'editing' || state === 'saving') {
    return (
      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mb-1">{row.brand}</p>
        <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">{row.name}</h3>
        <CatalogStringForm
          mode="edit"
          initial={catalogFormInputFromRow(row)}
          context={{ isNew: false, existingIds, existingBrandNamePairs }}
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{row.brand}</p>
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">{row.name}</h3>
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40 font-mono">{row.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {row.isHybrid && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-shuttle-500/20 text-shuttle-600">Hybrid</span>}
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-court-900/5 dark:bg-white/10 text-ink-700 dark:text-shuttle-100 capitalize">{row.category}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <Field label="Gauge" value={formatAdminGauge(row)} />
        <Field label="Repulsion" value={String(row.repulsion)} />
        <Field label="Durability" value={String(row.durability)} />
        <Field label="Control" value={String(row.control)} />
        <Field label="Hitting sound" value={String(row.hittingSound)} />
        <Field label="Shock absorption" value={row.shockAbsorption == null ? '—' : String(row.shockAbsorption)} />
        <Field label="Cost" value={row.stringCostEur == null ? '—' : `€${row.stringCostEur}`} />
        <Field label="Popularity" value={row.popularityRank == null ? '—' : `#${row.popularityRank}`} />
        <Field label="Image" value={row.imageUrl ? '✓ set' : '— none'} />
        <Field label="Product URL" value={row.productUrl ? '✓ set' : '— none'} />
      </dl>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
          {state === 'confirmingDelete' || state === 'deleting' ? 'Delete failed' : 'Error'}: {error}
        </p>
      )}

      {state === 'confirmingDelete' || state === 'deleting' ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300/50 dark:border-red-700/50 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Delete "{row.brand} {row.name}"?</p>
          <p className="text-xs text-red-700/80 dark:text-red-400/80 mb-3">
            This removes it from recommendations, the catalog, comparison, and the quiz. Its inventory row is deleted too. This cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={state === 'deleting'}
              className="focus-ring rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">{label}</dt>
      <dd className="text-ink-900 dark:text-shuttle-50">{value}</dd>
    </div>
  )
}

/** Mirrors logic/formatGauge.ts's display rule, adapted for the admin row shape (which tracks main/cross metadata separately from the public StringItem model). */
function formatAdminGauge(row: AdminCatalogRow): string {
  if (row.isHybrid) {
    const main = row.mainStringMeta?.gauge
    const cross = row.crossStringMeta?.gauge
    if (main != null && cross != null) return `${main} / ${cross}mm`
    if (main != null) return `${main}mm (main)`
    if (cross != null) return `${cross}mm (cross)`
    return '—'
  }
  return row.gaugeMm == null ? '—' : `${row.gaugeMm}mm`
}
