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
  notes?: string
  tension?: StringTensionMeta
  /**
   * Lower number = more popular. Reflects what's actually common among
   * players at this stringer's own club — not global sales data. Leave
   * unset for strings with no particular popularity signal.
   */
  popularityRank?: number
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
    notes: 'Extremely crisp and explosive, but very fragile — for players who prioritize feel over lifespan.',
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
    tension: { gauge: 0.66, tensionAdjustment: 0.25 },
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
    tension: { gauge: 0.65, tensionAdjustment: 0.25, tensionNotes: 'Crisp hitting sound with a lively, all-round response.' },
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
    notes: 'A well-rounded performance string: fast, controlled, and holds up better than most repulsion strings.',
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
    notes: 'Thinner gauge than Exbolt 65 for even more explosive repulsion, at some cost to durability.',
    tension: { gauge: 0.63, tensionAdjustment: 0.5, recommendedMin: 9, recommendedMax: 12 },
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
    notes: 'Hybrid string (thinner cross strings) tuned for spin and control on net play and flat exchanges.',
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
    tension: { tensionAdjustment: -0.25, tensionNotes: 'Soft, cushioned feel — often paired with slightly lower tension for maximum comfort.' },
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
    notes: 'A control-first classic with a soft, dependable feel and good all-round durability.',
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
    notes: 'The most durable string with a performance-string feel — the best pick for players who snap strings often but still want control.',
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
    notes: 'Excellent performance-per-euro — strong repulsion and a crisp sound at a very friendly price.',
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
    stringCost: 7.9,
  },
]

export function getString(id: string): StringItem | undefined {
  return strings.find((s) => s.id === id)
}
