// FAQ content — plain data, no JSX, so it can be imported both by
// components/FAQ.tsx (bundler resolution) and by scripts/testFaq.ts
// (nodenext resolution, no JSX support) without duplicating the text.
// See components/FAQ.tsx's own comment for why the two groups exist.

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

// Phase 12 — rewritten around the real questions players actually ask
// about how recommendations, tension, and retailer pricing work (Parts
// 17-18), grouped separately from the existing personal-stringing-service
// questions so both stay easy to scan. Nothing here claims a scientific
// standard, invents a service Smash Lab doesn't offer, or promises a
// specific outcome — see README's Phase 12 section for the content
// principles this was written against.
export const FAQS: FaqItem[] = [
  {
    group: 'recommendations',
    q: 'Which string should I choose?',
    a: "Take the quiz — it turns your priorities into a personalised starting point, not a single \"correct\" answer. You're always free to ignore it and browse the full lineup directly if you already have a string in mind.",
  },
  {
    group: 'recommendations',
    q: 'What tension should I use?',
    a: 'It depends on your level, racket goal, current tension (if you know it), and sometimes the string itself. The tension tool gives a sensible starting range — treat it as a starting point to adjust from over time, not a fixed rule.',
  },
  {
    group: 'recommendations',
    q: 'Is higher tension always better?',
    a: 'No. Higher tension trades power and forgiveness for a more direct, precise feel, and shrinks the sweet spot slightly. Whether that trade is worth it depends on your swing and comfort, not just your level.',
  },
  {
    group: 'recommendations',
    q: "What's the difference between repulsion, control, and durability?",
    a: 'Repulsion is how much energy the string returns to the shuttle — higher usually means easier power. Control is how precisely you can place a shot, which favours a firmer, more direct string bed. Durability is simply how long the string lasts before it breaks or loses its feel.',
  },
  {
    group: 'recommendations',
    q: "Why isn't the highest-rated string always the recommendation?",
    a: "A string that scores well on average across every dimension can still be a worse fit than a string built specifically for what you asked for. If you prioritised durability, a specialist durability string can beat a more \"balanced\" string even if that string's own average rating is higher.",
  },
  {
    group: 'recommendations',
    q: 'How are Smash Lab recommendations calculated?',
    a: "Your answers build a weighted priority profile across five rated dimensions (repulsion, control, durability, comfort, and hitting sound), plus hands-on notes from real stringing experience where available. Strings that specifically excel at what you prioritised are favoured over strings that are just generally decent at everything.",
  },
  {
    group: 'recommendations',
    q: 'What does match percentage mean?',
    a: "It's a relative fit score for this string against your specific answers — how well it lines up with what you asked for, not a scientific probability of satisfaction. It also isn't directly comparable between two different quiz attempts, since it depends on what you answered each time.",
  },
  {
    group: 'recommendations',
    q: 'Are manufacturer ratings directly comparable across brands?',
    a: 'Not with certainty. Each brand rates its own strings on its own scale, so a "7 out of 11" from one brand doesn\'t necessarily mean the same thing as a "7" from another. Smash Lab treats raw manufacturer numbers cautiously for exactly this reason, rather than assuming they line up perfectly.',
  },
  {
    group: 'recommendations',
    q: 'How often should I restring?',
    a: 'A common rule of thumb is as many times a year as you play per week — but adjust for how often you break strings, whether you notice tension loss, and how the string actually feels to you.',
  },
  {
    group: 'recommendations',
    q: 'What does string gauge change?',
    a: 'A thinner gauge generally feels livelier with a bit more repulsion and feedback, at the cost of durability. A thicker gauge trades some of that liveliness for a string bed that lasts longer.',
  },
  {
    group: 'recommendations',
    q: 'What is a hybrid string setup?',
    a: "Using a different string for your mains and crosses — for example, a livelier string in the mains for power and a more durable or control-oriented string in the crosses. It's a way to blend two characters in one racket rather than picking just one string.",
  },
  {
    group: 'recommendations',
    q: 'Why might an unavailable string still be recommended?',
    a: "Because the recommendation is based purely on how well a string fits what you asked for — availability is shown separately, not used to filter what counts as the best match. If it's not in stock, you'll see that clearly, along with what's actually available today as an alternative.",
  },
  {
    group: 'recommendations',
    q: 'How are retailer prices compared?',
    a: "By price per metre, not the sticker price — a small set and a long reel of the same string aren't a fair comparison otherwise. Only listings with both a known price and a known package length are compared this way; anything else is shown as-is rather than guessed at.",
  },
  {
    group: 'recommendations',
    q: 'Does "price per metre" include shipping?',
    a: 'No. The price-per-metre figure is based on the listed string price and package length only — it does not include shipping, delivery, or any other fees unless a listing explicitly says otherwise.',
  },
  {
    group: 'recommendations',
    q: 'Does Smash Lab sell strings or string rackets?',
    a: "Smash Lab is a personal racket-stringing service, not a retail store — see the questions below for how that works. Retailer prices shown on the site are for buying string elsewhere; you're also welcome to bring your own string and only pay for the stringing itself.",
  },
  {
    group: 'service',
    q: 'How long does stringing take?',
    a: 'Usually 1–2 days, depending on how busy things are. Let me know if you need it faster for an upcoming match.',
  },
  {
    group: 'service',
    q: "Can I choose a string that the quiz didn't recommend?",
    a: "Of course — the quiz is a starting point, not a rulebook. Browse the full lineup any time and pick whatever you like.",
  },
  {
    group: 'service',
    q: 'What if my exact tension preference is outside the suggested range?',
    a: "Let me know your preference when you drop your racket off — the quiz gives a strong starting point, but I'm happy to adjust.",
  },
  {
    group: 'service',
    q: 'Do you restring any racket brand?',
    a: 'Yes — Yonex, Victor, Li-Ning and most other brands are no problem.',
  },
  {
    group: 'service',
    q: "What if the string I want isn't available?",
    a: "Just ask me. I can usually order other strings as well, although this may take a little longer and an individually purchased set can cost more than the strings I regularly keep in stock on reels. You're also welcome to bring your own string — in that case you only pay for the stringing service, with no separate string cost.",
  },
  {
    group: 'service',
    q: 'Do you check the racket and grommets?',
    a: "Yes. While restringing, I also keep an eye on the racket's grommets. Where useful, I rotate worn grommets so the string doesn't keep pressing against exactly the same worn spot. If a grommet is broken and needs replacing, I replace it where possible before stringing.",
  },
  {
    group: 'service',
    q: 'What does your stringing process look like?',
    a: "I aim to use a careful, consistent stringing process and follow professional badminton stringing practices as closely as possible, including techniques used by professional Yonex stringers — correct mounting, a proper stringing pattern, and careful handling throughout. To be clear, I'm not an official Yonex Stringing Team member or Yonex-certified, and this isn't a Yonex-endorsed service — it's simply the standard I hold my own work to.",
  },
  {
    group: 'service',
    q: 'What machine do you use?',
    a: "A Pro's Pro Hornet MT-250 — a dedicated electronic stringing machine, used for consistent tension and careful racket mounting.",
  },
  {
    group: 'service',
    q: 'How much stringing experience do you have?',
    a: "I've been stringing rackets for around 2½ years, with badminton as my main focus. In that time I've worked on many different rackets across a wide range of brands and models, and occasionally string tennis rackets too. My goal isn't just to put new strings in a racket, but to give each one careful attention — from string choice and tension to the grommets and final result.",
  },
]
