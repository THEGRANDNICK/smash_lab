// FAQ content — plain data, no JSX, so it can be imported both by
// components/FAQ.tsx (bundler resolution) and by scripts/testFaq.ts
// (nodenext resolution, no JSX support) without duplicating the text.

export type FaqGroup = 'recommendations' | 'about'

export interface FaqItem {
  q: string
  a: string
  group: FaqGroup
}

export const GROUP_LABEL: Record<FaqGroup, string> = {
  recommendations: 'Strings, tension & recommendations',
  about: 'About Smash Lab',
}

// At most 5 questions (enforced by faqContent.test.ts). Smash Lab is an
// independent string guide, not a stringing service, so the questions
// explain the recommendation, tension, what the site is, where the
// hands-on ratings come from, and how to ask something — no service,
// turnaround or pricing promises.
export const FAQS: FaqItem[] = [
  {
    group: 'recommendations',
    q: 'How does the recommendation work?',
    a: "Your quiz answers build a weighted priority profile across five rated dimensions (repulsion, control, durability, comfort, and hitting sound), plus hands-on specialist notes where available. It's a personalised starting point, not a single \"correct\" answer — you're always free to browse the full lineup directly instead.",
  },
  {
    group: 'recommendations',
    q: 'What tension should I choose?',
    a: "It depends on your level, racket goal, and your current tension if you know it. The tension tool gives a sensible starting point to adjust from over time — and never recommends going above your racket's maximum recommended tension.",
  },
  {
    group: 'about',
    q: 'Is Smash Lab a shop or a stringing service?',
    a: "No. Smash Lab is a free, independent guide to badminton strings. It doesn't sell strings or offer a public stringing service — take your recommendation to your usual stringer or shop.",
  },
  {
    group: 'about',
    q: 'Where do the hands-on ratings come from?',
    a: "From my own playing and from stringing for friends and club mates over about 2.5 years. They're shown separately from the manufacturer ratings, so you can always see which is which.",
  },
  {
    group: 'about',
    q: 'Can I ask you about a string?',
    a: 'Yes — use "Ask about it" on any string, send your quiz result from the results page, or message me via the contact details below. I usually reply within a day.',
  },
]
