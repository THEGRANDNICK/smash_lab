import { useEffect, useMemo, useState } from 'react'
import { deleteFeedback, fetchAllFeedback, type StoredFeedback } from '../../services/feedbackService'

const BALANCE: Record<string, string> = { headHeavy: 'head-heavy', even: 'medium', headLight: 'head-light' }
const avg = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => typeof x === 'number')
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'
}

/** Player feedback from the string pages, grouped by string, with averages. Spam can be deleted. */
export default function FeedbackAdminPage() {
  const [rows, setRows] = useState<StoredFeedback[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    void fetchAllFeedback().then((r) => (r.ok ? setRows(r.data) : setError(r.error)))
  }, [])

  const groups = useMemo(() => {
    const by: Record<string, StoredFeedback[]> = {}
    for (const r of rows ?? []) (by[r.string_id] ??= []).push(r)
    return Object.entries(by).sort((a, b) => b[1].length - a[1].length)
  }, [rows])

  if (error)
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        Could not load feedback: {error}. Has the migration 20261006120000_string_feedback.sql been run in Supabase?
      </p>
    )
  if (!rows) return <p className="text-sm">Loading feedback…</p>
  if (rows.length === 0) return <p className="text-sm">No feedback yet. It appears here as soon as someone sends it from a string page.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700/80 dark:text-shuttle-100/80">
        {rows.length} feedback{rows.length === 1 ? '' : 's'} on {groups.length} string{groups.length === 1 ? '' : 's'}. Ratings are 1–5.
      </p>
      {groups.map(([stringId, list]) => (
        <section key={stringId} className="rounded-xl border-2 border-court-900/10 dark:border-white/10 p-4">
          <button type="button" onClick={() => setOpen(open === stringId ? null : stringId)} className="focus-ring w-full text-left cursor-pointer">
            <span className="font-semibold">{stringId}</span> <span className="text-sm text-ink-700/70 dark:text-shuttle-100/70">· {list.length}×</span>
            <span className="block text-xs text-ink-700/80 dark:text-shuttle-100/80">
              Power {avg(list.map((r) => r.rating_power))} · Control {avg(list.map((r) => r.rating_control))} · Comfort {avg(list.map((r) => r.rating_comfort))} · Durability{' '}
              {avg(list.map((r) => r.rating_durability))} · Tension Ø {avg(list.map((r) => r.tension_kg))} kg
            </span>
          </button>
          {open === stringId && (
            <ul className="mt-3 space-y-2 text-sm">
              {list.map((r) => (
                <li key={r.id} className="rounded-lg bg-court-900/5 dark:bg-white/5 p-3">
                  <div className="flex justify-between gap-3">
                    <span className="text-xs text-ink-700/70 dark:text-shuttle-100/70">{new Date(r.created_at).toLocaleDateString()}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('Delete this feedback?') && (await deleteFeedback(r.id))) setRows((all) => (all ?? []).filter((x) => x.id !== r.id))
                      }}
                      className="focus-ring text-xs underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                  <p>
                    {[r.racket_name, r.racket_balance && BALANCE[r.racket_balance], r.tension_kg && `${r.tension_kg} kg`, r.level, r.play_style].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-xs text-ink-700/80 dark:text-shuttle-100/80">
                    P {r.rating_power ?? '–'} · C {r.rating_control ?? '–'} · Co {r.rating_comfort ?? '–'} · D {r.rating_durability ?? '–'}
                  </p>
                  {r.comment && <p className="mt-1 italic">“{r.comment}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
