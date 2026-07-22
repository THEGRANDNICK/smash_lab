// Centralized badminton string database.
// Edit this file to add/remove strings, change stock, prices, colors, or ratings.
// Nothing else in the app should hard-code string data.

export type StockLevel = 'in-stock' | 'low-stock' | 'unavailable'

export type StringCategory = 'repulsion' | 'control' | 'durability'

export interface StringTensionMeta {
  /** Gauge in mm, if known (thinner strings tend to feel livelier). */
  gauge?: number
  /** Small kg nudge applied on top of the base tension recommendation (-0.5 to +0.5 typical). */
  tensionAdjustment?: number
  /** Recommended tension window in kg for this string specifically. */
  recommendedMin?: number
  recommendedMax?: number
  tensionNotes?: string
}

export interface StringItem {
  id: string
  brand: string
  name: string
  category: StringCategory
  /** 0-11 relative ratings as supplied by the stringer. */
  repulsion: number
  durability: number
  hittingSound: number
  shockAbsorption: number | null // null = unknown
  control: number
  stock: StockLevel
  /** Number of sets currently on hand, for display purposes only. Optional. */
  setsAvailable?: number
  /** Cost of the string itself in EUR. Kept separate from the service fee. */
  stringCost: number | null // null = price not set yet
  colors?: string[]
  /**
   * Real-world playing character — feel, shuttle hold, smash response,
   * durability behavior, trade-offs, etc. Kept deliberately separate from
   * the numeric ratings above: those are manufacturer-derived, this is
   * descriptive nuance (manufacturer positioning, community consensus, or
   * this stringer's own observations, worded accordingly). See per-string
   * source comments below for what informed each description.
   */
  notes?: string
  tension?: StringTensionMeta
  /**
   * Lower number = more popular. Reflects what's actually common among
   * players at this stringer's own club — not global sales data. Leave
   * unset for strings with no particular popularity signal.
   */
  popularityRank?: number
  /**
   * Official manufacturer product page, if confidently known and stable.
   * Rendered as a small "View on Yonex"-style external link — never
   * required, and never guessed when uncertain.
   */
  productUrl?: string
  /**
   * Manufacturer retail-set/package image. Deliberately unset for every
   * string right now — hotlinking manufacturer product photography without
   * a clearly stable, rights-appropriate source isn't done here. The field
   * exists so a real image can be added later (e.g. a locally-hosted photo
   * the stringer has rights to use) without any other code changes.
   */
  imageUrl?: string
}

