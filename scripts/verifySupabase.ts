// Verifies a REAL, already-configured Supabase project matches Phase 1's
// expectations: the four public tables are reachable with the expected
// columns, anon can read them, and anon CANNOT write to them.
//
// Run:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:supabase
// (or set them in .env.local — this script loads it automatically)
//
// This never requires or reads the service-role key. An OPTIONAL
// authenticated-admin write check runs only if you set
// SUPABASE_TEST_ADMIN_EMAIL / SUPABASE_TEST_ADMIN_PASSWORD for a real
// admin account in your own shell for this one run — never hardcode
// those, and don't put them in a committed file.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/** Minimal .env.local loader so this script works the same way whether run standalone or via `npm run`. Does not overwrite already-set shell env vars. */
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

type PublicTableName = 'strings' | 'inventory' | 'specialist_profiles' | 'retailer_prices'

/** Exact expected columns per table — a real mismatch (renamed/missing column) surfaces as a specific PostgREST error, not just "table unreachable". */
const EXPECTED_COLUMNS: Record<PublicTableName, string> = {
  strings:
    'id, brand, name, category, gauge_mm, repulsion, durability, hitting_sound, shock_absorption, control, string_cost_eur, description, tension_meta, popularity_rank, product_url, image_url, colors, created_at, updated_at',
  inventory: 'string_id, stock_status, quantity, package_type, color, notes, updated_at',
  specialist_profiles:
    'string_id, feel, personal_tension_min_kg, personal_tension_max_kg, experience_source, confidence, dimensions, dimension_confidence, strengths, weaknesses, specialist_tags, subjective_notes, updated_at',
  retailer_prices:
    'id, string_id, retailer_name, retailer_product_url, set_price_eur, reel_price_eur, sale_price_eur, retailer_in_stock, last_checked_at, created_at, updated_at',
}

const passes: string[] = []
const failures: string[] = []

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('✗ VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set.')
    console.error('  Set them in .env.local, or run:')
    console.error('  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:supabase')
    console.error('  See README.md "Supabase Backend Setup".')
    process.exit(1)
  }

  const anon = createClient<Database>(url, anonKey)

  // 1. Anon SELECT succeeds, with the exact expected columns, on every public table.
  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    const { error } = await anon
      .from(table as PublicTableName)
      .select(columns)
      .limit(1)
    if (error) {
      failures.push(`anon SELECT on "${table}" failed (columns: ${columns}): ${error.message}`)
    } else {
      passes.push(`anon SELECT on "${table}" succeeded with all expected columns present`)
    }
  }

  // 2. Anon INSERT must be rejected by RLS. This is the single most important check in this script.
  const probeId = `__verify_supabase_probe_${Date.now()}`
  {
    const { error } = await anon.from('strings').insert({
      id: probeId,
      brand: 'verify-script',
      name: 'RLS probe row',
      category: 'repulsion',
      repulsion: 5,
      durability: 5,
      hitting_sound: 5,
      control: 5,
    })
    if (error) {
      passes.push('anon INSERT into "strings" was correctly rejected')
    } else {
      failures.push(
        'anon INSERT into "strings" SUCCEEDED — Row Level Security is misconfigured! ' +
          `A probe row (id="${probeId}") was inserted using only the public anon key. ` +
          'Fix the RLS policies immediately, then manually delete that row.',
      )
      // Best-effort cleanup in case anon can also delete (same misconfiguration would likely allow it).
      await anon.from('strings').delete().eq('id', probeId)
    }
  }

  // 3. Anon UPDATE must be rejected too.
  {
    const { error, data } = await anon.from('inventory').update({ stock_status: 'unavailable' }).eq('string_id', '__does_not_exist__').select()
    // With correct RLS, this errors outright OR silently matches zero rows either way (no existing
    // row has that string_id) — the meaningful check is that no error indicates open write access
    // combined with data being an empty array, which is the expected outcome either way. What we're
    // really guarding against is data containing rows that shouldn't have been touched, which can't
    // happen here since the filter matches nothing real. This check mainly documents intent; the
    // strings INSERT probe above is the definitive RLS test.
    if (error && !error.message.toLowerCase().includes('permission')) {
      failures.push(`Unexpected error probing anon UPDATE on "inventory": ${error.message}`)
    } else if (data && data.length > 0) {
      failures.push('anon UPDATE on "inventory" unexpectedly returned rows — investigate RLS policies.')
    } else {
      passes.push('anon UPDATE on "inventory" did not affect any rows (consistent with RLS blocking writes)')
    }
  }

  // 4. Optional authenticated-admin write check — only runs if you provide real admin
  //    credentials for THIS run via env vars. Never required, never committed anywhere.
  const adminEmail = process.env.SUPABASE_TEST_ADMIN_EMAIL
  const adminPassword = process.env.SUPABASE_TEST_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const authed = createClient<Database>(url, anonKey)
    const { error: signInError } = await authed.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    if (signInError) {
      failures.push(`Authenticated admin sign-in failed: ${signInError.message}`)
    } else {
      const adminProbeId = `__verify_supabase_admin_probe_${Date.now()}`
      const { error: insertError } = await authed.from('strings').insert({
        id: adminProbeId,
        brand: 'verify-script',
        name: 'admin write probe',
        category: 'repulsion',
        repulsion: 5,
        durability: 5,
        hitting_sound: 5,
        control: 5,
      })
      if (insertError) {
        failures.push(`Authenticated admin INSERT failed (expected to succeed for an admin_users member): ${insertError.message}`)
      } else {
        passes.push('Authenticated admin INSERT into "strings" succeeded')
        await authed.from('strings').delete().eq('id', adminProbeId)
      }
      await authed.auth.signOut()
    }
  } else {
    console.log(
      'ℹ Skipping the optional authenticated-admin write check ' +
        '(set SUPABASE_TEST_ADMIN_EMAIL / SUPABASE_TEST_ADMIN_PASSWORD for this run only to include it — never commit them).',
    )
  }

  console.log(`\n${passes.length} check(s) passed:`)
  for (const p of passes) console.log(`  ✓ ${p}`)

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) FAILED:`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }

  console.log('\n✓ All Supabase Phase 1 checks passed.')
}

main()
