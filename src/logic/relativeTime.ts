// Small, pure relative-time formatter for admin surfaces (the Phase 11
// dashboard's "Recent data updates" panel). No date library — this app has
// no existing date-formatting dependency, and the ranges needed here are
// simple enough not to justify adding one. `now` is an explicit parameter
// (defaulting to `new Date()`) so callers can test deterministically
// without mocking the system clock.

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** "Just now" / "5 minutes ago" / "3 hours ago" / "Yesterday" / "5 days ago" / a formatted date beyond a week. Never throws on an invalid string — returns it unchanged so a bad value is visible rather than hidden. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return iso

  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 0) return 'Just now' // clock skew / optimistic local write — never show a negative age

  if (diffMs < MINUTE_MS) return 'Just now'
  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }
  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diffMs / DAY_MS)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Whole days between an ISO timestamp and `now` — the shared basis for the dashboard's "stale listing" threshold. Negative/invalid input returns null rather than a misleading number. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / DAY_MS)
}
