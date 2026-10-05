import { useEffect, useState } from 'react'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { getRuntimeVersionInfo } from '../../logic/version'
import type { AdminSection } from '../../services/adminDashboardService'
import AdminLogin from './AdminLogin'
import DashboardPage from './DashboardPage'
import InventoryAdminPage from './InventoryAdminPage'
import CatalogAdminPage from './CatalogAdminPage'
import SpecialistAdminPage from './SpecialistAdminPage'
import RetailerAdminPage from './RetailerAdminPage'
import RetailerListingAdminPage from './RetailerListingAdminPage'
import FeedbackAdminPage from './FeedbackAdminPage'
import AdminUmpire from './AdminUmpire'
import ImportsAdminPage from './ImportsAdminPage'

interface AdminAppProps {
  onExit: () => void
}

export type { AdminSection }

/** Section <-> hash mapping — kept explicit (not derived from the section id) since the retailerListings section uses a kebab-case hash (#admin/retailer-listings) for readability, unlike its camelCase TS identifier. */
const SECTION_HASH: Record<AdminSection, string> = {
  dashboard: 'admin/dashboard',
  inventory: 'admin/inventory',
  catalog: 'admin/catalog',
  specialists: 'admin/specialists',
  retailers: 'admin/retailers',
  retailerListings: 'admin/retailer-listings',
  imports: 'admin/imports',
  feedback: 'admin/feedback',
}

/** Phase 11: bare `#admin` (and any hash this map doesn't recognize) now lands on the Dashboard by default — previously it fell through to Inventory. Every existing explicit hash (#admin/inventory, #admin/catalog, etc.) is unaffected and still opens exactly that section, so this is additive, not a breaking change to any bookmarked/shared link. */
function sectionFromHash(): AdminSection {
  const hash = window.location.hash.replace('#', '')
  const match = (Object.entries(SECTION_HASH) as [AdminSection, string][]).find(([, h]) => h === hash)
  return match ? match[0] : 'dashboard'
}

const SECTION_LABEL: Record<AdminSection, string> = {
  dashboard: 'Overview',
  inventory: 'Stock',
  catalog: 'Strings',
  specialists: 'Ratings',
  retailers: 'Retailers',
  retailerListings: 'Retailer Listings',
  imports: 'Imports',
  feedback: 'Feedback',
}

export default function AdminApp({ onExit }: AdminAppProps) {
  const { status, session, error, signIn, signOut } = useAdminAuth()
  const [section, setSection] = useState<AdminSection>(sectionFromHash)
  const versionInfo = getRuntimeVersionInfo()

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function goToSection(next: AdminSection) {
    window.location.hash = SECTION_HASH[next]
    setSection(next)
  }

  if (status === 'checking') {
    return <p className="text-center text-ink-700/70 dark:text-shuttle-100/60 py-20">Checking session…</p>
  }

  if (status === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-20 px-4">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Admin area unavailable</p>
        <p className="text-sm text-ink-700/70 dark:text-shuttle-100/60">{error}</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <AdminLogin onSignIn={signIn} />
  }

  if (status === 'authenticated-non-admin') {
    return (
      <div className="max-w-lg mx-auto text-center py-20 px-4">
        <p className="font-display text-xl font-bold text-ink-900 dark:text-shuttle-50 mb-2">Access denied</p>
        <p className="text-sm text-ink-700/70 dark:text-shuttle-100/60 mb-6">
          {session?.user.email ?? 'This account'} is signed in but isn't an admin on this project.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-2.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>
    )
  }

  // authenticated-admin
  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <AdminUmpire className="h-14 sm:h-20 w-auto shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400">Smash Lab Admin</p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-ink-900 dark:text-shuttle-50 truncate">{SECTION_LABEL[section]}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold shrink-0">
          <button
            type="button"
            onClick={onExit}
            className="focus-ring text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
          >
            ← Site
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>

      {/* One swipeable row that stays at the top — easy with a thumb. Price sections (retailers) are
          no longer in the menu; their old links still work. */}
      <nav
        className="sticky top-0 z-30 -mx-3 sm:mx-0 mb-5 sm:mb-8 px-3 sm:px-0 py-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-[#efe6d3]/95 dark:bg-[#1e201f]/95 border-y border-court-900/10 dark:border-white/10"
        aria-label="Admin sections"
      >
        {(['dashboard', 'catalog', 'inventory', 'specialists', 'feedback', 'imports'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => goToSection(s)}
            aria-current={section === s ? 'page' : undefined}
            className={`focus-ring shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              section === s ? 'bg-shuttle-500 text-court-900' : 'border-2 border-court-900/15 dark:border-white/20 hover:bg-court-900/5 dark:hover:bg-white/10'
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
      </nav>

      {section === 'dashboard' && <DashboardPage onNavigate={goToSection} />}
      {section === 'inventory' && <InventoryAdminPage />}
      {section === 'catalog' && <CatalogAdminPage />}
      {section === 'specialists' && <SpecialistAdminPage />}
      {section === 'retailers' && <RetailerAdminPage />}
      {section === 'retailerListings' && <RetailerListingAdminPage />}
      {section === 'imports' && <ImportsAdminPage />}
      {section === 'feedback' && <FeedbackAdminPage />}

      <footer className="mt-12 pt-4 border-t border-court-900/10 dark:border-white/10 text-center text-xs text-ink-700/70 dark:text-shuttle-100/60">
        Smash Lab Admin · {versionInfo.display} · {versionInfo.environment}
      </footer>
    </main>
  )
}
