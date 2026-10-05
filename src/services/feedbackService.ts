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

/**
 * One click in Admin → Feedback: write the merged values into the string's hands-on profile and
 * mark the used feedback as applied (so it can't be counted twice). A string without a profile
 * gets a new one marked as community data with low confidence.
 */
export async function applyFeedbackToProfile(
  stringId: string,
  changed: Record<string, number>,
  feedbackIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = getSupabaseClient()
    const existing = await client.from('specialist_profiles').select('string_id, dimensions').eq('string_id', stringId).maybeSingle()
    if (existing.error) return { ok: false, error: existing.error.message }
    if (Object.keys(changed).length > 0) {
      const write = existing.data
        ? await client
            .from('specialist_profiles')
            .update({ dimensions: { ...((existing.data.dimensions as Record<string, number>) ?? {}), ...changed } })
            .eq('string_id', stringId)
        : await client.from('specialist_profiles').insert({ string_id: stringId, experience_source: 'community', confidence: 'low', dimensions: changed })
      if (write.error) return { ok: false, error: write.error.message }
    }
    const mark = await client.from('string_feedback').update({ applied_at: new Date().toISOString() }).in('id', feedbackIds)
    if (mark.error) return { ok: false, error: mark.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
