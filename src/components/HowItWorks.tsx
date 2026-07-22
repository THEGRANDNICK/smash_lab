const STEPS = [
  { emoji: '🏸', title: 'Take the quiz', text: 'Answer a handful of quick questions about how and how often you play — about 30–60 seconds.' },
  { emoji: '🧮', title: 'Get matched', text: 'A weighted scoring engine compares your answers against the whole string lineup and current tension.' },
  { emoji: '🧵', title: 'Bring your racket', text: "Drop off your racket (or arrange pickup) and I'll string it to your matched setup." },
  { emoji: '🎯', title: 'Play better', text: 'Pick it up ready to go — with notes on why this string and tension fit your game.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">How it works</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">From quiz to strung racket</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6">
            <span className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-court-800 text-white text-sm font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="text-3xl mb-3" aria-hidden="true">
              {step.emoji}
            </div>
            <h3 className="font-display font-semibold text-ink-900 dark:text-shuttle-50">{step.title}</h3>
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70 mt-2">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
