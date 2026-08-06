// Phase 14 podium refinement — lets the recommendation result page's
// podium hand off a chosen set of strings to the Compare page's own
// selection state, without any shared cross-page context or lifted
// state. Mirrors comparisonViewPreference.ts's established
// read/write-via-sessionStorage pattern exactly: same never-throws
// contract, same "read once on mount, don't re-derive" usage. Read-once:
// the Compare page consumes and clears this on mount, so it never
// re-applies on a later, unrelated visit.

export const PENDING_COMPARISON_STORAGE_KEY = 'smashlab:pendingComparisonSelection'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

/** Never throws — some privacy modes/embedded contexts throw on any sessionStorage access — falling back to an empty selection. */
export function readPendingComparisonSelection(storage: ReadableStorage | undefined | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(PENDING_COMPARISON_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return isStringArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Never throws — a full or unavailable storage just means the hand-off is silently skipped, not a broken page. */
export function writePendingComparisonSelection(storage: WritableStorage | undefined | null, ids: string[]): void {
  if (!storage) return
  try {
    storage.setItem(PENDING_COMPARISON_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

/** Reads and clears in one step — the intended "consume once" usage on the Compare page's mount. */
export function consumePendingComparisonSelection(storage: WritableStorage | undefined | null): string[] {
  const ids = readPendingComparisonSelection(storage)
  if (!storage) return ids
  try {
    storage.removeItem(PENDING_COMPARISON_STORAGE_KEY)
  } catch {
    // ignore
  }
  return ids
}
