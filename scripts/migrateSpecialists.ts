// ONE-TIME (but safely re-runnable) import: copies every profile in
// src/data/stringSpecialistProfiles.ts's STRING_SPECIALIST_PROFILES into
// public.specialist_profiles.
//
// Phase 6 built the read path (services/specialistProfileService.ts) and
// the admin write path (services/specialistAdminService.ts) for
// specialist_profiles, but never a script to actually copy the existing
// LOCAL data in — so a fresh public.specialist_profiles table starts
// empty and the #admin/specialists tab has nothing to show until this is
// run. Running it does NOT change recommendation behavior: the engine
// already treats "no live profile for this string" as "use the local
// fallback for it" (services/specialistProfileService.ts's fetch has no
// completeness gate, unlike the catalog), so recommendations are
// identical whether this script has been run or not — this only makes
// the admin UI (and any future editing) reflect what's already live on
// the public site today.
//
// Run:        VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:specialists
// Dry run:    VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:specialists -- --dry-run
// Overwrite:  VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:specialists -- --force
// (or put both env vars in .env.local for this run only — this script loads it automatically.
//  Prefer setting them inline in your shell for a single run over leaving the service-role key
//  sitting in a file any longer than it needs to.)
//
// Uses the service-role key because this is a one-time admin/dev
// operation that needs to write regardless of admin_users state — never
// used by the website itself, never a VITE_-prefixed variable, never
// committed.
//
// Safe to re-run:
//   - Every local profile is validated with the exact same row-shape
//     validator the public read path uses (mapSpecialistProfileRow) before
//     being written — a profile that would be rejected on read is never
//     written, and is reported as FAILED with the validator's reason.
//   - A string_id with no matching row in public.strings is skipped as
//     FAILED (never inserted) rather than risk a foreign-key violation —
//     existing catalog ids are never created or altered by this script.
//   - A string_id with NO existing live profile is INSERTED.
//   - A string_id that ALREADY has a live profile is, by default, left
//     alone and reported as SKIPPED — this script never silently
//     overwrites data an admin may have already edited live. Pass
//     --force to explicitly opt into overwriting those rows too.
//   - Nothing is ever deleted.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'
import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile } from '../src/data/stringSpecialistProfiles.js'
import { mapSpecialistProfileRow } from '../src/services/specialistProfileService.js'

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

type SpecialistRow = Database['public']['Tables']['specialist_profiles']['Row']
type SpecialistInsert = Database['public']['Tables']['specialist_profiles']['Insert']

/** Converts a local StringSpecialistProfile into the same Row shape mapSpecialistProfileRow validates — updated_at is a required Row field but is never read by the validator, so a placeholder is fine here (the real column default takes over on actual insert). */
function toValidationRow(stringId: string, profile: StringSpecialistProfile): SpecialistRow {
  return {
    string_id: stringId,
    feel: profile.feel ?? null,
    personal_tension_min_kg: profile.personalTensionKg?.min ?? null,
    personal_tension_max_kg: profile.personalTensionKg?.max ?? null,
    experience_source: profile.experienceSource,
    confidence: profile.confidence,
    dimensions: profile.dimensions,
    dimension_confidence: profile.dimensionConfidence ?? null,
    strengths: profile.strengths ?? null,
    weaknesses: profile.weaknesses ?? null,
    specialist_tags: profile.specialistTags ?? null,
    subjective_notes: profile.subjectiveNotes ?? null,
    reviewer: profile.reviewer ?? null,
    updated_at: new Date().toISOString(),
  }
}

function toInsertRow(validated: SpecialistRow): SpecialistInsert {
  // Drop updated_at so the column's own default/trigger stamps the real write time
  // instead of this script's placeholder.
  const { updated_at: _updated_at, ...rest } = validated
  return rest
}

