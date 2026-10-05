import { useEffect, useMemo, useState } from 'react'
import { applyFeedbackToProfile, deleteFeedback, fetchAllFeedback, type StoredFeedback } from '../../services/feedbackService'
import { fetchExistingProfiles } from '../../services/importAdminService'
import type { ExistingProfile } from '../../logic/researchPack'
import { changedDimensions, proposeMerge, EXISTING_WEIGHT } from '../../logic/feedbackMerge'
import { strings as builtInStrings } from '../../data/strings'

const nameOf = (id: string) => {
  const s = builtInStrings.find((x) => x.id === id)
  return s ? `${s.brand} ${s.name}` : id
}

const BALANCE: Record<string, string> = { headHeavy: 'head-heavy', even: 'medium', headLight: 'head-light' }

/**
 * Player feedback from the string pages, per string. One tap folds the new feedback into the
 * hands-on ratings (your value counts as 3 votes, each feedback as 1) — with a before → after
 * preview — and marks it as applied. Spam can be deleted. Built for a phone first.
 */
export default function FeedbackAdminPage() {
  const [rows, setRows] = useState<StoredFeedback[] | null>(null)
  const [profiles, setProfiles] = useState<Record<string, ExistingProfile>>({})
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    const [fb, pr] = await Promise.all([fetchAllFeedback(), fetchExistingProfiles()])
    if (!fb.ok) return setError(fb.error)
    setRows(fb.data)
    if (pr.ok) setProfiles(pr.data)
  }
  useEffect(() => {
    void load()
  }, [])

  const groups = useMemo(() => {
    const by: Record<string, StoredFeedback[]> = {}
    for (const r of rows ?? []) (by[r.string_id] ??= []).push(r)
    return Object.entries(by).sort((a, b) => b[1].filter((r) => !r.applied_at).length - a[1].filter((r) => !r.applied_at).length || b[1].length - a[1].length)
  }, [rows])

  if (error)
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        Could not load feedback: {error}. Have the migrations 20261006120000_string_feedback.sql and 20261007120000_string_feedback_applied.sql been run in Supabase?
      </p>
    )
  if (!rows) return <p className="text-sm">Loading feedback…</p>
  if (rows.length === 0) return <p className="text-sm">No feedback yet. It appears here as soon as someone sends it from a string page.</p>

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700/80 dark:text-shuttle-100/80">
        {rows.length} feedback{rows.length === 1 ? '' : 's'} · {rows.filter((r) => !r.applied_at).length} not yet in your ratings
      </p>
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-600/10 p-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {groups.map(([stringId, list]) => {
        const fresh = list.filter((r) => !r.applied_at)
        const lines = proposeMerge(profiles[stringId]?.dimensions ?? {}, fresh)
        const changed = changedDimensions(lines)
        const isOpen = open === stringId
        return (
          <section key={stringId} className="paper p-4">
            <button type="button" onClick={() => setOpen(isOpen ? null : stringId)} aria-expanded={isOpen} className="focus-ring flex w-full items-center justify-between gap-3 text-left cursor-pointer">
              <span>
                <span className="block font-semibold text-ink-900 dark:text-shuttle-50">{nameOf(stringId)}</span>
                <span className="block text-xs text-ink-700/80 dark:text-shuttle-100/80">
                  {list.length} total · {fresh.length ? <strong className="text-shuttle-700 dark:text-shuttle-400">{fresh.length} new</strong> : 'all applied'}
                </span>
              </span>
              <span aria-hidden="true" className="text-shuttle-700 dark:text-shuttle-400">{isOpen ? '▴' : '▾'}</span>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-3">
                {fresh.length > 0 && (
                  <div className="rounded-xl border-2 border-shuttle-500/60 bg-shuttle-500/10 p-3">
                    <p className="text-xs font-semibold text-ink-900 dark:text-shuttle-50">Add the new feedback to your hands-on ratings</p>
                    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {lines.map((l) => (
                        <li key={l.dimension} className="flex justify-between gap-2">
                          <span className="text-ink-700/90 dark:text-shuttle-100/90">{l.label}</span>
                          <span className="tabular-nums">
                            {l.current ?? '–'} → <strong className={l.proposed !== l.current ? 'text-court-700 dark:text-shuttle-400' : ''}>{l.proposed ?? '–'}</strong>
                            {l.feedbackCount > 0 && <span className="text-[10px] text-ink-700/70 dark:text-shuttle-100/70"> ({l.feedbackCount}×)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-ink-700/70 dark:text-shuttle-100/70">Your current value counts as {EXISTING_WEIGHT} votes, each feedback as 1.</p>
                    <button
                      type="button"
                      disabled={busy === stringId}
                      onClick={async () => {
                        setBusy(stringId)
                        const r = await applyFeedbackToProfile(stringId, changed, fresh.map((f) => f.id))
                        setBusy(null)
                        if (r.ok) {
                          setNotice(`✓ ${fresh.length} feedback added to ${nameOf(stringId)}${Object.keys(changed).length ? '' : ' (no value changed)'}.`)
                          await load()
                        } else setNotice(`Could not apply: ${r.error}`)
                      }}
                      className="press focus-ring mt-3 w-full rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold py-2.5 cursor-pointer disabled:opacity-50"
                    >
                      {busy === stringId ? 'Adding…' : `Add to ratings (${fresh.length} new)`}
                    </button>
                  </div>
                )}

                <ul className="space-y-2 text-sm">
                  {list.map((r) => (
                    <li key={r.id} className={`rounded-lg p-3 ${r.applied_at ? 'bg-court-900/5 dark:bg-white/5 opacity-70' : 'card-stock border-2 border-court-900/10 dark:border-white/10'}`}>
                      <div className="flex justify-between gap-3 text-xs text-ink-700/70 dark:text-shuttle-100/70">
                        <span>
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.applied_at && ' · ✓ in ratings'}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('Delete this feedback?') && (await deleteFeedback(r.id))) setRows((all) => (all ?? []).filter((x) => x.id !== r.id))
                          }}
                          className="focus-ring underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-1">
                        {[r.racket_name, r.racket_balance && BALANCE[r.racket_balance], r.tension_kg && `${r.tension_kg} kg`, r.level, r.play_style].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="text-xs text-ink-700/80 dark:text-shuttle-100/80">
                        Power {r.rating_power ?? '–'} · Control {r.rating_control ?? '–'} · Comfort {r.rating_comfort ?? '–'} · Durability {r.rating_durability ?? '–'}
                      </p>
                      {r.comment && <p className="mt-1 italic">“{r.comment}”</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
