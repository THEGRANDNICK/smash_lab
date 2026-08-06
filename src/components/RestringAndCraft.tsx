import Shuttlecock from './Shuttlecock'

/**
 * Product feedback: (1) a short "when should I restring?" education
 * blurb (1-2 sentences, not a full article), and (2) a trust/
 * craftsmanship section that demonstrates care, not just the
 * engineering behind the recommendations. Per that same feedback, this
 * intentionally does NOT use a stock photo — the image slot is a real
 * placeholder for future workshop/stringing photography, clearly
 * labelled as such rather than faked.
 */
export default function RestringAndCraft() {
  return (
    <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Good to know</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">When should I restring?</h2>
          <p className="mt-3 text-ink-700/70 dark:text-shuttle-100/70 max-w-md">
            A common rule of thumb: restring about as many times a year as you play per week. Tension drops naturally over time — even before a string breaks, a stringbed that's gone dead loses
            power and feel, so restringing on a schedule keeps your racket playing the way it should.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-court-900/15 dark:border-white/20 bg-white/50 dark:bg-white/5 aspect-video flex flex-col items-center justify-center gap-2 text-center p-6">
          <Shuttlecock className="w-10 h-10 text-shuttle-500/70" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink-900 dark:text-shuttle-50">Real photos of the stringing process</p>
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">Coming soon — the machine, finished rackets, and clean knots, not stock photography.</p>
        </div>
      </div>
    </section>
  )
}
