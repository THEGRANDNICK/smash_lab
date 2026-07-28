import { useState } from 'react'
import {
  validateRetailerInput,
  type RetailerFormInput,
  type RetailerFormErrors,
  type RetailerValidationContext,
  type ValidatedRetailerPayload,
} from '../../services/retailerAdminService'

interface RetailerFormProps {
  initial: RetailerFormInput
  context: RetailerValidationContext
  editingId?: number
  saving: boolean
  saveError: string | null
  onSubmit: (payload: ValidatedRetailerPayload) => void
  onCancel: () => void
}

export default function RetailerForm({ initial, context, editingId, saving, saveError, onSubmit, onCancel }: RetailerFormProps) {
  const [input, setInput] = useState<RetailerFormInput>(initial)
  const [errors, setErrors] = useState<RetailerFormErrors>({})

  function set<K extends keyof RetailerFormInput>(key: K, value: RetailerFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const result = validateRetailerInput(input, context, editingId)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField label="Name" value={input.name} onChange={(v) => set('name', v)} error={errors.name} disabled={saving} placeholder="e.g. Amazon" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Logo URL" value={input.logoUrl} onChange={(v) => set('logoUrl', v)} error={errors.logoUrl} disabled={saving} placeholder="https://…" />
        <TextField label="Website URL" value={input.websiteUrl} onChange={(v) => set('websiteUrl', v)} error={errors.websiteUrl} disabled={saving} placeholder="https://…" />
      </div>

      <TextField
        label="Country"
        value={input.country}
        onChange={(v) => set('country', v.toUpperCase())}
        error={errors.country}
        disabled={saving}
        placeholder="e.g. DE"
        mono
        hint="2-letter code (ISO 3166-1 alpha-2), e.g. DE, IE — leave blank if unknown."
      />

      <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer select-none">
        <input type="checkbox" checked={input.active} onChange={(e) => set('active', e.target.checked)} disabled={saving} className="focus-ring w-4 h-4 accent-shuttle-500" />
        Active — selectable for new listings and visible on the public site
      </label>
      {editingId != null && !input.active && (
        <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
          Deactivating hides this retailer's existing listings from the public site and prevents it from being chosen for new listings — its listings and data are kept, not deleted.
        </p>
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
          {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Create retailer'}
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
  mono?: boolean
  hint?: string
}

function TextField({ label, value, onChange, error, disabled, placeholder, mono, hint }: TextFieldProps) {
  return (
    <label className="block text-sm">
      <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60 ${mono ? 'font-mono text-xs' : ''}`}
      />
      {hint && !error && <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">{hint}</p>}
      {error && <FieldError message={error} />}
    </label>
  )
}
