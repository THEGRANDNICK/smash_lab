import type { ReactNode } from 'react'
import { cutEllipse, cutPolygon } from '../logic/scissors'

/**
 * Cut-paper icons for the quiz answers, replacing the platform emojis (which looked like a
 * different product). Every icon is a hand-cut card disc with one to three paper shapes on it,
 * in the site's own colours, cut with the same scissors as the stage. Shapes are computed once at
 * module load (seeded, so they look the same on every visit).
 */

const C = {
  felt: '#2f9a46',
  feltDark: '#1f6f37',
  cream: '#f3e3b5',
  card: '#fff8ea',
  orange: '#ff8a1f',
  orangeDark: '#ef7410',
  red: '#d5523b',
  yellow: '#ffcf33',
  blue: '#2f63c9',
  ink: '#2b2b2e',
  skin: '#f1c7a0',
  brown: '#8a5a3c',
}

const P = (pts: [number, number][], seed: number, rough = 0.8) => cutPolygon(pts, seed, rough)
const E = (cx: number, cy: number, rx: number, ry: number, seed: number, snips = 12) => cutEllipse(cx, cy, rx, ry, seed, snips, 0.04)
const star = (cx: number, cy: number, r1: number, r2: number, n: number): [number, number][] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? r2 : r1
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })

const DISC = E(24, 24, 22, 22, 501, 16)

const shape = (d: string, fill: string) => <path d={d} fill={fill} />

// --- motifs (48 × 48) ---------------------------------------------------------------
const SPROUT = [P([[10, 36], [38, 36], [35, 42], [13, 42]], 510), P([[22.5, 36], [25.5, 36], [25, 20], [23, 20]], 511, 0.4), E(17, 20, 7, 4, 512), E(31, 18, 8, 4.5, 513)]
const sprout = <>{shape(SPROUT[0], C.brown)}{shape(SPROUT[1], C.felt)}{shape(SPROUT[2], C.felt)}{shape(SPROUT[3], C.feltDark)}</>

const RK = [E(21, 19, 10, 12, 520), E(21, 19, 6.5, 8.5, 521), P([[28, 28], [31, 26], [41, 38], [38, 41]], 522, 0.5)]
const racket = (
  <>
    {shape(RK[0], C.red)}
    {shape(RK[1], C.card)}
    <path d="M17 11v16M21 10.5v17M25 11v16M14 15h14M13.5 19h15M14 23h14" stroke={C.orangeDark} strokeWidth="1.1" />
    {shape(RK[2], C.ink)}
  </>
)

const FLAME = [P([[24, 6], [35, 22], [34, 34], [24, 42], [14, 34], [13, 22], [19, 26]], 530, 1.2), P([[24, 20], [30, 30], [28, 37], [24, 40], [20, 37], [18, 30]], 531, 0.8)]
const flame = <>{shape(FLAME[0], C.orange)}{shape(FLAME[1], C.yellow)}</>

const TROPHY = [P([[13, 10], [35, 10], [33, 22], [24, 28], [15, 22]], 540, 0.9), P([[21, 28], [27, 28], [28, 34], [20, 34]], 541, 0.5), P([[15, 34], [33, 34], [34, 40], [14, 40]], 542, 0.7)]
const trophy = <>{shape(TROPHY[0], C.yellow)}{shape(TROPHY[1], C.yellow)}{shape(TROPHY[2], C.brown)}</>

const BURST = [P(star(24, 24, 17, 8, 8), 550, 1.2), P(star(24, 24, 9, 4.5, 8), 551, 0.6)]
const burst = <>{shape(BURST[0], C.red)}{shape(BURST[1], C.yellow)}</>

const BOLT = [P([[27, 6], [14, 26], [23, 26], [19, 42], [34, 20], [25, 20], [30, 6]], 560, 0.8)]
const bolt = shape(BOLT[0], C.yellow)

const TG = [E(24, 24, 16, 16, 570, 14), E(24, 24, 11, 11, 571), E(24, 24, 6, 6, 572, 10)]
const target = <>{shape(TG[0], C.red)}{shape(TG[1], C.card)}{shape(TG[2], C.red)}</>

const SHIELD = [P([[24, 7], [37, 12], [35, 28], [24, 41], [13, 28], [11, 12]], 580, 1), P([[24, 13], [31, 16], [30, 27], [24, 34]], 581, 0.6)]
const shield = <>{shape(SHIELD[0], C.blue)}{shape(SHIELD[1], C.cream)}</>

