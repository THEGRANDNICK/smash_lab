import type { ReactNode } from 'react'

interface LegalPageShellProps {
  title: string
  lastUpdated: string
  onHome: () => void
  children: ReactNode
}

/** Shared chrome for the Impressum and Datenschutzerklärung pages — same visual language as the rest of the public site (court/shuttle tokens), a simple prose layout since these are read, not browsed. */
export default function LegalPageShell({ title, lastUpdated, onHome, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-court-900/10 dark:border-white/10 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onHome}
            className="focus-ring font-display font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer hover:text-shuttle-600 dark:hover:text-shuttle-400 transition-colors"
          >
            ← Smash Lab
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">{title}</h1>
          <p className="mt-2 text-xs text-ink-700/50 dark:text-shuttle-100/50">Last updated: {lastUpdated}</p>
          <div className="mt-8 space-y-8 text-ink-700/80 dark:text-shuttle-100/80 [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-xl [&_h2]:text-ink-900 dark:[&_h2]:text-shuttle-50 [&_h2]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline [&_a]:font-semibold [&_a]:text-ink-900 dark:[&_a]:text-shuttle-50">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-court-900/10 dark:border-white/10 py-6 px-4 sm:px-6 text-center text-xs text-ink-700/50 dark:text-shuttle-100/50">
        © 2026 Smash Lab · Nicolas Vogt. All rights reserved.
      </footer>
    </div>
  )
}
