// Read-only comparison between the live public.strings table and the local
// fallback catalog (src/data/strings.ts). Reuses the exact same mapping and
// validation logic the live website itself uses (services/catalogService.ts)
// so this script's verdict matches what the site would actually do.
//
// Run:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:catalog
// (or set them in .env.local — this script loads it automatically)
//
// Never requires or reads the service-role key — anon key only, same as the
// live public site. Never writes anything. Never fabricates a passing
// result: if Supabase is unreachable, this script reports that plainly and
// exits non-zero rather than pretending the check succeeded.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'
import { getLocalFallbackCatalog, mapCatalogRow, detectDuplicateIds, isLiveCatalogComplete } from '../src/services/catalogService.js'

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
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('✗ VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set.')
    console.error('  Set them in .env.local, or run:')
    console.error('  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:catalog')
    process.exit(1)
  }

  const anon = createClient<Database>(url, anonKey)

  console.log('Fetching live public.strings with the anon key (read-only, same as the public site)...')
  const { data, error } = await anon.from('strings').select('*')

  if (error) {
    console.error(`✗ Could not reach the live catalog: ${error.message}`)
    console.error('  (This script never fabricates a pass — a genuine connection problem is reported as a failure.)')
    process.exit(1)
  }

  const rows = data ?? []
  const localCatalog = getLocalFallbackCatalog()
  const localIds = new Set(localCatalog.map((i) => i.id))

  console.log(`\nLive rows fetched: ${rows.length}`)
  console.log(`Local fallback rows: ${localCatalog.length}\n`)

  if (rows.length === 0) {
    console.error('✗ Live catalog returned zero rows — the site would fall back to the local catalog entirely.')
    process.exit(1)
  }

  const duplicates = detectDuplicateIds(rows)
  if (duplicates.length > 0) {
    console.error(`✗ Duplicate id(s) in live catalog: ${duplicates.join(', ')}`)
  }

  const seen = new Set<string>()
  const accepted: string[] = []
  const rejected: string[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const result = mapCatalogRow(row)
    if (result.ok) accepted.push(result.item.id)
    else rejected.push(result.reason)
  }

  console.log(`Accepted (valid) rows: ${accepted.length}`)
  console.log(`Rejected (invalid) rows: ${rejected.length}`)
  for (const reason of rejected) console.log(`  ✗ ${reason}`)

  const acceptedIds = new Set(accepted)
  const missing = [...localIds].filter((id) => !acceptedIds.has(id))
  const extra = [...acceptedIds].filter((id) => !localIds.has(id))

  console.log(`\nMissing from live (known locally, absent live): ${missing.length}`)
  for (const id of missing) console.log(`  - ${id}`)
  console.log(`Extra in live (not yet in strings.ts): ${extra.length}`)
  for (const id of extra) console.log(`  - ${id}`)

  const complete = isLiveCatalogComplete(localIds, acceptedIds)
  console.log(`\nWould the live site use the LIVE catalog right now? ${complete && rejected.length === 0 ? 'YES' : 'NO — falls back to local strings.ts'}`)

  if (!complete || rejected.length > 0 || duplicates.length > 0) {
    process.exit(1)
  }

  console.log('\n✓ Live catalog is complete and structurally valid.')
}

main()
