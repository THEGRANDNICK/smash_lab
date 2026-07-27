import { useAdminAuth } from '../../hooks/useAdminAuth'
import AdminLogin from './AdminLogin'
import InventoryAdminPage from './InventoryAdminPage'

interface AdminAppProps {
  onExit: () => void
}

export default function AdminApp({ onExit }: AdminAppProps) {
  const { status, session, error, signIn, signOut } = useAdminAuth()

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
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b-2 border-court-900/10 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">Smash Lab Admin</p>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">Inventory</h1>
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

      <InventoryAdminPage />
    </div>
  )
}
