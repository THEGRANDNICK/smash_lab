import { useState } from 'react'
import Shuttlecock from './Shuttlecock'
import SoundToggle from './SoundToggle'
import ThemeToggle from './ThemeToggle'

interface NavProps {
  onOpenFinder: () => void
  onOpenCompare: () => void
  onHome: () => void
}

export default function Nav({ onOpenFinder, onOpenCompare, onHome }: NavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-shuttle-50/80 dark:bg-[#1e201f]/80 border-b border-court-900/10 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        <button type="button" onClick={onHome} className="focus-ring flex items-center gap-1.5 sm:gap-2 font-display font-bold text-base sm:text-lg text-court-800 dark:text-shuttle-50 cursor-pointer whitespace-nowrap shrink-0">
          <Shuttlecock className="w-6 h-6 sm:w-7 sm:h-7 text-shuttle-500" />
          Smash Lab
        </button>
        <nav aria-label="Main" className="hidden sm:flex items-center gap-6 text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70">
          <button type="button" onClick={onOpenCompare} className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50 cursor-pointer">
            Strings
          </button>
          <a href={`${import.meta.env.BASE_URL}#tension`} className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50">
            Tension
          </a>
          <a href={`${import.meta.env.BASE_URL}#knowledge`} className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50">
            Knowledge
          </a>
          <a href={`${import.meta.env.BASE_URL}#knowledge-contact`} className="focus-ring hover:text-court-800 dark:hover:text-shuttle-50">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <SoundToggle />
          <button
            type="button"
            onClick={onOpenFinder}
            className="focus-ring rounded-full bg-court-800 hover:bg-court-700 text-white text-sm font-bold px-3 sm:px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            🏸 <span className="min-[400px]:hidden">Find String</span>
            <span className="hidden min-[400px]:inline">Find My String</span>
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
          <a href={`${import.meta.env.BASE_URL}#tension`} onClick={() => setMobileMenuOpen(false)} className="focus-ring py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5">
            Tension
          </a>
          <a href={`${import.meta.env.BASE_URL}#knowledge`} onClick={() => setMobileMenuOpen(false)} className="focus-ring py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5">
            FAQ
          </a>
          <a href={`${import.meta.env.BASE_URL}#knowledge-contact`} onClick={() => setMobileMenuOpen(false)} className="focus-ring py-2.5 px-2 rounded-lg hover:bg-court-900/5 dark:hover:bg-white/5">
            Contact
          </a>
        </nav>
      )}
    </header>
  )
}
