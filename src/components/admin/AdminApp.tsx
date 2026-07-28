import { useEffect, useState } from 'react'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import AdminLogin from './AdminLogin'
import InventoryAdminPage from './InventoryAdminPage'
import CatalogAdminPage from './CatalogAdminPage'
import SpecialistAdminPage from './SpecialistAdminPage'

interface AdminAppProps {
  onExit: () => void
}

type AdminSection = 'inventory' | 'catalog' | 'specialists'

function sectionFromHash(): AdminSection {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'admin/catalog') return 'catalog'
  if (hash === 'admin/specialists') return 'specialists'
  return 'inventory'
}

const SECTION_LABEL: Record<AdminSection, string> = {
  inventory: 'Inventory',
  catalog: 'Catalog',
  specialists: 'Specialists',
}

export default function AdminApp({ onExit }: AdminAppProps) {
  const { status, session, error, signIn, signOut } = useAdminAuth()
  const [section, setSection] = useState<AdminSection>(sectionFromHash)

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function goToSection(next: AdminSection) {
    window.location.hash = `admin/${next}`
    setSection(next)
  }

  if (status === 'checking') {
    return <p className="text-center text-ink-700/60 dark:text-shuttle-100/60 py-20">Checking session…</p>
  }

  if (status === 'error') {
    return (
      <div className="max-w-lg mx-auto text-center py-20 px-4">
        <p className="font-semibold text-red-600 dark:text-red-400 mb-2">Admin area unavailable</p>
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60">{error}</p>
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
        <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60 mb-6">
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
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-court-900/10 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">Smash Lab Admin</p>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">{SECTION_LABEL[section]}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <button
            type="button"
            onClick={onExit}
            className="focus-ring text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
          >
            ← Return to public site
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

      <nav className="flex items-center gap-2 mb-8 flex-wrap" aria-label="Admin sections">
        {(['inventory', 'catalog', 'specialists'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => goToSection(s)}
            aria-current={section === s ? 'page' : undefined}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
              section === s ? 'bg-shuttle-500 text-court-900' : 'border-2 border-court-900/15 dark:border-white/20 hover:bg-court-900/5 dark:hover:bg-white/10'
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
        <span
          aria-disabled="true"
          title="Coming in a later phase"
          className="rounded-full px-4 py-1.5 text-sm font-semibold border-2 border-court-900/10 dark:border-white/10 text-ink-700/30 dark:text-shuttle-100/30 cursor-not-allowed select-none"
        >
          Dashboard
        </span>
      </nav>

      {section === 'inventory' && <InventoryAdminPage />}
      {section === 'catalog' && <CatalogAdminPage />}
      {section === 'specialists' && <SpecialistAdminPage />}
    </div>
  )
}
