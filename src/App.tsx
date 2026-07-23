import { useEffect, useState } from 'react'
import Nav from './components/Nav'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import StringComparison from './components/StringComparison'
import WhyUs from './components/WhyUs'
import FAQ from './components/FAQ'
import Contact from './components/Contact'
import Footer from './components/Footer'
import StringFinder from './components/StringFinder'

type View = 'home' | 'finder' | 'compare'

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'finder' || hash === 'compare') return hash
  return 'home'
}

function App() {
  const [view, setView] = useState<View>(viewFromHash)

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

  return (
    <div className="min-h-screen flex flex-col">
      <Nav onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} onHome={() => goTo('home')} />

      <main className="flex-1">
        {view === 'home' && (
          <>
            <Hero onOpenFinder={() => goTo('finder')} onOpenCompare={() => goTo('compare')} />
            <HowItWorks />
            <StringComparison />
            <WhyUs />
            <FAQ />
            <Contact />
          </>
        )}

        {view === 'finder' && (
          <div className="py-10 sm:py-16">
            <StringFinder onExit={() => goTo('home')} onCompare={() => goTo('compare')} />
          </div>
        )}

        {view === 'compare' && (
          <div className="pt-6">
            <StringComparison />
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
      </main>

      <Footer />
    </div>
  )
}

export default App
