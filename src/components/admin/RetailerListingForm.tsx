import { useState } from 'react'
import {
  validateRetailerListingInput,
  CURRENCY_OPTIONS,
  AVAILABILITY_OPTIONS,
  PACKAGE_TYPE_OPTIONS,
  type RetailerListingFormInput,
  type RetailerListingFormErrors,
  type RetailerListingValidationContext,
  type ValidatedRetailerListingPayload,
  type RetailerOption,
} from '../../services/retailerListingAdminService'
import { AVAILABILITY_LABELS, PACKAGE_TYPE_LABELS } from '../../services/retailerPriceService'

interface RetailerListingFormProps {
  initial: RetailerListingFormInput
  context: RetailerListingValidationContext
  editingId?: number
  catalogOptions: { id: string; brand: string; name: string }[]
  saving: boolean
  saveError: string | null
  onSubmit: (payload: ValidatedRetailerListingPayload) => void
  onCancel: () => void
}

export default function RetailerListingForm({ initial, context, editingId, catalogOptions, saving, saveError, onSubmit, onCancel }: RetailerListingFormProps) {
  const [input, setInput] = useState<RetailerListingFormInput>(initial)
  const [errors, setErrors] = useState<RetailerListingFormErrors>({})
  const [warnings, setWarnings] = useState<string[]>([])

  function set<K extends keyof RetailerListingFormInput>(key: K, value: RetailerListingFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const result = validateRetailerListingInput(input, context, editingId)
    if (!result.ok) {
      setErrors(result.errors)
      setWarnings([])
      return
    }
    setErrors({})
    setWarnings(result.warnings)
    onSubmit(result.payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">String</span>
        <select
          value={input.stringId}
          onChange={(e) => set('stringId', e.target.value)}
          disabled={saving || editingId != null}
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        >
          <option value="">Choose…</option>
          {catalogOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.brand} {c.name}
            </option>
          ))}
        </select>
        {editingId != null && <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">The string can't be changed after a listing is created.</p>}
        {errors.stringId && <FieldError message={errors.stringId} />}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Retailer</span>
          <select
            value={input.retailerId}
            onChange={(e) => set('retailerId', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            <option value="">Choose…</option>
            {retailerOptionsFor(context.retailers, context.originalRetailerId).map((r) => (
              <option key={r.id} value={r.id} disabled={!r.selectable}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">
            Don't see the retailer you need? Add it first from the Retailers tab.
          </p>
          {errors.retailerId && <FieldError message={errors.retailerId} />}
        </label>
        <TextField label="Product URL" value={input.productUrl} onChange={(v) => set('productUrl', v)} error={errors.productUrl} disabled={saving} placeholder="https://…" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumberField label="Price" value={input.price} onChange={(v) => set('price', v)} error={errors.price} disabled={saving} placeholder="12.99" />
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Currency</span>
          <select
            value={input.currency}
            onChange={(e) => set('currency', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.currency && <FieldError message={errors.currency} />}
        </label>
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Availability</span>
          <select
            value={input.availabilityStatus}
            onChange={(e) => set('availabilityStatus', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            {AVAILABILITY_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {AVAILABILITY_LABELS[a]}
              </option>
            ))}
          </select>
          {errors.availabilityStatus && <FieldError message={errors.availabilityStatus} />}
        </label>
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Package type</span>
          <select
            value={input.packageType}
            onChange={(e) => set('packageType', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            {PACKAGE_TYPE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PACKAGE_TYPE_LABELS[p]}
              </option>
            ))}
          </select>
          {errors.packageType && <FieldError message={errors.packageType} />}
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <NumberField
            label="Package length (m)"
            value={input.packageLengthM}
            onChange={(v) => set('packageLengthM', v)}
            error={errors.packageLengthM}
            disabled={saving}
            placeholder="e.g. 200 for a reel — leave blank if unknown"
          />
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">
            Package length is required for price-per-metre comparison. Leaving it blank is allowed, but this listing won't be sortable or comparable by price per metre.
          </p>
        </div>
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Last checked</span>
          <input
            type="date"
            value={input.lastCheckedAt}
            onChange={(e) => set('lastCheckedAt', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
          {errors.lastCheckedAt && <FieldError message={errors.lastCheckedAt} />}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={input.isPreferred}
          onChange={(e) => set('isPreferred', e.target.checked)}
          disabled={saving}
          className="focus-ring w-4 h-4 accent-shuttle-500"
        />
        Preferred — show this listing first on the public site
      </label>

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Notes</span>
        <textarea
          value={input.notes}
          onChange={(e) => set('notes', e.target.value)}
          disabled={saving}
          rows={2}
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        />
      </label>

      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300/50 dark:border-amber-700/50 p-3 space-y-1">
          {warnings.map((w) => (
            <p key={w} className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {saveError && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          Save failed: {saveError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-60 disabled:cursor-not-allowed text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
        >
          {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Create listing'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-5 py-2 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/** An inactive retailer stays visible in the picker (so an existing listing's assigned retailer is never hidden from its own form) but is only selectable if it's the listing's original retailer — matches validateRetailerListingInput's own rule exactly, so the UI never lets you pick an option the validator would then reject. */
function retailerOptionsFor(retailers: RetailerOption[], originalRetailerId?: number): { id: number; label: string; selectable: boolean }[] {
  return retailers.map((r) => ({
    id: r.id,
    label: r.active ? r.name : `${r.name} (inactive)`,
    selectable: r.active || r.id === originalRetailerId,
  }))
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">
      {message}
    </p>
  )
}

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

function TextField({ label, value, onChange, error, disabled, placeholder }: TextFieldProps) {
  return (
    <label className="block text-sm">
      <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
      />
      {error && <FieldError message={error} />}
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

function NumberField({ label, value, onChange, error, disabled, placeholder }: NumberFieldProps) {
  return (
    <label className="block text-sm">
      <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
      />
      {error && <FieldError message={error} />}
    </label>
  )
}
