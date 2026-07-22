import Shuttlecock from './Shuttlecock'

export default function Footer() {
  return (
    <footer className="border-t border-court-900/10 dark:border-white/10 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-700/60 dark:text-shuttle-100/60">
        <div className="flex items-center gap-2 font-display font-semibold text-ink-900 dark:text-shuttle-50">
          <Shuttlecock className="w-5 h-5 text-shuttle-500" />
          Smash Lab Stringing
        </div>
        <p>Strung locally, one racket at a time.</p>
      </div>
    </footer>
  )
}
