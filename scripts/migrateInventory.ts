// ONE-TIME migration: seeds public.strings (a referential-integrity
// prerequisite ONLY — public.inventory.string_id has a foreign key to
// public.strings.id) and then public.inventory, both read programmatically
// from src/data/strings.ts. Nothing here is hand-typed or duplicated.
//
// IMPORTANT: seeding public.strings here does NOT mean the website reads
// catalog data from Supabase — it still reads src/data/strings.ts
// directly, unchanged. This script exists purely so public.inventory's
// foreign key has something to point at; there is no catalog admin UI
// and this is not "Phase 4" (catalog migration) happening early.
//
// Run:        VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory
// Dry run:    VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory -- --dry-run
// (or put both env vars in .env.local for this run only — this script loads it automatically.
//  Prefer setting them inline in your shell for a single run over leaving the service-role key
//  sitting in a file any longer than it needs to.)
//
// Uses the service-role key because this is a one-time admin/dev operation
// that needs to write regardless of admin_users state — never used by the
// website itself, never a VITE_-prefixed variable, never committed.
//
// Safe to re-run:
//   - public.strings: every row is fully re-upserted from strings.ts on
//     every run (by design — strings.ts remains the sole source of truth
//     for catalog data at this stage, and there is no admin UI yet that
//     could have diverged a DB row from it, so there is nothing to
//     preserve on a re-run for this table).
//   - public.inventory: upserted by string_id, and color/notes are
//     deliberately left out of the payload so a later admin edit to
//     those two fields (once the Phase 3+ admin UI exists) survives a
//     re-run untouched — only stock_status/quantity/package_type get
//     overwritten back to strings.ts's current values each time.
// Nothing is ever deleted from either table.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'
import { strings as catalog, type StringItem } from '../src/data/strings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

function loadDotEnvLocal() {
  const path = join(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadDotEnvLocal()

type StringsRow = Database['public']['Tables']['strings']['Insert']
type InventoryRow = Database['public']['Tables']['inventory']['Insert']

/** Maps every catalog field this schema has a column for. Stock/setsAvailable are NOT mapped here — those belong to inventory, not the catalog table. Exported for scripts/testCatalog.ts's round-trip mapping test. */
export function toStringsRow(item: StringItem): StringsRow {
  const t = item.tension
  const hasTensionMeta = t != null && (t.tensionAdjustment != null || t.recommendedMin != null || t.recommendedMax != null || t.tensionNotes != null)

  return {
    id: item.id,
    brand: item.brand,
    name: item.name,
    category: item.category,
    gauge_mm: t?.gauge ?? null,
    repulsion: item.repulsion,
    durability: item.durability,
    hitting_sound: item.hittingSound,
    shock_absorption: item.shockAbsorption,
    control: item.control,
    string_cost_eur: item.stringCost,
    description: item.notes ?? null,
    tension_meta: hasTensionMeta
      ? {
          tensionAdjustment: t!.tensionAdjustment,
          recommendedMin: t!.recommendedMin,
          recommendedMax: t!.recommendedMax,
          tensionNotes: t!.tensionNotes,
        }
      : null,
    popularity_rank: item.popularityRank ?? null,
    product_url: item.productUrl ?? null,
    image_url: item.imageUrl ?? null,
    colors: item.colors ?? null,
  }
}

function toInventoryRow(item: StringItem): InventoryRow {
  return {
    string_id: item.id,
    stock_status: item.stock,
    quantity: item.setsAvailable ?? null,
    package_type: 'unknown',
    // color/notes intentionally omitted — see header comment.
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('✗ VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set.')
    console.error('  This one-time migration needs the service-role key (never used by the website itself)')
    console.error('  to bypass RLS and seed both tables regardless of admin_users state.')
    console.error('  Run: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory')
    process.exit(1)
  }

  const stringsRows = catalog.map(toStringsRow)
  const inventoryRows = catalog.map(toInventoryRow)

  if (stringsRows.length === 0) {
    console.error('✗ strings.ts has no entries — nothing to migrate. Aborting rather than writing zero rows.')
    process.exit(1)
  }

  if (dryRun) {
    console.log(`[dry run] Would seed ${stringsRows.length} row(s) into public.strings (id / brand / name):`)
    for (const r of stringsRows) console.log(`  - ${r.id} (${r.brand} ${r.name})`)
    console.log(`\n[dry run] Would upsert ${inventoryRows.length} row(s) into public.inventory:`)
    for (const r of inventoryRows) console.log(`  - ${r.string_id}: ${r.stock_status}${r.quantity != null ? ` (qty ${r.quantity})` : ''}`)
    console.log('\n[dry run] No writes were made. Re-run without --dry-run to apply.')
    return
  }

  const client = createClient<Database>(url, serviceRoleKey)

  console.log(`Step 1/2: seeding ${stringsRows.length} catalog row(s) into public.strings (referential-integrity prerequisite only — the website keeps reading strings.ts directly)...`)
  const { data: seededStrings, error: stringsError } = await client.from('strings').upsert(stringsRows, { onConflict: 'id' }).select('id')

  if (stringsError) {
    console.error(`✗ Catalog seeding failed — public.inventory was NOT touched: ${stringsError.message}`)
    process.exit(1)
  }

  const confirmedIds = new Set((seededStrings ?? []).map((r) => r.id))
  const unconfirmed = inventoryRows.filter((r) => !confirmedIds.has(r.string_id))
  if (unconfirmed.length > 0) {
    console.error(
      `✗ ${unconfirmed.length} string_id(s) were not confirmed present in public.strings after seeding — aborting before touching inventory to avoid a foreign-key violation: ${unconfirmed.map((r) => r.string_id).join(', ')}`,
    )
    process.exit(1)
  }
  console.log(`✓ Seeded ${seededStrings?.length ?? stringsRows.length} public.strings row(s). All inventory string_ids confirmed present.`)

  console.log(`\nStep 2/2: upserting ${inventoryRows.length} inventory row(s)...`)
  const { data: seededInventory, error: inventoryError } = await client.from('inventory').upsert(inventoryRows, { onConflict: 'string_id' }).select('string_id')

  if (inventoryError) {
    console.error(`✗ Inventory upsert failed: ${inventoryError.message}`)
    process.exit(1)
  }

  console.log(`\n✓ Done — ${seededStrings?.length ?? stringsRows.length} public.strings row(s), ${seededInventory?.length ?? inventoryRows.length} public.inventory row(s):`)
  for (const row of inventoryRows) {
    console.log(`  - ${row.string_id}: ${row.stock_status}${row.quantity != null ? ` (qty ${row.quantity})` : ''}`)
  }
  console.log('\nNo rows were deleted from either table. Existing inventory color/notes values (if any) were left untouched.')
}

// Guarded so this file can be imported (e.g. scripts/testCatalog.ts imports
// toStringsRow for a round-trip mapping test) without triggering a real
// migration run as a side effect — main() only runs when this file is
// executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
