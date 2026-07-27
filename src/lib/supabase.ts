// Typed Supabase client foundation — Phase 1 of the Supabase backend.
//
// IMPORTANT: nothing in the current website imports this module yet.
// The public catalog/quiz continues reading src/data/strings.ts and
// src/data/stringSpecialistProfiles.ts exactly as before. This file only
// exists so later phases (starting with Phase 2's inventory read) have a
// single, correctly-typed, safely-configured client to import.
//
// Security note: VITE_SUPABASE_ANON_KEY is meant to be public — it's
// baked into the browser bundle by design, the same way it would be in
// any Supabase project. It grants no access on its own; every table's
// Row Level Security policies (see supabase/migrations/) decide what the
// anon role can actually read or write. The service-role key (which
// bypasses RLS) must NEVER be read from a VITE_-prefixed variable or
// imported from anything under src/ — see .env.example and README.md.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.js'

// Written as the literal `import.meta.env.KEY` expression (only with `?.`
// added) deliberately — Vite statically replaces this exact pattern at
// build time (which is what lets isSupabaseConfigured fold to a compile-time
// constant and tree-shake the entire Supabase client out of an unconfigured
// build, confirmed empirically in earlier phases). Rewriting this through an
// intermediate variable or type-cast defeats that replacement and silently
// breaks tree-shaking — don't refactor this without re-verifying bundle
// size before/after. The `?.` only matters outside Vite (e.g.
// scripts/testCatalog.ts importing this module transitively under plain
// tsx), where import.meta.env itself is undefined; ImportMeta's `env`
// property is typed via tsconfig.node.json's "vite/client" types entry so
// this still type-checks there too.
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

/** True once both required env vars are present — check this before calling getSupabaseClient() if you want to avoid the thrown error, e.g. to render a "not configured" state instead of crashing. */
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabaseAnonKey)

let cachedClient: SupabaseClient<Database> | null = null

/**
 * Returns a shared, typed Supabase client for anon (public) queries and,
 * once a user signs in via the helpers in lib/auth.ts, authenticated admin
 * writes — RLS policies determine what each is actually allowed to do, the
 * client itself doesn't need separate "public" vs "admin" instances.
 *
 * Throws a clear, actionable error if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * aren't set, rather than failing with an opaque network error later. This
 * only happens if something actually calls getSupabaseClient() — merely
 * importing this module (e.g. for its types) never throws.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. ' +
        'Copy .env.example to .env.local, fill in your Supabase project URL and anon key, and restart the dev server. ' +
        'See README.md "Supabase Backend Setup" for the full walkthrough.',
    )
  }

  cachedClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return cachedClient
}
