import { describe, it, expect } from 'vitest'
import { nextThemePref, readThemePref, resolveTheme } from './theme'

describe('Auto / Light / Dark', () => {
  it('cycles auto → light → dark → auto', () => {
    expect(nextThemePref('auto')).toBe('light')
    expect(nextThemePref('light')).toBe('dark')
    expect(nextThemePref('dark')).toBe('auto')
  })
  it('auto follows the device; light and dark override it', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('anything unknown or unreadable counts as auto', () => {
    expect(readThemePref({ getItem: () => 'purple' })).toBe('auto')
    expect(readThemePref({ getItem: () => { throw new Error('blocked') } })).toBe('auto')
    expect(readThemePref(null)).toBe('auto')
  })
})
