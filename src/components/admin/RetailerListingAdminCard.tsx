import { useState } from 'react'
import RetailerListingForm from './RetailerListingForm'
import {
  updateRetailerListing,
  deleteRetailerListing,
  retailerListingFormInputFromRow,
  type AdminRetailerListingRow,
  type ValidatedRetailerListingPayload,
  type RetailerListingValidationContext,
} from '../../services/retailerListingAdminService'
import { AVAILABILITY_LABELS, PACKAGE_TYPE_LABELS, formatRetailerPrice } from '../../services/retailerPriceService'

interface RetailerListingAdminCardProps {
  row: AdminRetailerListingRow
  context: Omit<RetailerListingValidationContext, 'originalRetailerId'>
  catalogOptions: { id: string; brand: string; name: string }[]
  onSaved: (updated: AdminRetailerListingRow) => void
  onDeleted: (id: number) => void
}

type CardState = 'viewing' | 'editing' | 'saving' | 'confirmingDelete' | 'deleting'

export default function RetailerListingAdminCard({ row, context, catalogOptions, onSaved, onDeleted }: RetailerListingAdminCardProps) {
  const [state, setState] = useState<CardState>('viewing')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(payload: ValidatedRetailerListingPayload) {
    setState('saving')
    setError(null)
    const result = await updateRetailerListing(row.id, payload.update)
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
    const result = await deleteRetailerListing(row.id)
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
        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mb-1">
          {row.brand} {row.name}
        </p>
        <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">{row.retailerName}</h3>
        <RetailerListingForm
          initial={retailerListingFormInputFromRow(row)}
          context={{ ...context, originalRetailerId: row.retailerId }}
          editingId={row.id}
          catalogOptions={catalogOptions}
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

  const price = formatRetailerPrice(row.price, row.currency)

  return (
    <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">
            {row.brand} {row.name}
          </p>
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 flex items-center gap-2">
            {row.retailerName}
            {row.isPreferred && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-shuttle-500/20 text-shuttle-600">Preferred</span>
            )}
            {!row.retailerActive && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-court-900/10 dark:bg-white/10 text-ink-700/60 dark:text-shuttle-100/60"
                title="This retailer is deactivated — this listing is hidden from the public site until it's reactivated."
              >
                Retailer inactive
              </span>
            )}
          </h3>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <Field label="Price" value={price ?? '—'} />
        <Field label="Availability" value={AVAILABILITY_LABELS[row.availabilityStatus]} />
        <Field label="Package" value={row.packageLengthM != null ? `${PACKAGE_TYPE_LABELS[row.packageType]} (${row.packageLengthM}m)` : PACKAGE_TYPE_LABELS[row.packageType]} />
        <Field label="Last checked" value={row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleDateString() : '—'} />
      </dl>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
          {state === 'confirmingDelete' || state === 'deleting' ? 'Delete failed' : 'Error'}: {error}
        </p>
      )}

      {state === 'confirmingDelete' || state === 'deleting' ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300/50 dark:border-red-700/50 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
            Delete {row.retailerName}'s listing for "{row.brand} {row.name}"?
          </p>
          <p className="text-xs text-red-700/80 dark:text-red-400/80 mb-3">
            This removes only this one listing. The string, its inventory row, its specialist profile, and the retailer itself are untouched. This cannot be undone.
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
