import { describe, it, expect } from 'vitest'
import { strings } from '../data/strings'
import { mapCatalogRow } from '../services/catalogService'
import { missingFromDatabase, stringItemToInsert } from './catalogSync'

describe('adding built-in strings to the database', () => {
  it('every built-in string survives the round trip to a database row and back unchanged', () => {
    for (const item of strings) {
      const row = { created_at: '', updated_at: '', image_url: null, image_back_url: null, image_meta: null, ...stringItemToInsert(item) }
      const back = mapCatalogRow(row as never)
      expect(back.ok, `${item.id}: ${back.ok ? '' : back.reason}`).toBe(true)
      if (!back.ok) continue
      // stock and set counts come from the separate inventory table, never from the strings row
      const { stock: _a, setsAvailable: _c, ...expected } = item
      const { stock: _b, setsAvailable: _d, ...actual } = back.item
      expect(actual, item.id).toEqual(expected)
    }
  })

  it('finds exactly the strings the database is missing', () => {
    const db = new Set(strings.map((s) => s.id).filter((id) => !['lining-no5', 'lining-no7'].includes(id)))
    expect(missingFromDatabase(strings, db).map((s) => s.id)).toEqual(['lining-no5', 'lining-no7'])
  })
})
