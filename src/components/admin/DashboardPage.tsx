import { useCallback, useEffect, useState } from 'react'
import {
  fetchDashboardData,
  STALE_LISTING_DAYS,
  type AdminSection,
  type DashboardData,
  type DashboardSourceError,
  type DashboardSourceId,
  type IssueSeverity,
  type InventoryAttentionItem,
  type RecentUpdateItem,
  type DataQualityIssue,
} from '../../services/adminDashboardService'
import { formatRelativeTime } from '../../logic/relativeTime'
import StockBadge from '../StockBadge'

interface DashboardPageProps {
  onNavigate: (section: AdminSection) => void
}

type LoadState = 'loading' | 'ready' | 'full-error'

const SOURCE_LABEL: Record<DashboardSourceId, string> = {
  catalog: 'Catalog',
  inventory: 'Inventory',
  specialists: 'Specialists',
  retailers: 'Retailers',
  retailerListings: 'Retailer listings',
}

const SEVERITY_LABEL: Record<IssueSeverity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }
const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  info: 'bg-court-900/5 text-ink-700/70 dark:bg-white/10 dark:text-shuttle-100/70',
}

/**
 * Phase 11 — read-only operational overview. Every number here comes from
 * a single fetchDashboardData() cycle (five existing admin services
 * fetched in parallel, reshaped client-side) — this component owns no
 * Supabase query of its own and never mutates anything; "Refresh" just
 * re-runs that same read. A source that fails to load doesn't blank the
 * whole page: the affected summary card/section shows "Unavailable" while
 * everything else still renders from what did load (see `failedSources`).
 */