export const strings: StringItem[] = [
  // --- YONEX: QUICK REPULSION ---
  {
    id: 'yonex-aerosonic',
    brand: 'Yonex',
    name: 'Aerosonic',
    category: 'repulsion',
    repulsion: 11,
    durability: 5,
    hittingSound: 11,
    shockAbsorption: 7,
    control: 9,
    stock: 'unavailable',
    stringCost: null,
    // In practice: one of Yonex's thinnest, most explosive repulsion strings historically.
    notes:
      'One of Yonex\'s thinnest, most explosive repulsion strings — extremely crisp and lively, but fragile. Best suited to players chasing maximum feel over lifespan, not durability.',
    tension: { gauge: 0.61, tensionAdjustment: 0.5, tensionNotes: 'Very thin & lively — feels tight even at moderate tension.' },
  },
  {
    id: 'yonex-bg66-force',
    brand: 'Yonex',
    name: 'BG66 Force',
    category: 'repulsion',
    repulsion: 10,
    durability: 6,
    hittingSound: 9,
    shockAbsorption: 9,
    control: 10,
    stock: 'low-stock',
    setsAvailable: 1,
    stringCost: 7.9,
    // Yonex markets this around a thin, repulsion-focused gauge with strong control for heavy attacking smashes.
    notes: 'Yonex positions this as a thin, repulsion-focused string with unusually good control for its category — built for heavy, attacking smashes without giving up much precision.',
    tension: { gauge: 0.65, tensionAdjustment: 0.25 },
    productUrl: 'https://www.yonex.com/bg66f',
  },
  {
    id: 'yonex-bg66-ultimax',
    brand: 'Yonex',
    name: 'BG66 Ultimax',
    category: 'repulsion',
    repulsion: 10,
    durability: 6,
    hittingSound: 10,
    shockAbsorption: 8,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 6,
    // Yonex describes this as an ultra-thin, all-round repulsion string with a clear hitting sound.
    notes: "Yonex's ultra-thin, all-round repulsion string — a clear, crisp hitting sound with a lively, connected feel that still holds up reasonably well for how thin it is.",
    tension: { gauge: 0.65, tensionAdjustment: 0.25, tensionNotes: 'Crisp hitting sound with a lively, all-round response.' },
    productUrl: 'https://www.yonex.com/bg66um',
  },
  {
    id: 'yonex-nanogy-98',
    brand: 'Yonex',
    name: 'Nanogy 98',
    category: 'repulsion',
    repulsion: 10,
    durability: 7,
    hittingSound: 8,
    shockAbsorption: 8,
    control: 8,
    stock: 'unavailable',
    stringCost: null,
    notes: 'An older Yonex repulsion string with a balanced mix of power and durability — largely superseded in the current lineup by the Exbolt series.',
  },
  {
    id: 'yonex-bg80-power',
    brand: 'Yonex',
    name: 'BG80 Power',
    category: 'repulsion',
    repulsion: 9,
    durability: 7,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 6,
    stock: 'unavailable',
    stringCost: null,
    notes: 'A power-oriented sibling to BG80 with a similarly crisp, direct feel — like BG80, it suits players who generate their own pace rather than relying on the string for easy power.',
  },
  {
    id: 'yonex-bg80',
    brand: 'Yonex',
    name: 'BG80',
    category: 'repulsion',
    repulsion: 8,
    durability: 6,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 6,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 5.75,
    popularityRank: 1,
    // Sources: https://www.yonex.com/bg80 (gauge, Vectran/braided construction, quick-repulsion
    // positioning, hitting sound, tension retention — verified via product listings, direct fetch
    // of yonex.com was blocked for this tool). Qualitative hard-hitter framing informed by general
    // community consensus; see https://www.reddit.com/r/badminton/comments/1c0iruo/ for a
    // BG80-vs-Exbolt-65 comparison thread (used only for context, not as numeric data — that
    // thread itself could not be fetched directly by this tool either, so treat this as
    // general background rather than a direct quote).
    notes:
      "One of Yonex's longest-standing performance strings — a 0.68mm Vectran-braided construction that Yonex positions around quick repulsion, a crisp hitting sound, and strong tension retention. Its five-axis ratings look modest next to newer, thinner Exbolt-series strings, but it remains a go-to choice for players who generate their own power: the direct, connected feel rewards a strong swing rather than doing the work for you. In practice, many hard-hitting attacking players still prefer it over thinner modern strings for the extra control and feedback, even if it's not the easiest string for generating power from scratch.",
    tension: { gauge: 0.68 },
    productUrl: 'https://www.yonex.com/bg80',
  },
  {
    id: 'yonex-exbolt-65',
    brand: 'Yonex',
    name: 'Exbolt 65',
    category: 'repulsion',
    repulsion: 10,
    durability: 8,
    hittingSound: 9,
    shockAbsorption: 8,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 6,
    // Yonex describes the Elasticity Outer layer over the Forged Fiber core as adding hold/control vs. Exbolt 63.
    notes:
      'A well-rounded performance string: fast, controlled, and holds up better than most thin repulsion strings. Yonex adds an extra outer layer over the Exbolt 63\'s core construction specifically for more shuttle hold and control.',
    tension: { gauge: 0.65, tensionAdjustment: 0.25, recommendedMin: 9, recommendedMax: 12 },
  },
  {
    id: 'yonex-exbolt-63',
    brand: 'Yonex',
    name: 'Exbolt 63',
    category: 'repulsion',
    repulsion: 11,
    durability: 7,
    hittingSound: 10,
    shockAbsorption: 7,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 6,
    notes:
      "Thinner gauge than Exbolt 65 for even more explosive repulsion and crisper feedback, at some cost to durability — Yonex's liveliest string in the Exbolt lineup.",
    tension: { gauge: 0.63, tensionAdjustment: 0.5, recommendedMin: 9, recommendedMax: 12 },
    productUrl: 'https://www.yonex.com/bgxb63',
  },

  // --- YONEX: CONTROL ---
  {
    id: 'yonex-aerobite',
    brand: 'Yonex',
    name: 'AeroBite',
    category: 'control',
    repulsion: 10,
    durability: 6,
    hittingSound: 9,
    shockAbsorption: 8,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 6.5,
    // Yonex's hybrid concept: a thicker 0.67mm main string for power/durability with a
    // thinner 0.61mm cross string for extra spin/shuttle grip (gauges via retailer listings).
    notes:
      "Yonex's hybrid string — thinner cross strings tuned for spin and shuttle grip on net play and flat exchanges, paired with a slightly thicker main string for power and durability.",
    tension: { gauge: 0.67 },
    popularityRank: 2,
  },
  {
    id: 'yonex-aerobite-boost',
    brand: 'Yonex',
    name: 'AeroBite Boost',
    category: 'control',
    repulsion: 8,
    durability: 7,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 10,
    stock: 'low-stock',
    setsAvailable: 1,
    stringCost: 10.9,
    notes: "A control-leaning variant of AeroBite's hybrid concept — the same spin-friendly thinner cross strings, tuned further toward control over outright repulsion.",
  },
  {
    id: 'yonex-skyarc',
    brand: 'Yonex',
    name: 'SkyArc',
    category: 'control',
    repulsion: 8,
    durability: 7,
    hittingSound: 6,
    shockAbsorption: 11,
    control: 10,
    stock: 'low-stock',
    setsAvailable: 1,
    stringCost: 10.9,
    notes: 'The most arm-friendly string in the lineup — exceptional shock absorption without sacrificing control.',
    tension: { gauge: 0.69, tensionAdjustment: -0.25, tensionNotes: 'Soft, cushioned feel — often paired with slightly lower tension for maximum comfort.' },
  },
  {
    id: 'yonex-nanogy-99',
    brand: 'Yonex',
    name: 'Nanogy 99',
    category: 'control',
    repulsion: 9,
    durability: 7,
    hittingSound: 8,
    shockAbsorption: 8,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 5.75,
    // Yonex's control-oriented coating gives it a slightly textured, grippy surface — commonly
    // described as helping "bite" the shuttle on net shots, slices and deceptive drops.
    notes:
      "A control-first classic with a soft, dependable feel. Its slightly textured coating helps grip the shuttle for precise net play, slices and deceptive drops, at some cost to outright repulsion.",
    tension: { gauge: 0.69 },
    popularityRank: 3,
  },

  // --- YONEX: DURABILITY ---
  {
    id: 'yonex-exbolt-68',
    brand: 'Yonex',
    name: 'Exbolt 68',
    category: 'durability',
    repulsion: 9,
    durability: 11,
    hittingSound: 8,
    shockAbsorption: 6,
    control: 10,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 6,
    // Yonex markets this as the thickest, most durable Exbolt for hard hitters and high-tension
    // setups (Forged Fiber core + Elasticity Outer coating for shuttle hold, per product listings).
    // Wear durability vs. mishit-breakage nuance below is this stringer's own observation from
    // actual restringing work, cross-referenced against community discussion at
    // https://www.reddit.com/r/badminton/comments/1fih8yc/ (that thread could not be fetched
    // directly by this tool, so treat it as general background rather than a direct quote).
    notes:
      "Yonex's most durable Exbolt, built for hard hitters and high-tension setups without losing the performance-string feel — strong repulsion and control alongside long-term durability. In practice, that's wear durability: like other thin, high-performance strings it can still snap suddenly from a severe off-centre mishit, which is a different thing from how well it holds up over normal play.",
    tension: { gauge: 0.68, tensionAdjustment: -0.25, recommendedMin: 9, recommendedMax: 12 },
  },
  {
    id: 'yonex-nanogy-95',
    brand: 'Yonex',
    name: 'Nanogy 95',
    category: 'durability',
    repulsion: 8,
    durability: 10,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 6,
    stock: 'unavailable',
    stringCost: null,
    notes: 'An older durability-focused Nanogy — tougher and more forgiving of mishits than the control-oriented Nanogy 99, at the cost of some control and repulsion.',
  },
  {
    id: 'yonex-bg65-titanium',
    brand: 'Yonex',
    name: 'BG65 Titanium',
    category: 'durability',
    repulsion: 7,
    durability: 7,
    hittingSound: 7,
    shockAbsorption: 6,
    control: 6,
    stock: 'unavailable',
    stringCost: null,
    notes: 'A titanium-coated variant of BG65 aimed at extra durability and a slightly firmer feel — largely phased out of the current lineup.',
  },
  {
    id: 'yonex-bg65',
    brand: 'Yonex',
    name: 'BG65',
    category: 'durability',
    repulsion: 7,
    durability: 10,
    hittingSound: 6,
    shockAbsorption: 6,
    control: 6,
    stock: 'in-stock',
    stringCost: 5.9,
    notes: 'A tough, no-frills workhorse string built to survive frequent play.',
    tension: { gauge: 0.7, tensionAdjustment: -0.25 },
    popularityRank: 4,
  },

  // --- LI-NING ---
  {
    id: 'lining-no1',
    brand: 'Li-Ning',
    name: 'No.1',
    category: 'repulsion',
    repulsion: 10,
    durability: 7,
    hittingSound: 9,
    shockAbsorption: 7,
    control: 8,
    stock: 'in-stock',
    setsAvailable: 10,
    stringCost: 5,
    // Li-Ning's "3D KINT" construction (per retailer listings) — a value-oriented string that
    // holds up a bit better than its thin gauge alone would suggest.
    notes:
      "Excellent performance-per-euro — strong repulsion and a crisp sound at a very friendly price. Li-Ning's braided construction gives it a bit more durability than its gauge alone would suggest.",
    tension: { gauge: 0.65 },
  },
  {
    id: 'lining-no1-boost',
    brand: 'Li-Ning',
    name: 'No.1 Boost',
    category: 'repulsion',
    repulsion: 10,
    durability: 8,
    hittingSound: 10,
    shockAbsorption: 8,
    control: 8,
    stock: 'unavailable',
    stringCost: null,
    notes: "A higher-performance sibling to Li-Ning's No.1, with a livelier repulsion and hitting sound — currently out of stock.",
  },

  // --- VICTOR ---
  {
    id: 'victor-vbs66-nano',
    brand: 'Victor',
    name: 'VBS-66 Nano',
    category: 'repulsion',
    repulsion: 9,
    durability: 8,
    hittingSound: 7,
    shockAbsorption: null,
    control: 7,
    stock: 'low-stock',
    setsAvailable: 2,
    notes: "Victor's nanotechnology-core string — a lively, medium-feel all-rounder with solid repulsion and durability for its gauge.",
    tension: { gauge: 0.66 },
    stringCost: 7.9,
  },
]

export function getString(id: string): StringItem | undefined {
  return strings.find((s) => s.id === id)
}
