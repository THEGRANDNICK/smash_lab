// Product feedback: "Save my setup" — a localStorage-only, no-account way
// to remember a player's last recommendation so a return visit can skip
// straight back to "request this setup" instead of retaking the quiz.
// Mirrors comparisonViewPreference.ts's/dataSourcePreference.ts's
// established Storage-parameter, never-throws pattern. Uses localStorage
// (not sessionStorage) specifically because the point is surviving a
// closed tab/browser restart, unlike the session-only comparison-view
// preference.

export interface SavedSetup {
  stringBrand: string
  stringName: string
  tensionKg: number
  matchPercent: number
  /** The human-readable data-source note shown alongside the result (e.g. "Calibrated with Smash Lab specialist data.") — captured at save time so re-requesting later reproduces the same enquiry message, without needing to re-run the quiz. */
  dataSourceLabel: string
  racketModel?: string
  savedAt: string
}

export const SAVED_SETUP_STORAGE_KEY = 'smashlab:savedSetup'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isSavedSetup(value: unknown): value is SavedSetup {
  if (typeof value !== 'object' || value == null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.stringBrand === 'string' &&
    typeof v.stringName === 'string' &&
    typeof v.tensionKg === 'number' &&
    typeof v.matchPercent === 'number' &&
    typeof v.dataSourceLabel === 'string' &&
    typeof v.savedAt === 'string' &&
    (v.racketModel === undefined || typeof v.racketModel === 'string')
  )
}

/** Never throws — some privacy modes/embedded contexts throw on any localStorage access — falling back to "nothing saved". */
export function readSavedSetup(storage: ReadableStorage | undefined | null): SavedSetup | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(SAVED_SETUP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isSavedSetup(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Never throws — a full or unavailable storage just means the setup won't be remembered next time, not a broken page. */
export function writeSavedSetup(storage: WritableStorage | undefined | null, setup: SavedSetup): void {
  if (!storage) return
  try {
    storage.setItem(SAVED_SETUP_STORAGE_KEY, JSON.stringify(setup))
  } catch {
    // ignore
  }
}

export function clearSavedSetup(storage: WritableStorage | undefined | null): void {
  if (!storage) return
  try {
    storage.removeItem(SAVED_SETUP_STORAGE_KEY)
  } catch {
    // ignore
  }
}
