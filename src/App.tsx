import { useEffect, useState, lazy, Suspense } from 'react'
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
// Lazy-loaded: the admin area (forms, map placer, Supabase auth UI) is never needed by visitors,
// so it stays out of the main bundle and only downloads when #admin is opened.
const AdminApp = lazy(() => import('./components/admin/AdminApp'))
import Impressum from './components/legal/Impressum'
import Datenschutz from './components/legal/Datenschutz'
import { useStringPool } from './hooks/useStringPool'
import { useSpecialistProfiles } from './hooks/useSpecialistProfiles'
import { useRetailerPrices } from './hooks/useRetailerPrices'
import { decodeResultShareState } from './logic/resultShareState'
import StringDetail from './components/StringDetail'
import { strings } from './data/strings'
import { legacyStringIdFromHash, routeFromPath } from './logic/routes'
import { buildStringPageMeta, buildStringsIndexMeta, stringPagePath } from './logic/stringPages'
import { STRING_SPECIALIST_PROFILES } from './data/stringSpecialistProfiles'

const BASE = import.meta.env.BASE_URL

type View = 'home' | 'finder' | 'compare' | 'debug' | 'admin' | 'impressum' | 'datenschutz' | 'result' | 'string' | 'notFound'

/** The string shown on a real string page (…/strings/<id>/), or from an old "#string/<id>" link. */
function getStringIdFromLocation(): string {
  const route = routeFromPath(window.location.pathname, BASE)
  if (route.kind === 'string') return route.id
  return legacyStringIdFromHash(window.location.hash) ?? ''
}

/** Reads the encoded payload from a "#result/<encoded>" URL. */
function getSharedResultEncoded(): string {
  const hash = window.location.hash.replace('#', '')
  return hash.startsWith('result/') ? hash.slice('result/'.length) : ''
}

const BASE_TITLE = 'Smash Lab — The Independent Badminton String Finder'

/**
 * Per-view <title>. Keyed off the raw hash rather than the `View` union,
 * since #faq/#contact are plain in-page anchors (Nav.tsx) that never
 * change `view` itself — they still deserve their own title, so this is
 * checked independently of the view-routing logic above.
 */
function getPageTitle(hash: string): string {
  const clean = hash.replace('#', '')
  const route = routeFromPath(window.location.pathname, BASE)
  if (route.kind === 'notFound') return 'Page not found — Smash Lab'
  // String pages keep exactly the title of their static HTML, so crawlers that run JavaScript see the same one.
  if (route.kind === 'stringsIndex' && !clean) return buildStringsIndexMeta().title
  if (route.kind === 'string' && !clean) {
    const item = strings.find((s) => s.id === route.id)
    return item ? buildStringPageMeta(item, STRING_SPECIALIST_PROFILES[item.id]).title : 'String not found — Smash Lab'
  }
  if (clean === 'finder') return 'Find Your String — Smash Lab'
  if (clean === 'compare') return 'Compare Strings — Smash Lab'
  if (clean === 'faq') return 'FAQ — Smash Lab'
  if (clean === 'contact') return 'Contact — Smash Lab'
  if (clean === 'impressum') return 'Impressum — Smash Lab'
  if (clean === 'datenschutz') return 'Datenschutzerklärung — Smash Lab'
  if (clean.startsWith('admin')) return 'Admin — Smash Lab'
  if (clean.startsWith('result/')) return 'Your Recommendation — Smash Lab'
  if (clean.startsWith('string/')) {
    const item = strings.find((s) => s.id === decodeURIComponent(clean.slice('string/'.length)))
    if (item) return `${item.brand} ${item.name} — Smash Lab`
  }
  return BASE_TITLE
}

/**
 * Old "#string/<id>" links (from before real string pages existed) move to the real page
 * address, so shared links and Google agree on one URL. Returns the id when it redirected.
 */
