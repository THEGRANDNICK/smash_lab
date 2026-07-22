const POINTS = [
  { emoji: '🏸', title: 'A fellow player, not a factory', text: 'Strung by someone who plays the game and actually cares which string you end up with.' },
  { emoji: '🧠', title: 'Matched, not guessed', text: 'Recommendations come from a real scoring model across power, control, durability, feel and comfort — not a sales pitch.' },
  { emoji: '🔍', title: 'Full transparency', text: 'Every string\'s ratings, stock level and price are visible up front. No surprises at pickup.' },
  { emoji: '⏱️', title: 'Quick turnaround', text: "Drop your racket off and I'll let you know when it's ready — usually within a day or two." },
]

export default function WhyUs() {
  return (
    <section id="why-us" className="py-20 px-4 sm:px-6 bg-court-900/5 dark:bg-white/5 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Why choose this service</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Strung with care, matched with data</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {POINTS.map((p) => (
            <div key={p.title} className="flex gap-4 rounded-2xl bg-white/80 dark:bg-white/5 p-6 border-2 border-court-900/10 dark:border-white/10">
              <div className="text-3xl shrink-0" aria-hidden="true">
                {p.emoji}
              </div>
              <div>
                <h3 className="font-display font-semibold text-ink-900 dark:text-shuttle-50">{p.title}</h3>
                <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70 mt-1">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
