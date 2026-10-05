import PaperScene from './PaperScene'

interface HeroProps {
  onOpenFinder: () => void
  onOpenCompare: () => void
  /** The detailed quiz (8 rounds) — the quick one is the default. */
  onOpenDetailed?: () => void
}

/**
 * The opening card, lying on the paper court (PaperScene) instead of covering it. One question,
 * two actions, and the three things that make Smash Lab different in a single line.
 */
export default function Hero({ onOpenFinder, onOpenCompare, onOpenDetailed }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-5 pb-6 sm:pt-16 sm:pb-36 min-h-[calc(100svh-4rem)] sm:min-h-[78svh] flex items-start sm:items-center justify-center lg:justify-start lg:pl-[7vw]">
      {/* the cut-out stage: a paper rally on a paper court — only here, on the opening screen */}
      <PaperScene />
      {/* drops onto the court in stop-motion frames (CSS only — the start page doesn't load the animation library) */}
      <div
        className="hero-drop paper relative z-10 w-full max-w-xl px-5 py-5 sm:px-10 sm:py-12 text-center"
      >
        <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-shuttle-700 dark:text-shuttle-400">The independent badminton string finder</p>
        <h1 className="font-display text-[1.9rem] sm:text-5xl font-bold mt-2 sm:mt-3 leading-[1.05] text-ink-900 dark:text-shuttle-50">Not sure which string fits your game?</h1>
        <p className="hidden sm:block mt-4 text-ink-700/80 dark:text-shuttle-100/80">Four quick questions for a string and tension built around how you actually play.</p>

        <div className="mt-4 sm:mt-7 flex flex-row gap-2 sm:gap-3 justify-center items-center">
          <button
            type="button"
            onClick={onOpenFinder}
            data-sound="pluck"
            className="press focus-ring flex-1 sm:flex-none rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold px-4 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg shadow-[3px_3px_0_0_rgba(11,61,46,0.25)] cursor-pointer"
          >
            Find my string
          </button>
          <button
            type="button"
            onClick={onOpenCompare}
            className="press focus-ring flex-1 sm:flex-none rounded-full border-2 border-court-900/20 dark:border-white/25 font-semibold px-4 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg text-ink-900 dark:text-shuttle-50 cursor-pointer"
          >
            Browse strings
          </button>
        </div>

        {onOpenDetailed && (
          <button
            type="button"
            onClick={onOpenDetailed}
            className="focus-ring mt-3 text-sm font-semibold text-court-800 dark:text-shuttle-400 underline underline-offset-4 cursor-pointer"
          >
            Want it more precise? Take the detailed quiz (8 questions)
          </button>
        )}

        <ul className="mt-4 sm:mt-7 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold text-ink-700/80 dark:text-shuttle-100/80">
          <li>✓ Independent</li>
          <li>✓ Hands-on notes</li>
          <li>✓ Free, no sign-up</li>
        </ul>
      </div>
    </section>
  )
}
