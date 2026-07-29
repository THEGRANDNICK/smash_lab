// Development-only diagnostic page. Rendered by App.tsx ONLY when
// import.meta.env.DEV is true and the URL hash is exactly
// #debug-supabase — there is no link to this page anywhere in the
// normal UI (Nav, Footer, Hero, etc. never reference it). It's a
// read-only report; it doesn't add a login form (that's Phase 3) and
// never touches the service-role key.

import { useEffect, useState } from 'react'
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase'
import { getSession } from '../lib/auth'
import { getLastFetchStatus, fetchInventoryFromSupabase, findMissingInventoryIds, getLocalFallbackInventory, mergeInventoryIntoCatalog } from '../services/inventoryService'
import { getLastCatalogFetchStatus, fetchCatalogFromSupabase, type CatalogFetchStatus } from '../services/catalogService'
import { fetchSpecialistProfilesFromSupabase, type SpecialistFetchStatus } from '../services/specialistProfileService'
import { fetchRetailerPricesFromSupabase, summarizeRetailerDiagnostics, type RetailerFetchStatus, type RetailerDiagnostics } from '../services/retailerPriceService'
import { fetchRetailersFromSupabase, findDuplicateRetailerNameCandidates, type RetailerEntityFetchStatus } from '../services/retailerService'
import { summarizeColorDiagnostics, type ColorDiagnosticsSummary } from '../logic/colorDiagnostics'

type ConnectionStatus = 'checking' | 'connected' | 'unreachable' | 'not-configured'

