import { useEffect, useState } from 'react'
import Nav from './components/Nav'
import OfflineBanner from './components/OfflineBanner'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import StringComparison from './components/StringComparison'
import WhyUs from './components/WhyUs'
import RestringAndCraft from './components/RestringAndCraft'
import FAQ from './components/FAQ'
import Contact from './components/Contact'
import Footer from './components/Footer'
import StringFinder from './components/StringFinder'
import SavedSetupBanner from './components/SavedSetupBanner'
import RecommendationResult from './components/RecommendationResult'
import DevSupabaseDebugPage from './components/SupabaseDebugPage'
import AdminApp from './components/admin/AdminApp'
import Impressum from './components/legal/Impressum'
import Datenschutz from './components/legal/Datenschutz'
import { useStringPool } from './hooks/useStringPool'
import { useSpecialistProfiles } from './hooks/useSpecialistProfiles'
import { useRetailerPrices } from './hooks/useRetailerPrices'
import { decodeResultShareState } from './logic/resultShareState'

type View = 'home' | 'finder' | 'compare' | 'debug' | 'admin' | 'impressum' | 'datenschutz' | 'result'

/** Reads the encoded payload from a "#result/<encoded>" URL. */
function getSharedResultEncoded(): string {
  const hash = window.location.hash.replace('#', '')
  return hash.startsWith('result/') ? hash.slice('result/'.length) : ''
}

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'finder' || hash === 'compare' || hash === 'impressum' || hash === 'datenschutz') return hash
  if (hash.startsWith('result/')) return 'result'
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
  // Tracked separately from `view`: two different "#result/<encoded>" URLs
  // both map to the same `view` value ('result'), so a setView('result')
  // call when already on 'result' would otherwise be a no-op React bails
  // out of (same primitive value) — the page would silently keep showing
  // the previous shared result. This always changes when the hash does,
  // and is used as a React `key` below to force a fresh render.
  const [sharedResultEncoded, setSharedResultEncoded] = useState<string>(getSharedResultEncoded)
  const liveStrings = useStringPool()
  const specialistProfiles = useSpecialistProfiles()
  const retailerListingsByStringId = useRetailerPrices()

  useEffect(() => {
    const onHashChange = () => {
      setView(viewFromHash())
      setSharedResultEncoded(getSharedResultEncoded())
    }
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

  // Legal pages are deliberately isolated from the main app shell — a
  // simple, always-reachable page even if something else on the site
  // errors, matching how the admin route is isolated above.
  if (view === 'impressum') {
    return <Impressum onHome={() => goTo('home')} />
  }
  if (view === 'datenschutz') {
    return <Datenschutz onHome={() => goTo('home')} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <Nav onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} onHome={() => goTo('home')} />

      <main className="flex-1">
        {view === 'home' && (
          <>
            <SavedSetupBanner />
            <Hero onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} />
            <HowItWorks />
            <StringComparison strings={liveStrings} specialistProfiles={specialistProfiles} retailerListingsByStringId={retailerListingsByStringId} />
            <WhyUs />
            <RestringAndCraft />
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

        {view === 'result' && (
          <div className="px-4 py-10 sm:py-16" key={sharedResultEncoded}>
            {(() => {
              const decoded = decodeResultShareState(sharedResultEncoded)
              if (!decoded) {
                return (
                  <div className="max-w-2xl mx-auto text-center py-16">
                    <p className="text-lg font-semibold text-ink-900 dark:text-shuttle-50">This shared result link couldn't be read.</p>
                    <p className="mt-2 text-ink-700/70 dark:text-shuttle-100/70">It may be incomplete or from an older version of the site. Try taking the quiz again instead.</p>
                    <button
                      type="button"
                      onClick={() => goTo('finder')}
                      className="focus-ring mt-6 rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
                    >
                      Take the quiz
                    </button>
                  </div>
                )
              }
              return (
                <RecommendationResult
                  answers={decoded.answers}
                  dataSource={decoded.dataSource}
                  onRetake={() => goTo('finder')}
                  onCompare={() => goTo('compare')}
                  pool={liveStrings}
                  specialistProfiles={specialistProfiles}
                  retailerListingsByStringId={retailerListingsByStringId}
                />
              )
            })()}
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
