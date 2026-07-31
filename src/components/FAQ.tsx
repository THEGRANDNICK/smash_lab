import { useState } from 'react'
import { FAQS, GROUP_LABEL } from '../data/faqContent'

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">FAQ</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Good questions</h2>
      </div>

      {(['recommendations', 'service'] as const).map((group) => (
        <div key={group} className="mb-10 last:mb-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50 mb-3">{GROUP_LABEL[group]}</h3>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              if (item.group !== group) return null
              const open = openIndex === i
              return (
                <div key={item.q} className="rounded-xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : i)}
                    aria-expanded={open}
                    className="focus-ring w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-ink-900 dark:text-shuttle-50 cursor-pointer"
                  >
                    {item.q}
                    <span className={`shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} aria-hidden="true">
                      +
                    </span>
                  </button>
                  {open && <p className="px-5 pb-4 text-sm text-ink-700/70 dark:text-shuttle-100/70">{item.a}</p>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