export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [errors, setErrors] = useState<DashboardSourceError[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    else setLoadState('loading')
    const result = await fetchDashboardData()
    setData(result.data)
    setErrors(result.errors)
    setLastRefreshedAt(result.fetchedAt)
    setLoadState(result.errors.length >= 5 ? 'full-error' : 'ready')
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  if (loadState === 'loading' && !data) {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-12">Loading dashboard…</p>
  }

  if (loadState === 'full-error' || !data) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Couldn't load the dashboard.</p>
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60 mb-4">Every data source failed to load. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => void load(false)}
          className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  const failedSources = new Set(errors.map((e) => e.source))
  const degraded = errors.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">Operational overview</h2>
        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
              Last refreshed <time dateTime={lastRefreshedAt}>{formatRelativeTime(lastRefreshedAt)}</time>
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-busy={refreshing}
            className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {degraded && (
        <div role="alert" className="rounded-xl border-2 border-amber-300/50 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Some data couldn't be loaded</p>
          <ul className="list-disc list-inside text-amber-700/90 dark:text-amber-300/80 space-y-0.5">
            {errors.map((e) => (
              <li key={e.source}>
                {SOURCE_LABEL[e.source]}: {e.message}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="focus-ring mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      )}

      <section aria-label="Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard title="Catalog" unavailable={failedSources.has('catalog')} onNavigate={() => onNavigate('catalog')} linkLabel="View catalog">
            <p className="text-3xl font-bold text-ink-900 dark:text-shuttle-50">{data.summary.catalog.total}</p>
            <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">strings</p>
          </SummaryCard>

          <SummaryCard title="Inventory" unavailable={failedSources.has('inventory')} onNavigate={() => onNavigate('inventory')} linkLabel="View inventory">
            <ul className="text-sm space-y-0.5">
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.inventory.inStock}</span> in stock
              </li>
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.inventory.lowStock}</span> low stock
              </li>
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.inventory.unavailable}</span> unavailable
              </li>
            </ul>
          </SummaryCard>

          <SummaryCard title="Specialists" unavailable={failedSources.has('specialists')} onNavigate={() => onNavigate('specialists')} linkLabel="View specialists">
            <p className="text-2xl font-bold text-ink-900 dark:text-shuttle-50">
              {data.summary.specialists.withProfile} <span className="text-base font-normal text-ink-700/50 dark:text-shuttle-100/50">of {data.summary.specialists.totalCatalogStrings}</span>
            </p>
            <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">{data.summary.specialists.coveragePercent}% coverage</p>
          </SummaryCard>

          <SummaryCard title="Retailers" unavailable={failedSources.has('retailers')} onNavigate={() => onNavigate('retailers')} linkLabel="View retailers">
            <ul className="text-sm space-y-0.5">
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.retailers.active}</span> active
              </li>
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.retailers.inactive}</span> inactive
              </li>
            </ul>
          </SummaryCard>

          <SummaryCard
            title="Retailer listings"
            unavailable={failedSources.has('retailerListings')}
            onNavigate={() => onNavigate('retailerListings')}
            linkLabel="View retailer listings"
          >
            <ul className="text-sm space-y-0.5">
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.retailerListings.total}</span> total
              </li>
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.retailerListings.missingPrice}</span> missing price
              </li>
              <li>
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">{data.summary.retailerListings.stale}</span> stale
              </li>
            </ul>
          </SummaryCard>
        </div>
      </section>

      <DataQualitySection issues={data.dataQuality} degraded={degraded} onNavigate={onNavigate} />

      <InventoryAttentionSection attention={data.inventoryAttention} unavailable={failedSources.has('inventory')} onNavigate={onNavigate} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CoverageSection coverage={data.coverage} unavailable={failedSources.has('catalog') || failedSources.has('specialists')} onNavigate={onNavigate} />
        <RetailerHealthSection health={data.retailerHealth} unavailable={failedSources.has('retailers') || failedSources.has('retailerListings')} onNavigate={onNavigate} />
      </div>

      <RecentUpdatesSection updates={data.recentUpdates} degraded={degraded} onNavigate={onNavigate} />

      <QuickActionsSection onNavigate={onNavigate} />
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display text-base font-bold text-ink-900 dark:text-shuttle-50">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SummaryCard({
  title,
  unavailable,
  onNavigate,
  linkLabel,
  children,
}: {
  title: string
  unavailable: boolean
  onNavigate: () => void
  linkLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-4 flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{title}</h4>
      <div className="flex-1">
        {unavailable ? <p className="text-sm text-ink-700/50 dark:text-shuttle-100/50">Unavailable right now</p> : children}
      </div>
      <button type="button" onClick={onNavigate} className="focus-ring self-start text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer">
        {linkLabel} →
      </button>
    </div>
  )
}