function redirectLegacyStringLink(): string | undefined {
  const legacyId = legacyStringIdFromHash(window.location.hash)
  if (!legacyId || routeFromPath(window.location.pathname, BASE).kind !== 'root') return undefined
  window.history.replaceState(null, '', `${BASE}${stringPagePath(legacyId)}`)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://thegrandnick.github.io${BASE}${stringPagePath(legacyId)}`)
  return legacyId
}

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '')
  // Real paths (static string pages) decide the view unless a hash view is explicitly requested.
  const route = routeFromPath(window.location.pathname, BASE)
  if (route.kind === 'notFound') return 'notFound'
  if (route.kind === 'string' && !hash) return 'string'
  if (route.kind === 'stringsIndex' && !hash) return 'compare'
  if (hash === 'finder' || hash === 'compare' || hash === 'impressum' || hash === 'datenschutz') return hash
  if (hash.startsWith('result/')) return 'result'
  if (hash.startsWith('string/')) return 'string'
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
  const [stringId, setStringId] = useState<string>(getStringIdFromLocation)
  const liveStrings = useStringPool()
  const specialistProfiles = useSpecialistProfiles()
  const retailerListingsByStringId = useRetailerPrices()

  useEffect(() => {
    if (redirectLegacyStringLink()) document.title = getPageTitle('')
    const onHashChange = () => {
      redirectLegacyStringLink()
      setView(viewFromHash())
      setSharedResultEncoded(getSharedResultEncoded())
      const nextStringId = getStringIdFromLocation()
      setStringId(nextStringId)
      if (nextStringId) window.scrollTo({ top: 0, behavior: 'auto' })
      document.title = getPageTitle(window.location.hash)
    }
    document.title = getPageTitle(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // In-page anchors (#faq, #contact, #strings) opened from another page load the home page
  // first; scroll to them once it has rendered, since the browser's own jump happened too early.
  useEffect(() => {
    const anchor = window.location.hash.replace('#', '')
    if (anchor && view === 'home') document.getElementById(anchor)?.scrollIntoView()
    // Only on first load — later clicks on these anchors are handled by the browser as usual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goTo(next: View) {
    // On a static string page, other views live on the root page: navigate there.
    if (routeFromPath(window.location.pathname, BASE).kind !== 'root') {
      window.location.assign(next === 'home' ? BASE : `${BASE}#${next}`)
      return
    }
    window.location.hash = next === 'home' ? '' : next
    setView(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  // The admin area is deliberately isolated from the public Nav/Footer —
  // it has its own header (Inventory / Return to public site / Log out)
  // inside AdminApp. Real protection is Supabase Auth + RLS, handled
  // entirely inside AdminApp; this route split is just presentation.
  if (view === 'admin') {
    return (
      <Suspense fallback={<p className="p-8 text-center text-ink-700/70 dark:text-shuttle-100/70">Loading admin…</p>}>
        <AdminApp onExit={() => goTo('home')} />
      </Suspense>
    )
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

        {view === 'notFound' && (
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">This page doesn't exist</h1>
            <p className="mt-2 text-ink-700/70 dark:text-shuttle-100/70">The link may be mistyped or outdated. Find your string with the quiz, or browse the full lineup.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => goTo('finder')} className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-6 py-3 cursor-pointer">
                Take the quiz
              </button>
              <button type="button" onClick={() => goTo('compare')} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold px-6 py-3 text-ink-900 dark:text-shuttle-50 cursor-pointer">
                Browse strings
              </button>
            </div>
          </div>
        )}

        {view === 'string' && (
          <StringDetail
            key={stringId}
            stringId={stringId}
            strings={liveStrings}
            specialistProfiles={specialistProfiles}
            retailerListingsByStringId={retailerListingsByStringId}
            onBrowse={() => goTo('compare')}
            onCompare={() => goTo('compare')}
            onQuiz={() => goTo('finder')}
          />
        )}

        {view === 'compare' && (
          <div className="pt-6">
            <h1 className="sr-only">Compare badminton strings</h1>
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
