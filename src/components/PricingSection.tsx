import { STRINGING_SERVICE_FEE } from '../logic/pricing'

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 max-w-4xl mx-auto scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Pricing</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Simple, transparent pricing</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          One flat stringing fee, plus the cost of whichever string you choose. No hidden extras.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-8 grid sm:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-sm font-semibold text-ink-700/60 dark:text-shuttle-100/60 uppercase tracking-wide">Stringing service</p>
          <p className="font-display text-5xl font-bold text-ink-900 dark:text-shuttle-50 mt-2">€{STRINGING_SERVICE_FEE}</p>
          <p className="text-sm text-ink-700/60 dark:text-shuttle-100/60 mt-2">Flat fee, any racket, any string.</p>
        </div>
        <div>
          <p className="font-semibold text-ink-900 dark:text-shuttle-50 mb-2">Example total</p>
          <div className="rounded-xl bg-court-900/5 dark:bg-white/5 p-4 text-sm">
            <div className="flex justify-between text-ink-700/80 dark:text-shuttle-100/80">
              <span>Yonex Exbolt 65</span>
              <span>€6</span>
            </div>
            <div className="flex justify-between text-ink-700/80 dark:text-shuttle-100/80 mt-1">
              <span>Stringing</span>
              <span>€{STRINGING_SERVICE_FEE}</span>
            </div>
            <div className="flex justify-between font-bold text-ink-900 dark:text-shuttle-50 mt-2 pt-2 border-t border-court-900/10 dark:border-white/10">
              <span>Total</span>
              <span>€21</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
