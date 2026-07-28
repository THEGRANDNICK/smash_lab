// Phase 8 polish — remembers which comparison view (Radar vs Table) the
// visitor last picked for the current browser session only, per the brief
// ("component state or sessionStorage... do not require an account or
// database persistence"). Pure read/write helpers, independent of any
// specific Storage implementation, so they're trivially testable without a
// real browser.

export type ComparisonView = 'radar' | 'table'

export const COMPARISON_VIEW_STORAGE_KEY = 'smashlab:comparisonView'

/** The product default as of this polish pass — Radar is preferred over the table. */
export const DEFAULT_COMPARISON_VIEW: ComparisonView = 'radar'

export function isComparisonView(value: unknown): value is ComparisonView {
  return value === 'radar' || value === 'table'
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/**
 * Reads the remembered view from a Storage-like object (sessionStorage in
 * the browser). Never throws — some privacy modes/embedded contexts throw
 * on any sessionStorage access — falling back to DEFAULT_COMPARISON_VIEW.
 */
export function readStoredComparisonView(storage: ReadableStorage | undefined | null): ComparisonView {
  if (!storage) return DEFAULT_COMPARISON_VIEW
  try {
    const raw = storage.getItem(COMPARISON_VIEW_STORAGE_KEY)
    return isComparisonView(raw) ? raw : DEFAULT_COMPARISON_VIEW
  } catch {
    return DEFAULT_COMPARISON_VIEW
  }
}

/** Never throws — a full or unavailable storage just means the choice won't be remembered next time, not a broken page. */
export function writeStoredComparisonView(storage: WritableStorage | undefined | null, view: ComparisonView): void {
  if (!storage) return
  try {
    storage.setItem(COMPARISON_VIEW_STORAGE_KEY, view)
  } catch {
    // ignore
  }
}
