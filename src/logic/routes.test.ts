import { describe, it, expect } from 'vitest'
import { legacyStringIdFromHash, routeFromPath } from './routes'

const BASE = '/smash_lab/'

describe('routeFromPath', () => {
  it('recognises the root page in all its spellings', () => {
    expect(routeFromPath('/smash_lab/', BASE)).toEqual({ kind: 'root' })
    expect(routeFromPath('/smash_lab', BASE)).toEqual({ kind: 'root' })
    expect(routeFromPath('/smash_lab/index.html', BASE)).toEqual({ kind: 'root' })
  })

  it('recognises string pages with and without trailing slash or index.html', () => {
    expect(routeFromPath('/smash_lab/strings/yonex-bg80/', BASE)).toEqual({ kind: 'string', id: 'yonex-bg80' })
    expect(routeFromPath('/smash_lab/strings/yonex-bg80', BASE)).toEqual({ kind: 'string', id: 'yonex-bg80' })
    expect(routeFromPath('/smash_lab/strings/yonex-bg80/index.html', BASE)).toEqual({ kind: 'string', id: 'yonex-bg80' })
  })

  it('recognises the strings overview', () => {
    expect(routeFromPath('/smash_lab/strings/', BASE)).toEqual({ kind: 'stringsIndex' })
    expect(routeFromPath('/smash_lab/strings', BASE)).toEqual({ kind: 'stringsIndex' })
  })

  it('treats everything else as not found', () => {
    expect(routeFromPath('/smash_lab/nope', BASE)).toEqual({ kind: 'notFound' })
    expect(routeFromPath('/smash_lab/strings/a/b', BASE)).toEqual({ kind: 'notFound' })
    expect(routeFromPath('/other/', BASE)).toEqual({ kind: 'notFound' })
    expect(routeFromPath('/smash_lab/strings/%E0%A4%A/', BASE)).toEqual({ kind: 'notFound' }) // broken encoding
  })
})

describe('legacy #string/<id> links', () => {
  it('extracts the id', () => {
    expect(legacyStringIdFromHash('#string/yonex-bg80')).toBe('yonex-bg80')
    expect(legacyStringIdFromHash('#finder')).toBeUndefined()
    expect(legacyStringIdFromHash('#string/')).toBeUndefined()
  })
})
