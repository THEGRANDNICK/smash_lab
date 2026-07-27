// ONE-TIME migration: backfills public.inventory from the stock/
// setsAvailable values already hard-coded in src/data/strings.ts, so the
// database has a starting point that matches exactly what the site
// currently shows. Values are read programmatically from strings.ts —
// nothing here is hand-typed or duplicated.
//
// Run:  VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory
// (or put both in .env.local — this script loads it automatically)
//
// Uses the service-role key because this is a one-time admin/dev
// operation that needs to write regardless of whether admin_users has
// been populated yet — never used by the website itself, never a
// VITE_-prefixed variable. See README.md "Supabase Backend Setup".
//
// Safe to re-run: every row is UPSERTed by string_id (the inventory
// table's primary key), nothing is ever deleted, and color/notes are
// deliberately left out of the payload so a later admin edit to those
// two fields (once the Phase 3+ admin UI exists) survives a re-run
// untouched — only stock_status/quantity/package_type get overwritten
// back to strings.ts's current values each time this runs. That's fine
// for its one-time purpose; don't run this again casually after the
// admin UI becomes the real source of truth for stock.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'
import { strings as catalog } from '../src/data/strings.js'

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

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('✗ VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set.')
    console.error('  This one-time migration needs the service-role key (never used by the website itself)')
    console.error('  to bypass RLS and backfill inventory regardless of admin_users state.')
    console.error('  Run: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:inventory')
    process.exit(1)
  }

  const client = createClient<Database>(url, serviceRoleKey)

  const rows = catalog.map((item) => ({
    string_id: item.id,
    stock_status: item.stock,
    quantity: item.setsAvailable ?? null,
    package_type: 'unknown' as const,
    // color/notes intentionally omitted from the payload — see header comment.
  }))

  if (rows.length === 0) {
    console.error('✗ strings.ts has no entries — nothing to migrate. Aborting rather than writing zero rows.')
    process.exit(1)
  }

  console.log(`Upserting ${rows.length} inventory row(s) from strings.ts's current stock/setsAvailable values...`)

  const { data, error } = await client.from('inventory').upsert(rows, { onConflict: 'string_id' }).select('string_id')

  if (error) {
    console.error(`✗ Migration failed, nothing further was written: ${error.message}`)
    process.exit(1)
  }

  console.log(`\n✓ Upserted ${data?.length ?? rows.length} row(s):`)
  for (const row of rows) {
    console.log(`  - ${row.string_id}: ${row.stock_status}${row.quantity != null ? ` (qty ${row.quantity})` : ''}`)
  }
  console.log('\nNo rows were deleted. Existing color/notes values (if any) were left untouched.')
}

main()
