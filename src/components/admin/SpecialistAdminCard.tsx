import { useState } from 'react'
import SpecialistProfileForm from './SpecialistProfileForm'
import { upsertSpecialistProfile, deleteSpecialistProfile, specialistFormInputFromRow, emptySpecialistFormInput, type AdminSpecialistRow, type SpecialistUpsertFields } from '../../services/specialistAdminService'

interface SpecialistAdminCardProps {
  row: AdminSpecialistRow
  onSaved: (updated: AdminSpecialistRow) => void
  onCleared: (stringId: string) => void
}

type CardState = 'viewing' | 'editing' | 'saving' | 'confirmingClear' | 'clearing'

export default function SpecialistAdminCard({ row, onSaved, onCleared }: SpecialistAdminCardProps) {
  const [state, setState] = useState<CardState>('viewing')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(update: SpecialistUpsertFields) {
    setState('saving')
    setError(null)
    const result = await upsertSpecialistProfile(row.stringId, update)
    if (!result.ok) {
      setError(result.error)
      setState('editing')
      return
    }
    onSaved({
      ...row,
      hasProfile: true,
      feel: update.feel ?? null,
      experienceSource: update.experience_source ?? row.experienceSource,
      confidence: update.confidence ?? row.confidence,
      reviewer: update.reviewer ?? null,
      subjectiveNotes: update.subjective_notes ?? null,
      strengths: update.strengths ?? null,
      weaknesses: update.weaknesses ?? null,
      specialistTags: update.specialist_tags ?? null,
      personalTensionMinKg: update.personal_tension_min_kg ?? null,
      personalTensionMaxKg: update.personal_tension_max_kg ?? null,
      dimensions: update.dimensions ?? {},
      updatedAt: new Date().toISOString(),
    })
    setState('viewing')
  }

  async function handleClear() {
    setState('clearing')
    setError(null)
    const result = await deleteSpecialistProfile(row.stringId)
    if (!result.ok) {
      setError(result.error)
      setState('confirmingClear')
      return
    }
    onCleared(row.stringId)
  }

  if (state === 'editing' || state === 'saving') {
    return (
      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mb-1">{row.brand}</p>
        <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50 mb-4">{row.name}</h3>
        <SpecialistProfileForm
          initial={row.hasProfile ? specialistFormInputFromRow(row) : emptySpecialistFormInput()}
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
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40 font-mono">{row.stringId}</p>
        </div>
        {!row.hasProfile && (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-court-900/5 dark:bg-white/10 text-ink-700/50 dark:text-shuttle-100/50">No profile</span>
        )}
      </div>

      {row.hasProfile && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          <Field label="Confidence" value={row.confidence ?? '—'} />
          <Field label="Source" value={row.experienceSource ?? '—'} />
          <Field label="Reviewer" value={row.reviewer ?? '—'} />
          <Field label="Feel" value={row.feel ?? '—'} />
        </dl>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
          {state === 'confirmingClear' ? 'Remove failed' : 'Error'}: {error}
        </p>
      )}

      {state === 'confirmingClear' || state === 'clearing' ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-300/50 dark:border-red-700/50 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Remove the specialist profile for "{row.brand} {row.name}"?</p>
          <p className="text-xs text-red-700/80 dark:text-red-400/80 mb-3">
            It reverts to manufacturer-data-only scoring on the public site. The catalog and inventory rows are untouched.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={state === 'clearing'}
              className="focus-ring rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
            >
              {state === 'clearing' ? 'Removing…' : 'Yes, remove it'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setState('viewing')
              }}
              disabled={state === 'clearing'}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-5 py-2 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40">{row.updatedAt ? `Updated ${new Date(row.updatedAt).toLocaleString()}` : 'No specialist profile yet'}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setState('editing')}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {row.hasProfile ? 'Edit' : 'Add profile'}
            </button>
            {row.hasProfile && (
              <button
                type="button"
                onClick={() => setState('confirmingClear')}
                className="focus-ring rounded-full border-2 border-red-300/50 dark:border-red-700/50 text-red-600 dark:text-red-400 font-semibold text-sm px-4 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
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
      <dd className="text-ink-900 dark:text-shuttle-50 capitalize">{value}</dd>
    </div>
  )
}
