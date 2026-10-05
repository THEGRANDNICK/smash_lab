import { useEffect, useState } from 'react'

/**
 * useState that survives leaving the page and coming back within the same visit (sessionStorage).
 * Used for list filters: open a string page, press "back to all strings", and your filters are
 * still set. Falls back to plain state when storage isn't available.
 */
export function useSessionState<T>(key: string, initial: T, isValid: (v: unknown) => v is T = (v): v is T => typeof v === typeof initial) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window === 'undefined' ? null : window.sessionStorage.getItem(key)
      if (raw == null) return initial
      const parsed: unknown = JSON.parse(raw)
      return isValid(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // private mode — the filter just isn't remembered
    }
  }, [key, value])
  return [value, setValue] as const
}
