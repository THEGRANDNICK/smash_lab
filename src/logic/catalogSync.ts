// Bringing built-in strings (src/data/strings.ts) into the database catalog.
//
// The public site only trusts the live catalog when it contains EVERY built-in string
// (catalogService.isLiveCatalogComplete). If even one is missing from the database, the whole
// live catalog — images, prices, stock — is ignored and the built-in data is shown instead. This
// turns a built-in string into exactly the database row that catalogService reads back, so the
// missing ones can be added with one click (Admin → Imports).

import type { StringItem } from '../data/strings'
import type { Database } from '../types/database'

export type StringsInsert = Database['public']['Tables']['strings']['Insert']

export function stringItemToInsert(item: StringItem): StringsInsert {
  const { gauge, ...tensionRest } = item.tension ?? {}
  return {
    id: item.id,
    brand: item.brand,
    name: item.name,
    category: item.category,
    gauge_mm: gauge ?? null,
    repulsion: item.repulsion,
    durability: item.durability,
    hitting_sound: item.hittingSound,
    shock_absorption: item.shockAbsorption ?? null,
    control: item.control,
    string_cost_eur: item.stringCost ?? null,
    description: item.notes ?? null,
    tension_meta: Object.keys(tensionRest).length > 0 ? tensionRest : null,
    popularity_rank: item.popularityRank ?? null,
    product_url: item.productUrl ?? null,
    colors: item.colors ?? null,
    is_hybrid: item.isHybrid === true,
    main_string_meta: item.mainString ?? null,
    cross_string_meta: item.crossString ?? null,
  }
}

/** Built-in strings that the database catalog doesn't have (in built-in order). */
export function missingFromDatabase(builtIn: StringItem[], databaseIds: ReadonlySet<string>): StringItem[] {
  return builtIn.filter((s) => !databaseIds.has(s.id))
}
