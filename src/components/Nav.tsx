import { useState } from 'react'
import Shuttlecock from './Shuttlecock'

interface NavProps {
  onOpenFinder: () => void
  onOpenCompare: () => void
  onHome: () => void
}

export default function Nav({ onOpenFinder, onOpenCompare, onHome }: NavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-shuttle-50/80 dark:bg-[#0c1210]/80 border-b border-court-900/10 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button type="button" onClick={onHome} className="focus-ring flex items-center gap-2 font-display font-bold text-lg text-court-800 dark:text-shuttle-50 cursor-pointer">
          <Shuttlecock className="w-7 h-7 text-shuttle-500" />
          Smash Lab
        </button>
        <nav aria-label="Main" className="hidden sm:flex items-center gap-6 text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70">
          <button type="button" onClick={onOpenCompare} className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50 cursor-pointer">
            Strings
          </button>
          <a href="#faq" className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50">
            FAQ
          </a>
          <a href="#contact" className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFinder}
            className="focus-ring rounded-full bg-court-800 hover:bg-court-700 text-white text-sm font-bold px-4 py-2 transition-colors cursor-pointer"
          >
            🏸 Find My String
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="focus-ring sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 cursor-pointer shrink-0"
          >
            <span aria-hidden="true">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav id="mobile-nav-menu" aria-label="Main mobile" className="sm:hidden border-t border-court-900/10 dark:border-white/10 px-4 py-3 flex flex-col gap-1 text-sm font-semibold text-ink-700/80 dark:text-shuttle-100/80">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false)
              onOpenCompare()
            }}
            className="focus-ring text-left py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5 cursor-pointer"
          >
            Strings
          </button>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="focus-ring py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5">
            FAQ
          </a>
          <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="focus-ring py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5">
            Contact
          </a>
        </nav>
      )}
    </header>
  )
}
