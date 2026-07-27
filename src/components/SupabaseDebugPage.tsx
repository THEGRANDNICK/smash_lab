// Development-only diagnostic page. Rendered by App.tsx ONLY when
// import.meta.env.DEV is true and the URL hash is exactly
// #debug-supabase — there is no link to this page anywhere in the
// normal UI (Nav, Footer, Hero, etc. never reference it). It's a
// read-only report; it doesn't add a login form (that's Phase 3) and
// never touches the service-role key.

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase'
import { getSession } from '../lib/auth'
import { getLastFetchStatus, fetchInventoryFromSupabase, findMissingInventoryIds, getLocalFallbackInventory } from '../services/inventoryService'
import { getLastCatalogFetchStatus, fetchCatalogFromSupabase } from '../services/catalogService'
import { STRING_SPECIALIST_PROFILES } from '../data/stringSpecialistProfiles'

type ConnectionStatus = 'checking' | 'connected' | 'unreachable' | 'not-configured'

export default function SupabaseDebugPage() {
  const [connection, setConnection] = useState<ConnectionStatus>('checking')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | 'unknown'>('unknown')
  const [inventoryCount, setInventoryCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missingInventoryIds, setMissingInventoryIds] = useState<string[]>([])
  const [orphanSpecialistIds, setOrphanSpecialistIds] = useState<string[]>([])
  const [mergedPoolCount, setMergedPoolCount] = useState<number | null>(null)
  // Forces a re-read of getLastFetchStatus()/getLastCatalogFetchStatus() after the effect's fetches resolve.
  const [, setLastFetchTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!isSupabaseConfigured) {
        if (!cancelled) setConnection('not-configured')
        return
      }

      try {
        const session = await getSession()
        if (cancelled) return
        setUserEmail(session?.user.email ?? null)

        const client = getSupabaseClient()

        if (session) {
          const { data, error: rpcError } = await client.rpc('is_admin')
          if (!cancelled) setIsAdmin(rpcError ? 'unknown' : Boolean(data))
        } else {
          setIsAdmin('unknown')
        }

        const { count, error: countError } = await client.from('inventory').select('*', { count: 'exact', head: true })
        if (cancelled) return
        if (countError) {
          setConnection('unreachable')
          setError(countError.message)
        } else {
          setConnection('connected')
          setInventoryCount(count ?? 0)
        }
      } catch (err) {
        if (cancelled) return
        setConnection('unreachable')
        setError(err instanceof Error ? err.message : String(err))
      }

      // Also exercise the exact same fetch + merge path the live site uses
      // (services/catalogService.ts + services/inventoryService.ts), so this
      // page reports reality rather than a separate, possibly-diverging check.
      const [catalogResult, inventory] = await Promise.all([fetchCatalogFromSupabase(), fetchInventoryFromSupabase()])
      if (cancelled) return

      const resolvedInventory = inventory ?? getLocalFallbackInventory()
      setMergedPoolCount(catalogResult.items.length)
      setMissingInventoryIds(findMissingInventoryIds(catalogResult.items, resolvedInventory))
      const catalogIds = new Set(catalogResult.items.map((i) => i.id))
      setOrphanSpecialistIds(Object.keys(STRING_SPECIALIST_PROFILES).filter((id) => !catalogIds.has(id)))
      setLastFetchTick((t) => t + 1)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const lastFetch = getLastFetchStatus()
  const lastCatalogFetch = getLastCatalogFetchStatus()

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mb-1">Development only — not linked from the site</p>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50 mb-6">Supabase Debug</h1>

        <dl className="space-y-4 text-sm">
          <Row label="Configured" value={isSupabaseConfigured ? 'Yes (env vars present)' : 'No — VITE_SUPABASE_URL/ANON_KEY missing'} />
          <Row label="Connection status" value={connectionLabel(connection)} />
          <Row label="Current user" value={userEmail ?? 'Not signed in'} />
          <Row label="Admin" value={isAdmin === 'unknown' ? 'Unknown (not signed in, or RPC failed)' : isAdmin ? 'Yes' : 'No'} />
          <Row label="Inventory row count" value={inventoryCount == null ? '—' : String(inventoryCount)} />
          <Row
            label="Last inventory fetch"
            value={lastFetch ? `${lastFetch.ok ? '✓ OK' : '✗ Failed'} at ${new Date(lastFetch.at).toLocaleTimeString()}${lastFetch.message ? ` — ${lastFetch.message}` : ''}` : 'No fetch recorded yet'}
          />
          {error && <Row label="Error" value={error} />}
        </dl>

        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mt-8 mb-1">Phase 4 — catalog loading</p>
        <dl className="space-y-4 text-sm">
          <Row label="Catalog source" value={lastCatalogFetch ? (lastCatalogFetch.source === 'live' ? '🟢 Live (public.strings)' : '🟡 Local fallback (strings.ts)') : 'Not fetched yet'} />
          <Row
            label="Last catalog fetch"
            value={
              lastCatalogFetch
                ? `${new Date(lastCatalogFetch.at).toLocaleTimeString()} — ${lastCatalogFetch.acceptedCount} accepted, ${lastCatalogFetch.rejectedCount} rejected${lastCatalogFetch.fallbackReason ? ` (fell back: ${lastCatalogFetch.fallbackReason})` : ''}`
                : 'No fetch recorded yet'
            }
          />
          {lastCatalogFetch && lastCatalogFetch.rejectedReasons.length > 0 && <Row label="Rejected row reasons" value={lastCatalogFetch.rejectedReasons.join('; ')} />}
          <Row label="Merged pool size" value={mergedPoolCount == null ? '—' : String(mergedPoolCount)} />
          <Row label="Catalog ids missing an inventory row" value={missingInventoryIds.length === 0 ? 'None' : missingInventoryIds.join(', ')} />
          <Row label="Specialist profiles referencing missing strings" value={orphanSpecialistIds.length === 0 ? 'None' : orphanSpecialistIds.join(', ')} />
        </dl>
      </div>
    </div>
  )
}

function connectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking…'
    case 'connected':
      return '✓ Connected'
    case 'unreachable':
      return '✗ Unreachable'
    case 'not-configured':
      return 'Not configured'
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b border-court-900/5 dark:border-white/5 pb-3">
      <dt className="font-semibold text-ink-700/70 dark:text-shuttle-100/70">{label}</dt>
      <dd className="text-ink-900 dark:text-shuttle-50 font-mono text-xs sm:text-sm break-all sm:text-right">{value}</dd>
    </div>
  )
}