interface OutcomeRecord {
  stringId: string
  reason?: string
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')

  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error('✗ VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set.')
    console.error('  This one-time import needs the service-role key (never used by the website itself)')
    console.error('  to bypass RLS and write regardless of admin_users state.')
    console.error('  Run: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:specialists')
    process.exit(1)
  }

  const entries = Object.entries(STRING_SPECIALIST_PROFILES)
  if (entries.length === 0) {
    console.error('✗ STRING_SPECIALIST_PROFILES has no entries — nothing to migrate. Aborting rather than writing zero rows.')
    process.exit(1)
  }

  const client = createClient<Database>(url, serviceRoleKey)

  console.log(`Validating ${entries.length} local specialist profile(s)...`)
  const validated = new Map<string, SpecialistRow>()
  const failed: OutcomeRecord[] = []

  for (const [stringId, profile] of entries) {
    const result = mapSpecialistProfileRow(toValidationRow(stringId, profile))
    if (result.ok) {
      validated.set(stringId, toValidationRow(stringId, profile))
    } else {
      failed.push({ stringId, reason: result.reason })
    }
  }

  if (validated.size === 0) {
    console.error(`✗ All ${failed.length} local profile(s) failed validation — nothing to write:`)
    for (const f of failed) console.error(`  - ${f.stringId}: ${f.reason}`)
    process.exit(1)
  }

  console.log(`Checking which of ${validated.size} validated profile(s) have a matching public.strings row...`)
  const { data: catalogRows, error: catalogError } = await client.from('strings').select('id').in('id', [...validated.keys()])
  if (catalogError) {
    console.error(`✗ Could not read public.strings to confirm catalog ids: ${catalogError.message}`)
    process.exit(1)
  }
  const catalogIds = new Set((catalogRows ?? []).map((r) => r.id))
  for (const stringId of [...validated.keys()]) {
    if (!catalogIds.has(stringId)) {
      failed.push({ stringId, reason: 'no matching row in public.strings — catalog must be seeded/migrated first' })
      validated.delete(stringId)
    }
  }

  console.log(`Checking which of ${validated.size} remaining profile(s) already have a live specialist_profiles row...`)
  const { data: existingRows, error: existingError } = await client.from('specialist_profiles').select('string_id').in('string_id', [...validated.keys()])
  if (existingError) {
    console.error(`✗ Could not read public.specialist_profiles to check for existing rows: ${existingError.message}`)
    process.exit(1)
  }
  const existingIds = new Set((existingRows ?? []).map((r) => r.string_id))

  const toInsert: OutcomeRecord[] = []
  const toUpdate: OutcomeRecord[] = []
  const skipped: OutcomeRecord[] = []

  for (const stringId of validated.keys()) {
    if (!existingIds.has(stringId)) {
      toInsert.push({ stringId })
    } else if (force) {
      toUpdate.push({ stringId })
    } else {
      skipped.push({ stringId, reason: 'a live profile already exists — pass --force to overwrite it' })
    }
  }

  if (dryRun) {
    console.log(`\n[dry run] Would INSERT ${toInsert.length}: ${toInsert.map((r) => r.stringId).join(', ') || '(none)'}`)
    console.log(`[dry run] Would UPDATE ${toUpdate.length} (--force): ${toUpdate.map((r) => r.stringId).join(', ') || '(none)'}`)
    console.log(`[dry run] Would SKIP ${skipped.length} (already live, no --force): ${skipped.map((r) => r.stringId).join(', ') || '(none)'}`)
    console.log(`[dry run] Would FAIL ${failed.length}: ${failed.map((r) => `${r.stringId} (${r.reason})`).join('; ') || '(none)'}`)
    console.log('\n[dry run] No writes were made. Re-run without --dry-run to apply.')
    return
  }

  const writeIds = new Set([...toInsert, ...toUpdate].map((r) => r.stringId))
  const rowsToWrite = [...validated.entries()].filter(([id]) => writeIds.has(id)).map(([, row]) => toInsertRow(row))

  if (rowsToWrite.length > 0) {
    const { error: upsertError } = await client.from('specialist_profiles').upsert(rowsToWrite, { onConflict: 'string_id' })
    if (upsertError) {
      console.error(`✗ Upsert failed — no rows from this run were written: ${upsertError.message}`)
      process.exit(1)
    }
  }

  console.log(`\n✓ Done.`)
  console.log(`  Inserted: ${toInsert.length}${toInsert.length > 0 ? ` (${toInsert.map((r) => r.stringId).join(', ')})` : ''}`)
  console.log(`  Updated:  ${toUpdate.length}${toUpdate.length > 0 ? ` (${toUpdate.map((r) => r.stringId).join(', ')})` : ''}`)
  console.log(`  Skipped:  ${skipped.length}${skipped.length > 0 ? ` (${skipped.map((r) => r.stringId).join(', ')})` : ''}`)
  console.log(`  Failed:   ${failed.length}${failed.length > 0 ? ` (${failed.map((r) => `${r.stringId}: ${r.reason}`).join('; ')})` : ''}`)
  console.log('\nNo rows were deleted. Existing live profiles were left untouched unless --force was passed.')
}

// Guarded so this file can be imported without triggering a real import
// run as a side effect — main() only runs when this file is executed
// directly. Compared via pathToFileURL rather than a hand-built
// `file://${...}` string: on Windows, import.meta.url is a
// file:///E:/... URL while process.argv[1] is a Windows filesystem path
// (backslashes, no leading slash), so a naive string comparison never
// matches and main() silently never runs. pathToFileURL normalizes
// process.argv[1] the same way Node derived import.meta.url, so the
// comparison is correct on Windows and POSIX alike.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
