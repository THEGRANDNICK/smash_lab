import { useEffect, useState } from 'react'
import Nav from './components/Nav'
import OfflineBanner from './components/OfflineBanner'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import StringComparison from './components/StringComparison'
import WhyUs from './components/WhyUs'
import FAQ from './components/FAQ'
import Contact from './components/Contact'
import Footer from './components/Footer'
import StringFinder from './components/StringFinder'
import DevSupabaseDebugPage from './components/SupabaseDebugPage'
import AdminApp from './components/admin/AdminApp'
import { useStringPool } from './hooks/useStringPool'
import { useSpecialistProfiles } from './hooks/useSpecialistProfiles'
import { useRetailerPrices } from './hooks/useRetailerPrices'

type View = 'home' | 'finder' | 'compare' | 'debug' | 'admin'

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'finder' || hash === 'compare') return hash
  // Not linked from the public nav — a direct URL is the entry point.
  // Security is enforced by Supabase Auth + RLS inside AdminApp, not by
  // this route being hard to find.
  if (
    hash === 'admin' ||
    hash === 'admin/dashboard' ||
    hash === 'admin/inventory' ||
    hash === 'admin/catalog' ||
    hash === 'admin/specialists' ||
    hash === 'admin/retailers' ||
    hash === 'admin/retailer-listings'
  )
    return 'admin'
  // Dev-only diagnostic route — import.meta.env.DEV is statically replaced
  // by Vite, so this branch (and the SupabaseDebugPage import) is dead
  // code eliminated from production builds entirely.
  if (import.meta.env.DEV && hash === 'debug-supabase') return 'debug'
  return 'home'
}

function App() {
  const [view, setView] = useState<View>(viewFromHash)
  const liveStrings = useStringPool()
  const specialistProfiles = useSpecialistProfiles()
  const retailerListingsByStringId = useRetailerPrices()

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function goTo(next: View) {
    window.location.hash = next === 'home' ? '' : next
    setView(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  // The admin area is deliberately isolated from the public Nav/Footer —
  // it has its own header (Inventory / Return to public site / Log out)
  // inside AdminApp. Real protection is Supabase Auth + RLS, handled
  // entirely inside AdminApp; this route split is just presentation.
  if (view === 'admin') {
    return <AdminApp onExit={() => goTo('home')} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <Nav onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} onHome={() => goTo('home')} />

      <main className="flex-1">
        {view === 'home' && (
          <>
            <Hero onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} />
            <HowItWorks />
            <StringComparison strings={liveStrings} specialistProfiles={specialistProfiles} retailerListingsByStringId={retailerListingsByStringId} />
            <WhyUs />
            <FAQ />
            <Contact />
          </>
        )}

        {view === 'finder' && (
          <div className="py-10 sm:py-16">
            <StringFinder
              onExit={() => goTo('home')}
              onCompare={() => goTo('compare')}
              pool={liveStrings}
              specialistProfiles={specialistProfiles}
              retailerListingsByStringId={retailerListingsByStringId}
            />
          </div>
        )}

        {view === 'compare' && (
          <div className="pt-6">
            <StringComparison strings={liveStrings} specialistProfiles={specialistProfiles} retailerListingsByStringId={retailerListingsByStringId} />
            <div className="text-center pb-16">
              <button
                type="button"
                onClick={() => goTo('finder')}
                className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
              >
                🏸 Not sure? Take the quiz
              </button>
            </div>
          </div>
        )}

        {view === 'debug' && import.meta.env.DEV && <DevSupabaseDebugPage />}
      </main>

      <Footer />
    </div>
  )
}

export default App
