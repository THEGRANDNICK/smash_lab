import { SHELF_COLOR, type RacketBalance, type ShelfId } from '../logic/setupStats'


interface WorkshopRacketProps {
  balance: RacketBalance
  /** String gauge in mm — thicker strings are drawn thicker. */
  gauge: number
  shelf: ShelfId
  tensionKg: number
  /** Changes when a different string is chosen: the bed is re-strung (stop-motion frames). */
  stringKey: string
  className?: string
}

const BALANCE_PIN_Y: Record<RacketBalance, number> = { headHeavy: 118, standard: 146, even: 146, headLight: 170 }
const FRAME_WIDTH: Record<RacketBalance, number> = { headHeavy: 9, standard: 6, even: 6, headLight: 4.5 }

/**
 * The workshop's paper racket. Racket balance moves the brass balance pin along the shaft and makes
 * the frame heavier or lighter; a new string re-strings the bed (line thickness from the gauge,
 * colour from the shelf); tension grows or shrinks the sweet spot and lets loose strings sag a little.
 * Everything animates with transforms (works in every browser) in stepped, stop-motion frames.
 */
export default function WorkshopRacket({ balance, gauge, shelf, tensionKg, stringKey, className = '' }: WorkshopRacketProps) {
  const t = Math.max(0, Math.min(1, (tensionKg - 8) / 5))
  const sweet = 0.78 - t * 0.48
  const sag = 5 * (1 - t)
  const stroke = Math.max(0.8, Math.min(2.2, 0.8 + (gauge - 0.6) * 12))
  const color = SHELF_COLOR[shelf]
  const pinY = BALANCE_PIN_Y[balance]

  return (
    <svg viewBox="0 0 140 236" className={className} role="img" aria-label={`Racket: ${balance === 'standard' ? 'standard' : balance} balance, strung at ${tensionKg} kilograms`}>
      <defs>
        <clipPath id="ws-head">
          <ellipse cx="70" cy="76" rx="42" ry="54" />
        </clipPath>
        <radialGradient id="ws-sweet">
          <stop offset="0%" stopColor="#ffcf33" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffcf33" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* string bed */}
      <ellipse cx="70" cy="76" rx="44" ry="56" fill="#fff8ea" />
      <g className="ws-sweet" style={{ transform: `scale(${sweet})` }}>
        <ellipse cx="70" cy="76" rx="44" ry="56" fill="url(#ws-sweet)" />
      </g>
      <g key={stringKey} clipPath="url(#ws-head)" className="ws-restring" stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round">
        {[-35, -25, -15, -5, 5, 15, 25, 35].map((dx) => (
          <path key={`m${dx}`} d={`M${70 + dx} 18 Q ${70 + dx + sag} 76 ${70 + dx} 134`} />
        ))}
        {[30, 42, 54, 66, 78, 90, 102, 114, 126].map((y) => (
          <path key={`c${y}`} d={`M22 ${y} Q 70 ${y + sag} 118 ${y}`} />
        ))}
      </g>

      {/* frame — heavier for head-heavy, slimmer for head-light */}
      <ellipse cx="70" cy="76" rx="44" ry="56" fill="none" stroke="#d5523b" className="ws-frame" style={{ strokeWidth: FRAME_WIDTH[balance] }} />
      <g className="ws-fade" style={{ opacity: balance === 'headHeavy' ? 1 : 0 }}>
        <path d="M52 22 Q 70 15 88 22" stroke="#2b2b2e" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>

      {/* throat, shaft, handle */}
      <path d="M58 128 L70 146 L82 128" fill="none" stroke="#d5523b" strokeWidth="5" strokeLinejoin="round" />
      <rect x="67" y="144" width="6" height="40" fill="#2b2b2e" />
      <rect x="61" y="182" width="18" height="50" rx="4" fill="#2b2b2e" className="ws-grip" style={{ transform: balance === 'headLight' ? 'scaleX(1.18)' : 'scaleX(1)' }} />

      {/* the balance point: a brass split pin that slides along the shaft */}
      <g className="ws-pin" style={{ transform: `translateY(${pinY}px)` }}>
        <circle cx="70" cy="0" r="5" fill="#c9a227" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
        <path d="M80 0 H 94" stroke="#c9a227" strokeWidth="1.5" />
        <text x="96" y="3" fontSize="8" fontWeight="700" className="fill-ink-700 dark:fill-shuttle-100">
          balance
        </text>
      </g>
    </svg>
  )
}
