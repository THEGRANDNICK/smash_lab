// Minimal authentication foundation for the future admin interface
// (Phase 3+). No visible login page exists yet in Phase 1 — these are
// just the small, typed helpers a login form will call later.
//
// Public sign-up must be disabled in the Supabase dashboard (Authentication
// -> Providers -> Email -> "Allow new users to sign up" turned off) — see
// README.md "Supabase Backend Setup". This file deliberately has no
// sign-up helper at all, so there's nothing here that could accidentally
// wire up self-registration even by mistake.

import type { Session, Subscription } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

/** The current session, or null if signed out. */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throw error
  return data.session
}

/** Signs in an existing admin user. There is no corresponding sign-up helper — admin accounts are created manually in the Supabase dashboard. */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.session) throw new Error('Sign-in succeeded but no session was returned.')
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) throw error
}

/** Subscribes to sign-in/sign-out/token-refresh events. Call the returned unsubscribe function on cleanup (e.g. a React effect's return). */
export function onAuthStateChange(callback: (session: Session | null) => void): Subscription {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return subscription
}
