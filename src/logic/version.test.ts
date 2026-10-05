import { describe, it, expect } from 'vitest'
import { buildVersionInfo, formatDisplayVersion } from './version'

describe('version shown in the admin footer', () => {
  it('a plain release number like 2.0.0 (Smash Lab v2) is shown as "v2.0.0"', () => {
    expect(formatDisplayVersion('2.0.0')).toBe('v2.0.0')
    expect(buildVersionInfo('2.0.0', true)).toEqual({ raw: '2.0.0', display: 'v2.0.0', environment: 'Production' })
  })
})