const SCALE = [P([[23, 10], [25, 10], [25, 38], [23, 38]], 590, 0.3), P([[9, 16], [39, 16], [39, 19], [9, 19]], 591, 0.4), P([[7, 26], [19, 26], [16, 31], [10, 31]], 592, 0.5), P([[29, 26], [41, 26], [38, 31], [32, 31]], 593, 0.5), P([[16, 38], [32, 38], [33, 41], [15, 41]], 594, 0.5)]
const scale = <>{shape(SCALE[0], C.ink)}{shape(SCALE[1], C.ink)}{shape(SCALE[2], C.orange)}{shape(SCALE[3], C.orange)}{shape(SCALE[4], C.ink)}</>

const WAVE = [P([[6, 30], [12, 22], [18, 26], [24, 18], [30, 24], [36, 16], [42, 24], [42, 38], [6, 38]], 600, 1), P([[6, 34], [14, 29], [22, 33], [30, 28], [42, 32], [42, 38], [6, 38]], 601, 0.8)]
const wave = <>{shape(WAVE[0], C.blue)}{shape(WAVE[1], '#5b8be0')}</>

const ARM = [P([[8, 34], [18, 26], [22, 14], [30, 12], [32, 18], [27, 22], [34, 26], [38, 34], [30, 40], [12, 40]], 610, 1)]
const muscle = <>{shape(ARM[0], C.skin)}<path d="M26 28c3-2 6-1 8 2" stroke={C.brown} strokeWidth="1.5" fill="none" /></>

const SH = [P([[19, 26], [10, 10], [28, 6], [29, 24]], 620, 0.8), E(26, 30, 6, 5, 621, 9)]
const shuttle = (extra?: ReactNode) => (
  <>
    {extra}
    {shape(SH[0], C.card)}
    <path d="M20 25L14 10M24 24L22 8M27 24L28 7" stroke="#b9a988" strokeWidth="1" />
    {shape(SH[1], C.cream)}
  </>
)
const rocketShuttle = shuttle(<path d="M33 36l8 3M31 41l7 5M36 31l8 1" stroke={C.orange} strokeWidth="2.5" strokeLinecap="round" />)
const gripShuttle = shuttle(<path d="M8 38l4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4" stroke={C.felt} strokeWidth="3" fill="none" strokeLinejoin="round" />)

const NET = [P([[8, 14], [40, 14], [40, 36], [8, 36]], 630, 0.6), P([[7, 12], [41, 12], [41, 16], [7, 16]], 631, 0.4)]
const net = (
  <>
    {shape(NET[0], C.feltDark)}
    <path d="M10 18l26 16M18 18l20 12M26 18l12 8M10 26l12 8M10 18v0M36 18L10 34M28 18L10 30M20 18l-10 6" stroke={C.cream} strokeWidth="1" />
    {shape(NET[1], C.cream)}
  </>
)

const SPOOL = [E(24, 24, 16, 16, 640, 14), E(24, 24, 9, 9, 641)]
const spool = (
  <>
    {shape(SPOOL[0], C.orangeDark)}
    <circle cx="24" cy="24" r="13" fill="none" stroke={C.orange} strokeWidth="2" />
    <circle cx="24" cy="24" r="10.5" fill="none" stroke={C.orange} strokeWidth="1.5" />
    {shape(SPOOL[1], C.card)}
  </>
)

const CLOUD = [P([[8, 34], [10, 26], [16, 24], [18, 16], [26, 14], [32, 19], [38, 20], [41, 28], [39, 34]], 650, 1.2)]
const cloud = <path d={CLOUD[0]} fill="#dbe7f6" stroke="#5b8be0" strokeWidth="1.6" strokeLinejoin="round" />

const HOURGLASS = [P([[13, 8], [35, 8], [35, 12], [26, 24], [35, 36], [35, 40], [13, 40], [13, 36], [22, 24], [13, 12]], 660, 0.6), P([[17, 12], [31, 12], [24, 21]], 661, 0.4), P([[19, 37], [29, 37], [24, 30]], 662, 0.4)]
const hourglass = <>{shape(HOURGLASS[0], C.brown)}{shape(HOURGLASS[1], C.yellow)}{shape(HOURGLASS[2], C.yellow)}</>

const SPEAKER = [P([[8, 19], [16, 19], [26, 10], [26, 38], [16, 29], [8, 29]], 670, 0.7)]
const speaker = (
  <>
    {shape(SPEAKER[0], C.ink)}
    <path d="M31 18c3 3 3 9 0 12M35 14c5 5 5 15 0 20" stroke={C.orange} strokeWidth="2.6" strokeLinecap="round" fill="none" />
  </>
)

