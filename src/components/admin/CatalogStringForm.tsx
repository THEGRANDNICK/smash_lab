import { useState } from 'react'
import {
  CATEGORY_OPTIONS,
  validateCatalogInput,
  suggestCatalogId,
  type CatalogFormInput,
  type CatalogFormErrors,
  type ValidationContext,
  type ValidatedCatalogPayload,
} from '../../services/catalogAdminService'
import { splitColorList } from '../../logic/colorParsing'
import { resolveStringColor } from '../../logic/stringColor'
import StringColorSwatch from '../StringColorSwatch'

interface CatalogStringFormProps {
  mode: 'create' | 'edit'
  initial: CatalogFormInput
  context: ValidationContext
  saving: boolean
  saveError: string | null
  onSubmit: (payload: ValidatedCatalogPayload) => void
  onCancel: () => void
}

export default function CatalogStringForm({ mode, initial, context, saving, saveError, onSubmit, onCancel }: CatalogStringFormProps) {
  const [input, setInput] = useState<CatalogFormInput>(initial)
  const [errors, setErrors] = useState<CatalogFormErrors>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [idManuallyEdited, setIdManuallyEdited] = useState(false)

  function set<K extends keyof CatalogFormInput>(key: K, value: CatalogFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function handleBrandOrNameChange(key: 'brand' | 'name', value: string) {
    setInput((prev) => {
      const next = { ...prev, [key]: value }
      if (mode === 'create' && !idManuallyEdited) {
        next.id = suggestCatalogId(next.brand, next.name)
      }
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const result = validateCatalogInput(input, context)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Brand" value={input.brand} onChange={(v) => handleBrandOrNameChange('brand', v)} error={errors.brand} disabled={saving} />
        <TextField label="Name" value={input.name} onChange={(v) => handleBrandOrNameChange('name', v)} error={errors.name} disabled={saving} />
      </div>

      {mode === 'create' && (
        <TextField
          label="ID"
          value={input.id}
          onChange={(v) => {
            setIdManuallyEdited(true)
            set('id', v)
          }}
          error={errors.id}
          disabled={saving}
          mono
          hint="Lowercase letters, numbers, and hyphens only — e.g. yonex-bg80. Suggested automatically from brand + name until you edit it."
        />
      )}

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Category</span>
        <select
          value={input.category}
          onChange={(e) => set('category', e.target.value)}
          disabled={saving}
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        >
          <option value="">Choose…</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {errors.category && <FieldError message={errors.category} />}
      </label>

      <fieldset className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 px-1">Ratings (0–11)</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          <NumberField label="Repulsion" value={input.repulsion} onChange={(v) => set('repulsion', v)} error={errors.repulsion} disabled={saving} />
          <NumberField label="Durability" value={input.durability} onChange={(v) => set('durability', v)} error={errors.durability} disabled={saving} />
          <NumberField label="Control" value={input.control} onChange={(v) => set('control', v)} error={errors.control} disabled={saving} />
          <NumberField label="Hitting sound" value={input.hittingSound} onChange={(v) => set('hittingSound', v)} error={errors.hittingSound} disabled={saving} />
          <NumberField
            label="Shock absorption"
            value={input.shockAbsorption}
            onChange={(v) => set('shockAbsorption', v)}
            error={errors.shockAbsorption}
            disabled={saving}
            placeholder="unknown"
          />
          <NumberField label="Gauge (mm)" value={input.gauge} onChange={(v) => set('gauge', v)} error={errors.gauge} disabled={saving} placeholder="optional" step="0.01" />
        </div>
      </fieldset>

      <div className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer">
          <input type="checkbox" checked={input.isHybrid} onChange={(e) => set('isHybrid', e.target.checked)} disabled={saving} className="focus-ring rounded" />
          Hybrid string (separate main + cross construction, e.g. Yonex AeroBite)
        </label>
        {input.isHybrid && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">Main string</p>
              <NumberField label="Gauge (mm)" value={input.mainGauge} onChange={(v) => set('mainGauge', v)} error={errors.mainGauge} disabled={saving} placeholder="optional" step="0.01" />
              <TextField label="Material" value={input.mainMaterial} onChange={(v) => set('mainMaterial', v)} disabled={saving} placeholder="optional" />
              <TextField label="Construction" value={input.mainConstruction} onChange={(v) => set('mainConstruction', v)} disabled={saving} placeholder="optional" />
              <TextField label="Coating" value={input.mainCoating} onChange={(v) => set('mainCoating', v)} disabled={saving} placeholder="optional" />
              <TextField label="Color" value={input.mainColor} onChange={(v) => set('mainColor', v)} disabled={saving} placeholder="optional" hint="Shown as one half of the split swatch, only when Cross color is also set." />
              <ColorsFieldPreview raw={input.mainColor} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">Cross string</p>
              <NumberField label="Gauge (mm)" value={input.crossGauge} onChange={(v) => set('crossGauge', v)} error={errors.crossGauge} disabled={saving} placeholder="optional" step="0.01" />
              <TextField label="Material" value={input.crossMaterial} onChange={(v) => set('crossMaterial', v)} disabled={saving} placeholder="optional" />
              <TextField label="Construction" value={input.crossConstruction} onChange={(v) => set('crossConstruction', v)} disabled={saving} placeholder="optional" />
              <TextField label="Coating" value={input.crossCoating} onChange={(v) => set('crossCoating', v)} disabled={saving} placeholder="optional" />
              <TextField label="Color" value={input.crossColor} onChange={(v) => set('crossColor', v)} disabled={saving} placeholder="optional" hint="Shown as the other half of the split swatch, only when Main color is also set." />
              <ColorsFieldPreview raw={input.crossColor} />
            </div>
          </div>
        )}
      </div>

      <details className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4 group">
        <summary className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 cursor-pointer select-none">Commerce &amp; description</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <NumberField label="String cost (€)" value={input.stringCost} onChange={(v) => set('stringCost', v)} error={errors.stringCost} disabled={saving} placeholder="optional" step="0.01" />
          <NumberField
            label="Popularity rank"
            value={input.popularityRank}
            onChange={(v) => set('popularityRank', v)}
            error={errors.popularityRank}
            disabled={saving}
            placeholder="optional — lower is more popular"
          />
        </div>
        <label className="block text-sm mt-3">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Description</span>
          <textarea
            value={input.description}
            onChange={(e) => set('description', e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="optional"
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
        </label>
      </details>

      <details className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4 group">
        <summary className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 cursor-pointer select-none">Media &amp; links</summary>
        <div className="space-y-3 mt-3">
          <TextField label="Product URL" value={input.productUrl} onChange={(v) => set('productUrl', v)} error={errors.productUrl} disabled={saving} placeholder="https://…" />
          <div>
            <TextField label="Image URL" value={input.imageUrl} onChange={(v) => set('imageUrl', v)} error={errors.imageUrl} disabled={saving} placeholder="https://…" />
            {input.imageUrl.trim() !== '' && <ImagePreview url={input.imageUrl.trim()} />}
          </div>
          <div>
            <TextField
              label="Colors"
              value={input.colors}
              onChange={(v) => set('colors', v)}
              disabled={saving}
              placeholder="comma or semicolon-separated, e.g. Yellow, Pink; White"
              hint="The general range this product ships in. Separate colors with a comma or semicolon — multi-word names like 'Sky Blue' are kept intact. Case-insensitive duplicates (e.g. Yellow, yellow) are merged automatically. Shown as a fallback whenever the Inventory page has no specific in-stock color set."
            />
            <ColorsFieldPreview raw={input.colors} />
          </div>
        </div>
      </details>

      <details className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4 group">
        <summary className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 cursor-pointer select-none">Tension metadata (advanced)</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <NumberField
            label="Tension adjustment (kg)"
            value={input.tensionAdjustment}
            onChange={(v) => set('tensionAdjustment', v)}
            error={errors.tensionAdjustment}
            disabled={saving}
            placeholder="e.g. -0.25 or 0.5"
            step="0.05"
          />
          <div />
          <NumberField
            label="Recommended min (kg)"
            value={input.recommendedMin}
            onChange={(v) => set('recommendedMin', v)}
            error={errors.recommendedMin}
            disabled={saving}
            placeholder="optional"
            step="0.5"
          />
          <NumberField
            label="Recommended max (kg)"
            value={input.recommendedMax}
            onChange={(v) => set('recommendedMax', v)}
            error={errors.recommendedMax}
            disabled={saving}
            placeholder="optional"
            step="0.5"
          />
        </div>
        <label className="block text-sm mt-3">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Tension notes</span>
          <input
            type="text"
            value={input.tensionNotes}
            onChange={(e) => set('tensionNotes', e.target.value)}
            disabled={saving}
            placeholder="optional"
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
        </label>
      </details>

      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300/50 dark:border-amber-700/50 p-3 space-y-1">
          {warnings.map((w) => (
            <p key={w} className="text-sm text-amber-800 dark:text-amber-300">
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
          {saving ? 'Saving…' : mode === 'create' ? 'Create string' : 'Save changes'}
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

/** Live preview of the Colors field's comma/semicolon-separated entries — a swatch for each recognized color, plus an inline warning (not a blocking error) for anything unrecognized, so a typo is visible before saving rather than after. */
function ColorsFieldPreview({ raw }: { raw: string }) {
  const tokens = splitColorList(raw)
  if (tokens.length === 0) return null
  const known = tokens.map((t) => resolveStringColor(t)).filter((s): s is NonNullable<typeof s> => s != null)
  const unknown = tokens.filter((t) => !resolveStringColor(t))
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1.5">
      {known.map((s) => (
        <span key={s.hex} className="inline-flex items-center gap-1">
          <StringColorSwatch swatch={s} size="sm" />
          {s.label}
        </span>
      ))}
      {unknown.length > 0 && <span className="text-amber-700 dark:text-amber-400 font-semibold">{unknown.join(', ')} ⚠ unmapped, will still save</span>}
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

interface NumberFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  step?: string
}

/** "decimal" keeps the mobile numeric keypad (with a decimal key) even for fields that allow a negative value (e.g. tension adjustment) — most mobile decimal keypads still offer a "-", and that's a better default than falling back to a plain "text" keyboard, which used to lose the numeric keypad entirely for those fields. Accepts either "." or "," as the decimal separator (see logic/decimalInput.ts) — this input never restricts *which* characters can be typed, only how the resulting text is parsed downstream. */
function NumberField({ label, value, onChange, error, disabled, placeholder, step }: NumberFieldProps) {
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
        step={step}
        className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
      />
      {error && <FieldError message={error} />}
    </label>
  )
}

function ImagePreview({ url }: { url: string }) {
  const [broken, setBroken] = useState(false)

  if (broken) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border-2 border-dashed border-court-900/15 dark:border-white/15 px-3 py-2 text-xs text-ink-700/50 dark:text-shuttle-100/50">
        <span aria-hidden="true">🖼️</span> Image couldn't be loaded — check the URL.
      </div>
    )
  }

  return (
    <img src={url} alt="" onError={() => setBroken(true)} className="mt-2 h-24 w-24 object-cover rounded-lg border-2 border-court-900/10 dark:border-white/10" />
  )
}
