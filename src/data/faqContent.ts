// FAQ content — plain data, no JSX, so it can be imported both by
// components/FAQ.tsx (bundler resolution) and by scripts/testFaq.ts
// (nodenext resolution, no JSX support) without duplicating the text.

export type FaqGroup = 'recommendations' | 'service'

export interface FaqItem {
  q: string
  a: string
  group: FaqGroup
}

export const GROUP_LABEL: Record<FaqGroup, string> = {
  recommendations: 'Strings, tension & recommendations',
  service: 'The stringing service',
}

// Stability/legal/conversion phase (Part 14) — trimmed from 24 entries down
// to the 5 most order-relevant questions, chosen to unblock a real
// enquiry rather than serve as technical documentation. Detail that used
// to live here (rating-scale caveats, price-per-metre mechanics, hybrid
// setups, etc.) either folds into the manufacturer-data disclaimer shown
// once near the recommendation (DisclaimerBox.tsx) or is simply dropped
// as more detail than a first-time visitor needs to decide whether to
// get in touch.
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
    group: 'service',
    q: 'How long does stringing take?',
    a: 'Usually 1–2 days, depending on how busy things are. Let me know if you need it faster for an upcoming match.',
  },
  {
    group: 'service',
    q: 'Can I bring my own string?',
    a: "Yes — you're welcome to bring your own string, in which case you only pay for the stringing service, with no separate string cost. Or ask me about a string that isn't in the lineup; I can usually order it, though it may take a little longer.",
  },
  {
    group: 'service',
    q: 'How do I request the recommended setup?',
    a: 'After the quiz, use "Want this setup in your racket?" to send the recommended string and tension straight to WhatsApp or email — or copy the summary yourself. No account needed, and nothing is sent until you tap Send.',
  },
]
