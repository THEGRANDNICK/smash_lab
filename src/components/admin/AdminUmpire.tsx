import { cutEllipse, cutPolygon } from '../../logic/scissors'

// Cut once (seeded scissors, same hand as the stage on the start page).
const LEG_L = cutPolygon([[30, 78], [37, 78], [33, 136], [26, 136]], 1201, 0.8)
const LEG_R = cutPolygon([[83, 78], [90, 78], [94, 136], [87, 136]], 1202, 0.8)
const RUNG = (y: number, seed: number) => cutPolygon([[28, y], [91, y], [91, y + 4], [28, y + 4]], seed, 0.5)
const SEAT = cutPolygon([[24, 70], [96, 70], [96, 80], [24, 80]], 1203, 0.8)
const BACK = cutPolygon([[80, 34], [88, 34], [90, 72], [82, 72]], 1204, 0.7)
const LEG_PERSON = cutPolygon([[48, 72], [66, 72], [62, 100], [52, 100]], 1205, 0.8)
const SHOE = cutPolygon([[48, 98], [64, 98], [64, 104], [44, 104]], 1206, 0.6)
const BLAZER = cutPolygon([[46, 52], [74, 52], [72, 76], [48, 76]], 1207, 1)
const SHIRT = cutPolygon([[57, 52], [63, 52], [62, 64], [58, 64]], 1208, 0.4)
const HEAD = cutEllipse(58, 42, 10, 11, 1209, 12, 0.04)
const CAP = cutPolygon([[47, 36], [52, 30], [66, 30], [69, 36], [44, 38]], 1210, 0.6)
const UPPER_ARM = cutPolygon([[61, 56], [67, 56], [68, 72], [62, 72]], 1211, 0.5)
const FOREARM = cutPolygon([[62, 70], [68, 70], [67, 82], [62, 82]], 1212, 0.5)
const WHISTLE = cutPolygon([[61, 81], [69, 81], [69, 86], [61, 86]], 1213, 0.4)

/**
 * The admin's mascot: a paper umpire on his high chair who blows the whistle every few seconds —
 * same cut-out style (hand-cut shapes, brass split pins, stepped stop-motion) as the rally on the
 * start page. Decorative only; with "reduce motion" he just sits there.
 */
export default function AdminUmpire({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="16 22 92 118" className={className} aria-hidden="true">
      <g className="ump-boil">
        {/* the chair */}
        <path d={LEG_L} fill="#8a5a3c" />
        <path d={LEG_R} fill="#8a5a3c" />
        <path d={RUNG(96, 1220)} fill="#a8714a" />
        <path d={RUNG(114, 1221)} fill="#a8714a" />
        <path d={BACK} fill="#a8714a" />
        <path d={SEAT} fill="#a8714a" />
        {/* the umpire */}
        <path d={LEG_PERSON} fill="#26324a" />
        <path d={SHOE} fill="#2b2b2e" />
        <path d={BLAZER} fill="#26324a" />
        <path d={SHIRT} fill="#fbf7ee" />
        <g className="ump-head">
          <path d={HEAD} fill="#f1c7a0" />
          <circle cx="53" cy="41" r="1.4" fill="#4a2e22" />
          <path d={CAP} fill="#d5523b" />
        </g>
        {/* the whistle arm: turns at the shoulder pin and lifts the whistle to his mouth */}
        <g className="ump-arm">
          <path d={UPPER_ARM} fill="#26324a" />
          {/* the forearm bends at the elbow pin, so the whistle reaches his mouth */}
          <g className="ump-fore">
            <path d={FOREARM} fill="#f1c7a0" />
            <path d={WHISTLE} fill="#c9a227" />
          </g>
          <circle cx="65" cy="71" r="1.6" fill="#c9a227" stroke="rgba(0,0,0,.35)" strokeWidth=".5" />
        </g>
        <circle cx="64" cy="57" r="1.8" fill="#c9a227" stroke="rgba(0,0,0,.35)" strokeWidth=".5" />
        {/* the whistle blast: cut-paper strokes */}
        <g className="ump-tweet" stroke="#ffb830" strokeWidth="2.2" strokeLinecap="round">
          <path d="M43 44 L34 40" />
          <path d="M43 48 L33 49" />
          <path d="M44 52 L36 57" />
        </g>
      </g>
    </svg>
  )
}
