// Sending and (for admins) reading string feedback. Visitors can only insert — see the migration.
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { Database } from '../types/database'
import type { FeedbackRow } from '../logic/feedback'

export type StoredFeedback = Database['public']['Tables']['string_feedback']['Row']

export function feedbackAvailable(): boolean {
  return isSupabaseConfigured
}

export async function submitFeedback(row: FeedbackRow): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await getSupabaseClient().from('string_feedback').insert(row)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Admins only (RLS): every feedback, newest first. */
export async function fetchAllFeedback(): Promise<{ ok: true; data: StoredFeedback[] } | { ok: false; error: string }> {
  try {
    const { data, error } = await getSupabaseClient().from('string_feedback').select('*').order('created_at', { ascending: false }).limit(1000)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as StoredFeedback[] }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const { error } = await getSupabaseClient().from('string_feedback').delete().eq('id', id)
  return !error
}
