import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthStateChange, signInWithPassword, signOut as signOutHelper } from '../lib/auth'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export type AdminAuthStatus = 'checking' | 'unauthenticated' | 'authenticated-non-admin' | 'authenticated-admin' | 'error'

export interface AdminAuthState {
  status: AdminAuthStatus
  session: Session | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

/**
 * Tracks session + admin status for the admin area. Admin status always
 * comes from the is_admin() RPC (see supabase/migrations) — never from
 * querying admin_users directly, and never from a client-side guess.
 *
 * A monotonically increasing token guards against race conditions: if a
 * user signs out while an admin check for the previous session is still
 * in flight, that stale check's result is discarded rather than
 * overwriting the newer "signed out" state.
 */
export function useAdminAuth(): AdminAuthState {
  const [status, setStatus] = useState<AdminAuthStatus>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkTokenRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function checkAdmin(nextSession: Session | null) {
      const myToken = ++checkTokenRef.current
      if (cancelled) return
      setSession(nextSession)

      if (!nextSession) {
        if (myToken === checkTokenRef.current) {
          setStatus('unauthenticated')
          setError(null)
        }
        return
      }

      try {
        const { data, error: rpcError } = await getSupabaseClient().rpc('is_admin')
        if (cancelled || myToken !== checkTokenRef.current) return // superseded by a newer sign-in/sign-out
        if (rpcError) {
          setStatus('error')
          setError(rpcError.message)
          return
        }
        setStatus(data ? 'authenticated-admin' : 'authenticated-non-admin')
        setError(null)
      } catch (err) {
        if (cancelled || myToken !== checkTokenRef.current) return
        setStatus('error')
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    if (!isSupabaseConfigured) {
      setStatus('error')
      setError('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).')
      return
    }

    getSession()
      .then((s) => void checkAdmin(s))
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : String(err))
        }
      })

    const subscription = onAuthStateChange((nextSession) => void checkAdmin(nextSession))

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignIn(email: string, password: string) {
    // Throws on failure — the login form catches this and shows it.
    // On success, onAuthStateChange fires and re-runs the admin check;
    // no manual state update needed here.
    await signInWithPassword(email, password)
  }

  async function handleSignOut() {
    await signOutHelper()
  }

  return { status, session, error, signIn: handleSignIn, signOut: handleSignOut }
}
