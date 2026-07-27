import { useState } from 'react'
import StockBadge from '../StockBadge'
import type { StockLevel } from '../../data/strings'
import {
  STOCK_STATUS_OPTIONS,
  PACKAGE_TYPE_OPTIONS,
  parseQuantityInput,
  normalizeOptionalText,
  updateInventoryRow,
  type AdminInventoryRow,
  type InventoryUpdateInput,
  type PackageType,
} from '../../services/adminInventoryService'

interface InventoryAdminRowProps {
  row: AdminInventoryRow
  onSaved: (updated: AdminInventoryRow) => void
}

type RowState = 'viewing' | 'editing' | 'saving'

export default function InventoryAdminRow({ row, onSaved }: InventoryAdminRowProps) {
  const [state, setState] = useState<RowState>('viewing')
  const [stockStatus, setStockStatus] = useState<StockLevel>(row.stockStatus)
  const [quantityText, setQuantityText] = useState(row.quantity == null ? '' : String(row.quantity))
  const [packageType, setPackageType] = useState<PackageType>(row.packageType)
  const [color, setColor] = useState(row.color ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  function startEditing() {
    setStockStatus(row.stockStatus)
    setQuantityText(row.quantity == null ? '' : String(row.quantity))
    setPackageType(row.packageType)
    setColor(row.color ?? '')
    setNotes(row.notes ?? '')
    setValidationError(null)
    setSaveError(null)
    setState('editing')
  }

  function cancelEditing() {
    setState('viewing')
    setValidationError(null)
    setSaveError(null)
  }

  async function save() {
    const parsedQuantity = parseQuantityInput(quantityText)
    if (!parsedQuantity.ok) {
      setValidationError(parsedQuantity.error)
      return
    }
    setValidationError(null)
    setSaveError(null)
    setState('saving')

    const patch: InventoryUpdateInput = {
      stockStatus,
      quantity: parsedQuantity.value,
      packageType,
      color: normalizeOptionalText(color),
      notes: normalizeOptionalText(notes),
    }

    const result = await updateInventoryRow(row.stringId, patch)

    if (!result.ok) {
      setSaveError(result.error)
      setState('editing')
      return
    }

    onSaved({ ...row, ...patch, updatedAt: new Date().toISOString() })
    setState('viewing')
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2500)
  }

  const isEditing = state === 'editing' || state === 'saving'

  return (
    <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{row.brand}</p>
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">{row.name}</h3>
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40 font-mono">{row.stringId}</p>
        </div>
        {!isEditing && <StockBadge stock={row.stockStatus} />}
      </div>

      {!isEditing ? (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <Field label="Quantity" value={row.quantity == null ? '—' : String(row.quantity)} />
            <Field label="Package" value={row.packageType} />
            <Field label="Color" value={row.color || '—'} />
            <Field label="Notes" value={row.notes || '—'} />
          </dl>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40">Updated {new Date(row.updatedAt).toLocaleString()}</p>
            <div className="flex items-center gap-3">
              {savedFlash && <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Saved</span>}
              <button
                type="button"
                onClick={startEditing}
                className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Stock status</span>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as StockLevel)}
                disabled={state === 'saving'}
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              >
                {STOCK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Quantity</span>
              <input
                type="text"
                inputMode="numeric"
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                disabled={state === 'saving'}
                placeholder="e.g. 3"
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              />
            </label>

            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Package type</span>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value as PackageType)}
                disabled={state === 'saving'}
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              >
                {PACKAGE_TYPE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Color</span>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={state === 'saving'}
                placeholder="optional"
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={state === 'saving'}
              rows={2}
              placeholder="optional"
              className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
            />
          </label>

          {validationError && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              Save failed: {saveError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={state === 'saving'}
              className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-60 disabled:cursor-not-allowed text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
            >
              {state === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={state === 'saving'}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-5 py-2 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Cancel
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