function DataQualitySection({ issues, degraded, onNavigate }: { issues: DataQualityIssue[]; degraded: boolean; onNavigate: (s: AdminSection) => void }) {
  return (
    <Panel title="Needs attention">
      {degraded && <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mb-3">Some issues may be missing because a data source failed to load — see the notice above.</p>}
      {issues.length === 0 ? (
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">No data-quality issues detected right now.</p>
      ) : (
        <ul className="divide-y divide-court-900/10 dark:divide-white/10">
          {issues.map((issue) => (
            <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[issue.severity]}`}>{SEVERITY_LABEL[issue.severity]}</span>
                <span className="text-sm text-ink-900 dark:text-shuttle-50 truncate">{issue.label}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold tabular-nums text-ink-900 dark:text-shuttle-50">{issue.count}</span>
                <button
                  type="button"
                  onClick={() => onNavigate(issue.section)}
                  className="focus-ring text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
                >
                  Review
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const PRIORITY_LABEL: Record<InventoryAttentionItem['priority'], string> = {
  unavailable: 'Unavailable',
  'low-stock': 'Low stock',
  'data-issue': 'Data issue',
}

function InventoryAttentionSection({
  attention,
  unavailable,
  onNavigate,
}: {
  attention: DashboardData['inventoryAttention']
  unavailable: boolean
  onNavigate: (s: AdminSection) => void
}) {
  return (
    <Panel
      title="Inventory status"
      action={
        <button type="button" onClick={() => onNavigate('inventory')} className="focus-ring text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer">
          View all inventory
        </button>
      }
    >
      {unavailable ? (
        <p className="text-sm text-ink-700/50 dark:text-shuttle-100/50">Unavailable right now.</p>
      ) : attention.items.length === 0 ? (
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">Nothing needs attention — every inventory row is in stock with complete data.</p>
      ) : (
        <>
          <ul className="divide-y divide-court-900/10 dark:divide-white/10">
            {attention.items.map((item) => (
              <li key={item.stringId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-shuttle-50 truncate">
                    {item.brand} {item.name}
                  </p>
                  <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
                    {item.priority === 'data-issue' ? `${PRIORITY_LABEL[item.priority]} — ` : ''}
                    qty {item.quantity ?? '—'} · {item.packageType} · updated {formatRelativeTime(item.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StockBadge stock={item.status} />
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="focus-ring text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {attention.totalNeedingAttention > attention.items.length && (
            <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-3">
              Showing {attention.items.length} of {attention.totalNeedingAttention} entries needing attention.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}

function ProgressRow({ label, present, total, percent, onNavigate }: { label: string; present: number; total: number; percent: number; onNavigate: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-sm text-ink-900 dark:text-shuttle-50">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-ink-900 dark:text-shuttle-50">
          {present} of {total} ({percent}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${present} of ${total}, ${percent}%`}
        className="h-2 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden"
      >
        <div className="h-full rounded-full bg-shuttle-500" style={{ width: `${percent}%` }} />
      </div>
      <button type="button" onClick={onNavigate} className="focus-ring mt-1 text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer">
        {total - present} still need one →
      </button>
    </div>
  )
}

function CountRow({ label, count, onNavigate }: { label: string; count: number; onNavigate: () => void }) {
  if (count === 0) return null
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-900 dark:text-shuttle-50">{label}</span>
      <span className="flex items-center gap-3">
        <span className="text-sm font-semibold tabular-nums text-ink-900 dark:text-shuttle-50">{count}</span>
        <button type="button" onClick={onNavigate} className="focus-ring text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer">
          Review
        </button>
      </span>
    </li>
  )
}

function CoverageSection({ coverage, unavailable, onNavigate }: { coverage: DashboardData['coverage']; unavailable: boolean; onNavigate: (s: AdminSection) => void }) {
  return (
    <Panel title="Catalog &amp; specialist coverage">
      {unavailable ? (
        <p className="text-sm text-ink-700/50 dark:text-shuttle-100/50">Unavailable right now.</p>
      ) : (
        <div className="space-y-4">
          <ProgressRow
            label="Specialist coverage"
            present={coverage.specialistProfiles.present}
            total={coverage.specialistProfiles.total}
            percent={coverage.specialistProfiles.percent}
            onNavigate={() => onNavigate('specialists')}
          />
          <ul className="divide-y divide-court-900/10 dark:divide-white/10">
            <CountRow label="Strings missing a description" count={coverage.missingDescription} onNavigate={() => onNavigate('catalog')} />
            <CountRow label="Strings missing a product URL" count={coverage.missingProductUrl} onNavigate={() => onNavigate('catalog')} />
            <CountRow label="Strings missing an image URL" count={coverage.missingImageUrl} onNavigate={() => onNavigate('catalog')} />
            <CountRow label="Strings missing a shock absorption rating" count={coverage.missingShockAbsorption} onNavigate={() => onNavigate('catalog')} />
            <CountRow label="Hybrid strings missing structured metadata" count={coverage.hybridMissingStructuredMeta} onNavigate={() => onNavigate('catalog')} />
          </ul>
          {coverage.missingDescription === 0 &&
            coverage.missingProductUrl === 0 &&
            coverage.missingImageUrl === 0 &&
            coverage.missingShockAbsorption === 0 &&
            coverage.hybridMissingStructuredMeta === 0 && <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">Catalog metadata is fully complete.</p>}
        </div>
      )}
    </Panel>
  )
}

function RetailerHealthSection({ health, unavailable, onNavigate }: { health: DashboardData['retailerHealth']; unavailable: boolean; onNavigate: (s: AdminSection) => void }) {
  return (
    <Panel title="Retailer &amp; listing health">
      {unavailable ? (
        <p className="text-sm text-ink-700/50 dark:text-shuttle-100/50">Unavailable right now.</p>
      ) : (
        <div className="space-y-3">
          <ul className="text-sm space-y-1">
            <li>
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">{health.activeRetailers}</span> active /{' '}
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">{health.inactiveRetailers}</span> inactive retailers
            </li>
            <li>
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">{health.totalListings}</span> total listings ·{' '}
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">{health.preferredListings}</span> preferred ·{' '}
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">{health.availableListings}</span> in stock
            </li>
          </ul>
          <ul className="divide-y divide-court-900/10 dark:divide-white/10">
            <CountRow label="Listings missing a price" count={health.missingPrice} onNavigate={() => onNavigate('retailerListings')} />
            <CountRow label="Listings missing a product URL" count={health.missingProductUrl} onNavigate={() => onNavigate('retailerListings')} />
            <CountRow label="Listings never checked" count={health.neverChecked} onNavigate={() => onNavigate('retailerListings')} />
            <CountRow label={`Listings not checked in over ${STALE_LISTING_DAYS} days`} count={health.stale} onNavigate={() => onNavigate('retailerListings')} />
            <CountRow label="Strings with more than one preferred listing" count={health.preferredConflictStringIds.length} onNavigate={() => onNavigate('retailerListings')} />
          </ul>
          {health.inactiveRetailersWithListings.length > 0 && (
            <div>
              <p className="text-sm text-ink-900 dark:text-shuttle-50 mb-1">Inactive retailers with existing listings</p>
              <ul className="text-xs text-ink-700/60 dark:text-shuttle-100/60 space-y-0.5">
                {health.inactiveRetailersWithListings.map((r) => (
                  <li key={r.retailerId}>
                    {r.retailerName} — {r.listingCount} listing{r.listingCount === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onNavigate('retailers')}
                className="focus-ring mt-1 text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
              >
                Review retailers
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

function RecentUpdatesSection({ updates, degraded, onNavigate }: { updates: RecentUpdateItem[]; degraded: boolean; onNavigate: (s: AdminSection) => void }) {
  return (
    <Panel title="Recent data updates">
      {degraded && <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mb-3">This list may be incomplete because a data source failed to load — see the notice above.</p>}
      {updates.length === 0 ? (
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">No recent updates yet.</p>
      ) : (
        <ul className="divide-y divide-court-900/10 dark:divide-white/10">
          {updates.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{item.sourceLabel}</p>
                <p className="text-sm text-ink-900 dark:text-shuttle-50 truncate">
                  {item.title} updated{item.secondary ? ` (${item.secondary})` : ''}
                </p>
                <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
                  <time dateTime={item.updatedAt}>{formatRelativeTime(item.updatedAt)}</time>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(item.section)}
                className="focus-ring shrink-0 text-xs font-semibold text-shuttle-600 dark:text-shuttle-400 hover:underline cursor-pointer"
              >
                Open →
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const QUICK_ACTIONS: { label: string; section: AdminSection; hint: string }[] = [
  { label: '+ Add catalog string', section: 'catalog', hint: 'Opens Catalog, where you can add a new string' },
  { label: '+ Add inventory entry', section: 'inventory', hint: 'Opens Inventory' },
  { label: '+ Add specialist profile', section: 'specialists', hint: 'Opens Specialists, where you can add a profile' },
  { label: '+ Add retailer', section: 'retailers', hint: 'Opens Retailers, where you can add a new retailer' },
  { label: '+ Add retailer listing', section: 'retailerListings', hint: 'Opens Retailer Listings, where you can add a new listing' },
]

function QuickActionsSection({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  return (
    <Panel title="Quick actions">
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.section}
            type="button"
            onClick={() => onNavigate(action.section)}
            title={action.hint}
            className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        ))}
      </div>
    </Panel>
  )
}
