import { useState } from 'react'
import { nextThemePref, readThemePref, saveThemePref, type ThemePref } from '../logic/theme'

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const LABEL: Record<ThemePref, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }

/** One button that cycles Auto → Light → Dark. Remembered on this device. */
export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => readThemePref(typeof window === 'undefined' ? null : window.localStorage))
  const next = nextThemePref(pref)
  return (
    <button
      type="button"
      onClick={() => {
        saveThemePref(next)
        setPref(next)
      }}
      aria-label={`Theme: ${LABEL[pref]} — switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[pref]}`}
      data-sound="flick"
      className="focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-court-900/15 dark:border-white/20 p-2 lg:px-3 text-ink-700/80 dark:text-shuttle-100/80 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
    >
      {pref === 'auto' && (
        <svg {...icon}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </svg>
      )}
      {pref === 'light' && (
        <svg {...icon}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
      {pref === 'dark' && (
        <svg {...icon}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
      <span className="text-xs font-semibold sm:hidden lg:inline">{LABEL[pref]}</span>
    </button>
  )
}