const HAMMER = [P([[10, 10], [32, 10], [32, 19], [10, 19]], 680, 0.7), P([[20, 19], [25, 19], [26, 41], [21, 41]], 681, 0.5)]
const hammer = <>{shape(HAMMER[0], C.ink)}{shape(HAMMER[1], C.brown)}</>

const CAL = [P([[9, 11], [39, 11], [39, 40], [9, 40]], 690, 0.8), P([[9, 11], [39, 11], [39, 19], [9, 19]], 691, 0.6)]
const calendar = (marks: number) => (
  <>
    {shape(CAL[0], C.card)}
    {shape(CAL[1], C.red)}
    {Array.from({ length: 6 }, (_, i) => (
      <rect key={i} x={13 + (i % 3) * 8} y={23 + Math.floor(i / 3) * 8} width="6" height="5" rx="1" fill={i < marks ? C.felt : '#d9cfb9'} />
    ))}
  </>
)

const fray = (
  <>
    <path d="M12 24h24" stroke={C.orange} strokeWidth="4" strokeLinecap="round" />
    <path d="M36 24l6-5M36 24l7 0M36 24l6 5M12 24l-5-5M12 24l-6 1M12 24l-5 6" stroke={C.orange} strokeWidth="1.6" strokeLinecap="round" />
  </>
)

const QM = [P([[16, 14], [24, 9], [32, 14], [31, 22], [26, 26], [26, 31], [21, 31], [21, 24], [26, 20], [26, 16], [22, 16], [21, 19], [16, 19]], 700, 0.5), E(23.5, 37, 3, 3, 701, 8)]
const question = <>{shape(QM[0], C.ink)}{shape(QM[1], C.ink)}</>

const CHECK = [P([[10, 25], [16, 19], [21, 25], [33, 11], [39, 17], [21, 37]], 710, 0.8)]
const check = shape(CHECK[0], C.felt)

const RULER = [P([[8, 30], [36, 10], [41, 17], [13, 37]], 720, 0.6)]
const ruler = <>{shape(RULER[0], C.yellow)}<path d="M15 26l3 4M20 22l2 3M25 19l3 4M30 15l2 3" stroke={C.ink} strokeWidth="1.3" /></>

// --- which motif for which answer ---------------------------------------------------
const ICONS: Record<string, ReactNode> = {
  'level:beginner': sprout,
  'level:intermediate': racket,
  'level:advanced': flame,
  'level:tournament': trophy,
  'playStyles:aggressive': burst,
  'playStyles:fastDoubles': bolt,
  'playStyles:control': target,
  'playStyles:defensive': shield,
  'playStyles:balanced': scale,
  'powerGeneration:needsHelp': wave,
  'powerGeneration:balanced': scale,
  'powerGeneration:ownPower': muscle,
  'priorities:easyPower': rocketShuttle,
  'priorities:hardAttack': burst,
  'priorities:fastDrives': bolt,
  'priorities:directPrecision': target,
  'priorities:shuttleGrip': gripShuttle,
  'priorities:netTechnical': net,
  'priorities:durability': spool,
  'priorities:comfort': cloud,
  'priorities:tensionRetention': hourglass,
  'priorities:sound': speaker,
  'hittingFeel:hardCrisp': hammer,
  'hittingFeel:mediumBalanced': scale,
  'hittingFeel:softComfortable': cloud,
  'hittingFeel:dontKnow': question,
  'frequency:occasionally': calendar(1),
  'frequency:oneTwoWeek': calendar(2),
  'frequency:threePlusWeek': calendar(4),
  'restringReason:wearFraying': fray,
  'restringReason:mishitBreakage': burst,
  'restringReason:tensionLoss': hourglass,
  'restringReason:rarelyBreak': check,
  'restringReason:notSure': question,
  'racketGoal:easyPower': wave,
  'racketGoal:balancedGoal': scale,
  'racketGoal:precision': target,
  'currentTensionKnown:yes': ruler,
  'currentTensionFeel:wantPower': wave,
  'currentTensionFeel:aboutRight': check,
  'currentTensionFeel:wantControl': target,
  'maxTensionKnown:yes': ruler,
  'currentTensionKnown:no': question,
  'currentTensionFeel:notSure': question,
  'maxTensionKnown:no': question,
}

/** The cut-paper icon for one quiz answer, or the given fallback (the old emoji) for anything unmapped. */
export default function QuizIcon({ questionId, optionId, fallback, className = 'w-11 h-11' }: { questionId: string; optionId: string; fallback?: ReactNode; className?: string }) {
  const motif = ICONS[`${questionId}:${optionId}`]
  if (!motif) return <>{fallback}</>
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d={DISC} fill={C.cream} />
      <path d={DISC} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      {motif}
    </svg>
  )
}
