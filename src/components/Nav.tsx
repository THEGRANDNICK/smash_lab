import Shuttlecock from './Shuttlecock'

interface NavProps {
  onOpenFinder: () => void
  onOpenCompare: () => void
  onHome: () => void
}

export default function Nav({ onOpenFinder, onOpenCompare, onHome }: NavProps) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-shuttle-50/80 dark:bg-[#0c1210]/80 border-b border-court-900/10 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button type="button" onClick={onHome} className="focus-ring flex items-center gap-2 font-display font-bold text-lg text-court-800 dark:text-shuttle-50 cursor-pointer">
          <Shuttlecock className="w-7 h-7 text-shuttle-500" />
          Smash Lab
        </button>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-semibold text-ink-700/70 dark:text-shuttle-100/70">
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
        <button
          type="button"
          onClick={onOpenFinder}
          className="focus-ring rounded-full bg-court-800 hover:bg-court-700 text-white text-sm font-bold px-4 py-2 transition-colors cursor-pointer"
        >
          🏸 Find My String
        </button>
      </div>
    </header>
  )
}
