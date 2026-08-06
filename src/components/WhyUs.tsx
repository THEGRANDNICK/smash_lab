const POINTS = [
  { emoji: '🧠', title: 'Personalized, not generic', text: 'Recommendations come from a real scoring model based on how you actually play — not a one-size-fits-all bestseller list.' },
  { emoji: '🏸', title: 'Independent & unbiased', text: 'No sponsorships or paid placements. Every match is based on fit, not on what pays best.' },
  { emoji: '🧵', title: 'Full current lineup', text: 'Compare the whole lineup — repulsion, control, durability, feel — side by side, always up to date.' },
  { emoji: '📦', title: "Can't find it?", text: "Don't see the string you want in the lineup? I can usually order it in for you." },
  { emoji: '🎒', title: 'Bring your own string', text: 'Already have a string in mind? Bring it in and only pay the stringing fee.' },
  { emoji: '🔧', title: 'Careful stringing, when you want it', text: 'Consistent mounting and pattern, with grommets checked along the way — built on ~2.5 years of hands-on experience.' },
]

export default function WhyUs() {
  return (
    <section id="why-us" className="py-20 px-4 sm:px-6 bg-court-900/5 dark:bg-white/5 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Why Smash Lab</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Independent, and built on your answers</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POINTS.map((p) => (
            <div key={p.title} className="flex flex-col gap-2 rounded-2xl bg-white/80 dark:bg-white/5 p-5 border-2 border-court-900/10 dark:border-white/10">
              <div className="text-2xl" aria-hidden="true">
                {p.emoji}
              </div>
              <h3 className="font-display font-semibold text-ink-900 dark:text-shuttle-50 text-sm">{p.title}</h3>
              <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