export default function SupabaseDebugPage() {
  const [connection, setConnection] = useState<ConnectionStatus>('checking')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | 'unknown'>('unknown')
  const [inventoryCount, setInventoryCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missingInventoryIds, setMissingInventoryIds] = useState<string[]>([])
  const [orphanSpecialistIds, setOrphanSpecialistIds] = useState<string[]>([])
  const [missingProfileCount, setMissingProfileCount] = useState<number | null>(null)
  const [hybridCount, setHybridCount] = useState<number | null>(null)
  const [decimalRatingCount, setDecimalRatingCount] = useState<number | null>(null)
  const [specialistFetch, setSpecialistFetch] = useState<SpecialistFetchStatus | null>(null)
  const [retailerFetch, setRetailerFetch] = useState<RetailerFetchStatus | null>(null)
  const [retailerDiagnostics, setRetailerDiagnostics] = useState<RetailerDiagnostics | null>(null)
  const [retailerEntityFetch, setRetailerEntityFetch] = useState<RetailerEntityFetchStatus | null>(null)
  const [activeRetailerCount, setActiveRetailerCount] = useState<number | null>(null)
  const [inactiveRetailerCount, setInactiveRetailerCount] = useState<number | null>(null)
  const [retailersWithoutListings, setRetailersWithoutListings] = useState<string[]>([])
  const [duplicateRetailerNames, setDuplicateRetailerNames] = useState<string[]>([])
  const [mergedPoolCount, setMergedPoolCount] = useState<number | null>(null)
  const [colorDiagnostics, setColorDiagnostics] = useState<ColorDiagnosticsSummary | null>(null)
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
      // (services/catalogService.ts + services/inventoryService.ts +
      // services/specialistProfileService.ts + services/retailerPriceService.ts),
      // so this page reports reality rather than a separate, possibly-diverging check.
      const [catalogResult, inventory, specialistResult, retailerResult, retailerEntityResult] = await Promise.all([
        fetchCatalogFromSupabase(),
        fetchInventoryFromSupabase(),
        fetchSpecialistProfilesFromSupabase(),
        fetchRetailerPricesFromSupabase(),
        fetchRetailersFromSupabase(),
      ])
      if (cancelled) return

      const resolvedInventory = inventory ?? getLocalFallbackInventory()
      setMergedPoolCount(catalogResult.items.length)
      setMissingInventoryIds(findMissingInventoryIds(catalogResult.items, resolvedInventory))
      setColorDiagnostics(summarizeColorDiagnostics(mergeInventoryIntoCatalog(catalogResult.items, resolvedInventory)))
      const catalogIds = new Set(catalogResult.items.map((i) => i.id))
      setOrphanSpecialistIds(Object.keys(specialistResult.profiles).filter((id) => !catalogIds.has(id)))
      setMissingProfileCount(catalogResult.items.filter((i) => !specialistResult.profiles[i.id]).length)
      setSpecialistFetch(specialistResult.status)
      setHybridCount(catalogResult.items.filter((i) => i.isHybrid).length)
      const ratingFields = catalogResult.items.flatMap((i) => [i.repulsion, i.durability, i.control, i.hittingSound, i.shockAbsorption ?? null])
      setDecimalRatingCount(ratingFields.filter((v) => v != null && !Number.isInteger(v)).length)
      setRetailerFetch(retailerResult.status)
      setRetailerDiagnostics(summarizeRetailerDiagnostics(retailerResult.listingsByStringId, catalogResult.items.map((i) => i.id)))

      setRetailerEntityFetch(retailerEntityResult.status)
      const retailers = Object.values(retailerEntityResult.retailersById)
      setActiveRetailerCount(retailers.filter((r) => r.active).length)
      setInactiveRetailerCount(retailers.filter((r) => !r.active).length)
      setDuplicateRetailerNames(findDuplicateRetailerNameCandidates(retailerEntityResult.retailersById))

      // Every listing's retailer_id, regardless of validity or the
      // retailer's active status — deliberately a raw query rather than
      // retailerPriceService's public fetch, which filters both out
      // (needed here so "retailers with zero listings" isn't skewed by
      // that filtering).
      if (retailerEntityResult.status.source === 'live') {
        const { data: allListingRetailerIds } = await getSupabaseClient().from('retailer_prices').select('retailer_id')
        if (!cancelled && allListingRetailerIds) {
          const usedRetailerIds = new Set(allListingRetailerIds.map((r) => r.retailer_id))
          setRetailersWithoutListings(retailers.filter((r) => !usedRetailerIds.has(r.id)).map((r) => r.name))
        }
      }

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
        </dl>

        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mt-8 mb-1">Phase 6 — decimal ratings, hybrids &amp; specialist profiles</p>
        <dl className="space-y-4 text-sm">
          <Row label="Decimal validation status" value={decimalValidationLabel(lastCatalogFetch, decimalRatingCount)} />
          <Row label="Hybrid strings in catalog" value={hybridCount == null ? '—' : String(hybridCount)} />
          <Row label="Specialist profile source" value={specialistFetch ? (specialistFetch.source === 'live' ? '🟢 Live (public.specialist_profiles)' : '🟡 Local fallback (stringSpecialistProfiles.ts)') : 'Not fetched yet'} />
          <Row
            label="Last specialist fetch"
            value={
              specialistFetch
                ? `${new Date(specialistFetch.at).toLocaleTimeString()} — ${specialistFetch.acceptedCount} accepted, ${specialistFetch.rejectedCount} rejected${specialistFetch.fallbackReason ? ` (fell back: ${specialistFetch.fallbackReason})` : ''}`
                : 'No fetch recorded yet'
            }
          />
          {specialistFetch && specialistFetch.rejectedReasons.length > 0 && <Row label="Rejected specialist row reasons" value={specialistFetch.rejectedReasons.join('; ')} />}
          <Row label="Strings with no specialist profile" value={missingProfileCount == null ? '—' : `${missingProfileCount} (expected — profiles are sparse by design)`} />
          <Row label="Specialist profiles referencing missing strings (orphaned)" value={orphanSpecialistIds.length === 0 ? 'None' : orphanSpecialistIds.join(', ')} />
        </dl>

        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mt-8 mb-1">Phase 9 — string colors</p>
        <dl className="space-y-4 text-sm">
          <Row label="Strings with an inventory color" value={colorDiagnostics == null ? '—' : String(colorDiagnostics.withInventoryColor)} />
          <Row label="Strings with catalog colors" value={colorDiagnostics == null ? '—' : String(colorDiagnostics.withCatalogColors)} />
          <Row label="Strings with no color data at all" value={colorDiagnostics == null ? '—' : String(colorDiagnostics.withNeither)} />
          <Row
            label="Inventory colors hidden (string out of stock)"
            value={colorDiagnostics == null ? '—' : String(colorDiagnostics.hiddenDueToUnavailableInventory)}
          />
          <Row label="Total unique mapped colors in use" value={colorDiagnostics == null ? '—' : String(colorDiagnostics.totalUniqueMappedColors)} />
          <Row
            label="Unrecognized color values (admin diagnostic only)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.unknownColorValues.length === 0 ? 'None' : colorDiagnostics.unknownColorValues.join(', ')}
          />
          <Row
            label="Same-string case-insensitive duplicate colors"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.duplicateCaseInsensitiveColors.length === 0 ? 'None' : colorDiagnostics.duplicateCaseInsensitiveColors.join('; ')}
          />
          <Row
            label="Hybrid strings missing a main/cross color"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.hybridMissingColors.length === 0 ? 'None' : colorDiagnostics.hybridMissingColors.join(', ')}
          />
          <Row
            label="Strings with multiple available inventory colors"
            value={colorDiagnostics == null ? '—' : String(colorDiagnostics.stringsWithMultipleAvailableInventoryColors)}
          />
          <Row
            label="Hybrids using structured main/cross colors"
            value={colorDiagnostics == null ? '—' : String(colorDiagnostics.hybridsUsingStructuredColors)}
          />
          <Row
            label="Hybrids using a legacy combined-value fallback"
            value={colorDiagnostics == null ? '—' : String(colorDiagnostics.hybridsUsingLegacyFallback)}
          />
          <Row
            label="Inventory values with a comma/semicolon (multiple colors in one field)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.inventoryValuesWithDelimiters.length === 0 ? 'None' : colorDiagnostics.inventoryValuesWithDelimiters.join('; ')}
          />
          <Row
            label="Ambiguous slash-separated values (need a human to interpret)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.ambiguousSlashValues.length === 0 ? 'None' : colorDiagnostics.ambiguousSlashValues.join('; ')}
          />
          <Row
            label="Legacy/misspelled color aliases in use"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.canonicalizedAliasesUsed.length === 0 ? 'None' : colorDiagnostics.canonicalizedAliasesUsed.join('; ')}
          />
          <Row
            label="Resolution source counts (explicit css / override / named color / inferred / alias / unresolved)"
            value={
              colorDiagnostics == null
                ? '—'
                : `${colorDiagnostics.resolutionSourceCounts.explicit_css} / ${colorDiagnostics.resolutionSourceCounts.explicit_override} / ${colorDiagnostics.resolutionSourceCounts.css_named_color} / ${colorDiagnostics.resolutionSourceCounts.inferred_keyword} / ${colorDiagnostics.resolutionSourceCounts.alias} / ${colorDiagnostics.resolutionSourceCounts.unresolved}`
            }
          />
          <Row
            label="Automatically inferred color names (raw → base color)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.inferredColorNames.length === 0 ? 'None' : colorDiagnostics.inferredColorNames.join('; ')}
          />
          <Row
            label="Explicit hybrid color overrides in use"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.explicitOverridesUsed.length === 0 ? 'None' : colorDiagnostics.explicitOverridesUsed.join('; ')}
          />
          <Row
            label="Invalid hybrid color override values (rejected)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.invalidOverrideValues.length === 0 ? 'None' : colorDiagnostics.invalidOverrideValues.join('; ')}
          />
          <Row
            label="Hybrid strings with only one side known (partial pair)"
            value={colorDiagnostics == null ? '—' : colorDiagnostics.partialHybridPairs.length === 0 ? 'None' : colorDiagnostics.partialHybridPairs.join(', ')}
          />
          <Row
            label="Strings with color data that couldn't be resolved (omitted publicly)"
            value={colorDiagnostics == null ? '—' : String(colorDiagnostics.omittedDueToUnresolvedColor)}
          />
        </dl>

        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mt-8 mb-1">Phase 7 — retailers</p>
        <dl className="space-y-4 text-sm">
          <Row
            label="Retailer entity source"
            value={retailerEntityFetch ? (retailerEntityFetch.source === 'live' ? '🟢 Live (public.retailers)' : '🔴 Unavailable') : 'Not fetched yet'}
          />
          {retailerEntityFetch && retailerEntityFetch.rejectedReasons.length > 0 && <Row label="Invalid retailer entity rows" value={retailerEntityFetch.rejectedReasons.join('; ')} />}
          <Row
            label="Retailer count"
            value={retailerEntityFetch ? `${retailerEntityFetch.acceptedCount} valid, ${retailerEntityFetch.rejectedCount} invalid` : '—'}
          />
          <Row label="Active retailers" value={activeRetailerCount == null ? '—' : String(activeRetailerCount)} />
          <Row label="Inactive retailers" value={inactiveRetailerCount == null ? '—' : String(inactiveRetailerCount)} />
          <Row label="Retailers without any listing" value={retailersWithoutListings.length === 0 ? 'None' : retailersWithoutListings.join(', ')} />
          <Row label="Duplicate retailer names" value={duplicateRetailerNames.length === 0 ? 'None' : duplicateRetailerNames.join('; ')} />
          <Row
            label="Invalid retailer website/logo URLs"
            value={
              retailerEntityFetch
                ? retailerEntityFetch.rejectedReasons.filter((r) => r.includes('website_url') || r.includes('logo_url')).join('; ') || 'None'
                : '—'
            }
          />
        </dl>

        <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600 mt-8 mb-1">Phase 7 — retailer listings &amp; purchase options</p>
        <dl className="space-y-4 text-sm">
          <Row label="Retailer source" value={retailerFetch ? (retailerFetch.source === 'live' ? '🟢 Live (public.retailer_prices)' : '🔴 Unavailable — no purchase options shown') : 'Not fetched yet'} />
          <Row
            label="Last retailer fetch"
            value={
              retailerFetch
                ? `${new Date(retailerFetch.at).toLocaleTimeString()} — ${retailerFetch.acceptedCount} accepted, ${retailerFetch.rejectedCount} rejected${retailerFetch.fallbackReason ? ` (failed: ${retailerFetch.fallbackReason})` : ''}`
                : 'No fetch recorded yet'
            }
          />
          {retailerFetch && retailerFetch.rejectedReasons.length > 0 && <Row label="Invalid retailer listing rows" value={retailerFetch.rejectedReasons.join('; ')} />}
          <Row
            label="Listings with missing retailer relations"
            value={retailerFetch ? retailerFetch.rejectedReasons.filter((r) => r.includes('missing retailer relation')).join('; ') || 'None' : '—'}
          />
          <Row label="Listings hidden because retailer is inactive" value={retailerFetch ? String(retailerFetch.hiddenInactiveCount) : '—'} />
          <Row label="Visible retailer listing count" value={retailerDiagnostics == null ? '—' : String(retailerDiagnostics.totalListings)} />
          <Row label="Strings with retailer listings" value={retailerDiagnostics == null ? '—' : String(retailerDiagnostics.stringsWithListingsCount)} />
          <Row
            label="Strings without any retailer listing"
            value={retailerDiagnostics == null ? '—' : `${retailerDiagnostics.stringsWithoutListingIds.length} (expected — listings are sparse by design)`}
          />
          <Row label="Out-of-stock listings" value={retailerDiagnostics == null ? '—' : String(retailerDiagnostics.outOfStockCount)} />
          <Row label="Discontinued listings" value={retailerDiagnostics == null ? '—' : String(retailerDiagnostics.discontinuedCount)} />
          <Row label="Listings missing last-checked date" value={retailerDiagnostics == null ? '—' : String(retailerDiagnostics.missingLastCheckedCount)} />
          <Row
            label="Preferred-listing conflicts"
            value={retailerDiagnostics == null ? '—' : retailerDiagnostics.preferredConflictStringIds.length === 0 ? 'None' : retailerDiagnostics.preferredConflictStringIds.join(', ')}
          />
          <Row
            label="Duplicate retailer candidates"
            value={retailerDiagnostics == null ? '—' : retailerDiagnostics.duplicateCandidates.length === 0 ? 'None' : retailerDiagnostics.duplicateCandidates.join('; ')}
          />
          <Row label="Currency counts" value={retailerDiagnostics == null ? '—' : formatCounts(retailerDiagnostics.currencyCounts)} />
          <Row label="Package-type counts" value={retailerDiagnostics == null ? '—' : formatCounts(retailerDiagnostics.packageTypeCounts)} />
        </dl>
      </div>
    </div>
  )
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
  return entries.length === 0 ? 'None' : entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}

function decimalValidationLabel(lastCatalogFetch: CatalogFetchStatus | null, decimalRatingCount: number | null): string {
  if (!lastCatalogFetch) return 'Not fetched yet'
  const decimalRejections = lastCatalogFetch.rejectedReasons.filter((r) => r.includes('decimal place'))
  const decimalNote = decimalRatingCount == null ? '' : ` — ${decimalRatingCount} accepted rating value(s) use a decimal (e.g. 9.5)`
  return decimalRejections.length === 0
    ? `✓ OK — every accepted row's ratings are within 0–11 at one decimal place${decimalNote}`
    : `✗ ${decimalRejections.length} row(s) rejected for decimal precision: ${decimalRejections.join('; ')}`
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
