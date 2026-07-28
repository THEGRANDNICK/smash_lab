import { useState } from 'react'
import {
  FEEL_OPTIONS,
  EXPERIENCE_SOURCE_OPTIONS,
  CONFIDENCE_OPTIONS,
  DIMENSION_OPTIONS,
  validateSpecialistInput,
  type SpecialistFormInput,
  type SpecialistFormErrors,
  type SpecialistUpsertFields,
} from '../../services/specialistAdminService'

interface SpecialistProfileFormProps {
  initial: SpecialistFormInput
  saving: boolean
  saveError: string | null
  onSubmit: (update: SpecialistUpsertFields) => void
  onCancel: () => void
}

export default function SpecialistProfileForm({ initial, saving, saveError, onSubmit, onCancel }: SpecialistProfileFormProps) {
  const [input, setInput] = useState<SpecialistFormInput>(initial)
  const [errors, setErrors] = useState<SpecialistFormErrors>({})

  function set<K extends keyof Omit<SpecialistFormInput, 'dimensions'>>(key: K, value: SpecialistFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  function setDimension(key: (typeof DIMENSION_OPTIONS)[number]['key'], value: string) {
    setInput((prev) => ({ ...prev, dimensions: { ...prev.dimensions, [key]: value } }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const result = validateSpecialistInput(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.update)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Source</span>
          <select
            value={input.experienceSource}
            onChange={(e) => set('experienceSource', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            <option value="">Choose…</option>
            {EXPERIENCE_SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.experienceSource && <FieldError message={errors.experienceSource} />}
        </label>

        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Confidence</span>
          <select
            value={input.confidence}
            onChange={(e) => set('confidence', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            <option value="">Choose…</option>
            {CONFIDENCE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.confidence && <FieldError message={errors.confidence} />}
        </label>

        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Feel</span>
          <select
            value={input.feel}
            onChange={(e) => set('feel', e.target.value)}
            disabled={saving}
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          >
            <option value="">Not set</option>
            {FEEL_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {errors.feel && <FieldError message={errors.feel} />}
        </label>

        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Reviewer</span>
          <input
            type="text"
            value={input.reviewer}
            onChange={(e) => set('reviewer', e.target.value)}
            disabled={saving}
            placeholder="optional — e.g. a name or 'club consensus'"
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Personal tension min (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            value={input.personalTensionMinKg}
            onChange={(e) => set('personalTensionMinKg', e.target.value)}
            disabled={saving}
            placeholder="optional"
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
          {errors.personalTensionMinKg && <FieldError message={errors.personalTensionMinKg} />}
        </label>
        <label className="block text-sm">
          <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Personal tension max (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            value={input.personalTensionMaxKg}
            onChange={(e) => set('personalTensionMaxKg', e.target.value)}
            disabled={saving}
            placeholder="optional"
            className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
          {errors.personalTensionMaxKg && <FieldError message={errors.personalTensionMaxKg} />}
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Strengths (one per line)</span>
        <textarea
          value={input.strengths}
          onChange={(e) => set('strengths', e.target.value)}
          disabled={saving}
          rows={3}
          placeholder="optional"
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Weaknesses / trade-offs (one per line)</span>
        <textarea
          value={input.weaknesses}
          onChange={(e) => set('weaknesses', e.target.value)}
          disabled={saving}
          rows={3}
          placeholder="optional"
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Tags</span>
        <input
          type="text"
          value={input.specialistTags}
          onChange={(e) => set('specialistTags', e.target.value)}
          disabled={saving}
          placeholder="comma-separated, e.g. hard-hitter, fast-doubles"
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Subjective notes</span>
        <textarea
          value={input.subjectiveNotes}
          onChange={(e) => set('subjectiveNotes', e.target.value)}
          disabled={saving}
          rows={3}
          placeholder="optional — the stringer's own read, in prose"
          className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
        />
      </label>

      <details className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4 group">
        <summary className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 cursor-pointer select-none">Dimensions (1–5, advanced)</summary>
        <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-2 mb-3">Sparse by design — leave blank rather than guess a value with no real evidence behind it.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DIMENSION_OPTIONS.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1 text-xs">{label}</span>
              <input
                type="text"
                inputMode="decimal"
                value={input.dimensions[key] ?? ''}
                onChange={(e) => setDimension(key, e.target.value)}
                disabled={saving}
                placeholder="—"
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              />
              {errors.dimensions?.[key] && <FieldError message={errors.dimensions[key] as string} />}
            </label>
          ))}
        </div>
      </details>

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
          {saving ? 'Saving…' : 'Save profile'}
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
