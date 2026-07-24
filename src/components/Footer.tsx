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
      <div className="max-w-6xl mx-auto mt-4 pt-4 border-t border-court-900/10 dark:border-white/10 text-center text-xs text-ink-700/50 dark:text-shuttle-100/50">
        <p>
          © 2026 Smash Lab · Nicolas Vogt. All rights reserved.{' '}
          <a
            href="https://github.com/THEGRANDNICK/smash_lab/blob/main/COPYRIGHT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink-900 dark:hover:text-shuttle-50"
          >
            Copyright
          </a>
        </p>
      </div>
    </footer>
  )
}
