const POINTS = [
  { emoji: '🏸', title: 'Badminton-focused', text: 'Restringing badminton rackets is my main focus, not a side category among many other sports.' },
  { emoji: '⏳', title: '~2.5 years of experience', text: 'Hands-on stringing experience across a wide range of racket brands and models.' },
  { emoji: '🧠', title: 'Personalized recommendations', text: 'String and tension suggestions come from a real scoring model based on how you actually play.' },
  { emoji: '🔩', title: 'Grommet care included', text: 'I check grommets while restringing, and rotate or replace them where it helps protect your racket.' },
  { emoji: '🎯', title: 'Careful, consistent process', text: 'Careful mounting and a consistent stringing pattern, restring after restring.' },
  { emoji: '🧵', title: 'Wide string selection', text: 'A solid lineup of performance strings covering repulsion, control and durability.' },
  { emoji: '📦', title: 'Can order other strings', text: "Don't see what you want in the lineup? I can usually order it in for you." },
  { emoji: '🎒', title: 'Bring your own string', text: 'Prefer to supply your own string? Then you only pay the €15 stringing fee.' },
]

export default function WhyUs() {
  return (
    <section id="why-us" className="py-20 px-4 sm:px-6 bg-court-900/5 dark:bg-white/5 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Why choose this service</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Strung with care, matched with data</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
