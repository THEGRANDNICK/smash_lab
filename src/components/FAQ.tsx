import { useState } from 'react'

const FAQS = [
  {
    q: 'How long does stringing take?',
    a: 'Usually 1–2 days, depending on how busy things are. Let me know if you need it faster for an upcoming match.',
  },
  {
    q: 'Can I choose a string that the quiz didn\'t recommend?',
    a: "Of course — the quiz is a starting point, not a rulebook. Browse the full lineup any time and pick whatever you like.",
  },
  {
    q: 'What if my exact tension preference is outside the suggested range?',
    a: "Let me know your preference when you drop your racket off — the quiz gives a strong starting point, but I'm happy to adjust.",
  },
  {
    q: 'Do you restring any racket brand?',
    a: 'Yes — Yonex, Victor, Li-Ning and most other brands are no problem.',
  },
  {
    q: "What if a string I want is unavailable?",
    a: "Unavailable strings are shown for reference so you know what exists, but I'll help you find the closest currently available alternative.",
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">FAQ</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Good questions</h2>
      </div>
      <div className="space-y-3">
        {FAQS.map((item, i) => {
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
    </section>
  )
}
