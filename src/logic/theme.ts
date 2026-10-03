// The Auto / Light / Dark choice. The heavy lifting (applying it before first paint and following
// the device in "auto") is done by public/theme-init.js; this module reads and changes the choice.

export type ThemePref = 'auto' | 'light' | 'dark'
export const THEME_KEY = 'smashlab.theme'
export const THEME_ORDER: ThemePref[] = ['auto', 'light', 'dark']

export function readThemePref(storage: Pick<Storage, 'getItem'> | null): ThemePref {
  try {
    const v = storage?.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function nextThemePref(current: ThemePref): ThemePref {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]
}

/** Which theme is actually shown for a choice, given whether the device prefers dark. */
export function resolveTheme(pref: ThemePref, deviceDark: boolean): 'light' | 'dark' {
  return pref === 'auto' ? (deviceDark ? 'dark' : 'light') : pref
}

export function saveThemePref(pref: ThemePref): void {
  try {
    if (pref === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, pref)
  } catch {
    // private mode: still applied for this visit below
  }
  const apply = (window as unknown as { __smashlabApplyTheme?: () => void }).__smashlabApplyTheme
  if (apply) apply()
  else {
    const dark = resolveTheme(pref, window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false) === 'dark'
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }
}
