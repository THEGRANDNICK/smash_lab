import { cutEllipse, cutHills, cutPolygon } from '../logic/scissors'

/**
 * A cut-out animation stage behind the site (think stop-motion with card and split pins):
 * - every shape is hand-cut (straight scissor snips, light cut edge, hard shadow on the layer below);
 * - two paper players are jointed puppets — shoulder, elbow and wrist held by brass split pins —
 *   playing a rally: a smash over the net, a high clear back;
 * - all movement is stepped, about 10 frames a second, and each layer "boils" (tiny frame-to-frame
 *   jitter) because no hand ever lays a piece down exactly the same twice.
 * All layers share one viewBox, so they always line up. Decorative only (aria-hidden). With
 * "reduce motion" everything stands still.
 */

const VB = '0 0 1440 900'

// Pre-cut shapes (computed once at module load — the seeds keep them identical on every visit).
const HILLS_FAR = cutHills(-60, 1500, 520, 900, [
  { x: 110, w: 360, h: 150 },
  { x: 430, w: 380, h: 120 },
  { x: 760, w: 420, h: 175 },
  { x: 1090, w: 380, h: 130 },
  { x: 1390, w: 360, h: 160 },
], 11)
const HILLS_NEAR = cutHills(-60, 1500, 600, 900, [
  { x: 200, w: 520, h: 110 },
  { x: 700, w: 560, h: 80 },
  { x: 1240, w: 560, h: 120 },
], 23)
const SUN = cutEllipse(1180, 150, 62, 62, 5, 18, 0.04)
const CLOUD_A = cutHills(180, 470, 210, 236, [{ x: 250, w: 120, h: 44 }, { x: 330, w: 130, h: 62 }, { x: 410, w: 110, h: 38 }], 41)
const CLOUD_B = cutHills(860, 1080, 120, 142, [{ x: 920, w: 100, h: 34 }, { x: 990, w: 120, h: 50 }, { x: 1050, w: 70, h: 26 }], 43)
const COURT = cutPolygon([[380, 600], [1060, 600], [1330, 900], [110, 900]], 7, 3)
const LINES = [
  cutPolygon([[400, 606], [1040, 606], [1043, 613], [397, 613]], 71, 0.8),
  cutPolygon([[400, 606], [408, 606], [176, 900], [160, 900]], 72, 0.8),
  cutPolygon([[1040, 606], [1032, 606], [1264, 900], [1280, 900]], 73, 0.8),
  cutPolygon([[716, 613], [724, 613], [728, 900], [712, 900]], 74, 0.8),
  cutPolygon([[352, 700], [1088, 700], [1094, 709], [346, 709]], 75, 0.8),
]
const NET = cutPolygon([[350, 642], [1090, 642], [1090, 694], [350, 694]], 8, 1.2)
const NET_TAPE = cutPolygon([[350, 636], [1090, 636], [1090, 645], [350, 645]], 9, 0.8)
const SHUTTLE_SKIRT = cutPolygon([[-7, 9], [-17, -20], [17, -20], [7, 9]], 61, 0.8)
const SHUTTLE_CORK = cutEllipse(0, 12, 7, 6, 62, 9, 0.05)

export default function PaperScene() {
  return (
    <div className="cut-stage" aria-hidden="true">
      {/* layer 0 — the backdrop card, with paper grain (static, never animated) */}
      <svg className="cut-layer" viewBox={VB} preserveAspectRatio="xMidYMax slice">
        <defs>
          <filter id="cut-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.15" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0" result="g" />
            <feComposite in="g" in2="SourceGraphic" operator="in" result="gs" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="gs" />
            </feMerge>
          </filter>
          {/* hard shadow: card lying on card, no blur */}
          <filter id="cut-shadow" x="-5%" y="-5%" width="115%" height="120%">
            <feDropShadow dx="4" dy="5" stdDeviation="0" floodColor="#0b3d2e" floodOpacity="0.2" />
          </filter>
          <pattern id="cut-net" width="11" height="11" patternUnits="userSpaceOnUse">
            <path d="M0 0L11 11M11 0L0 11" className="cut-net-mesh" />
          </pattern>
        </defs>
        <rect width="1440" height="900" className="cut-wall" filter="url(#cut-grain)" />
      </svg>

      {/* layer 1 — sky pieces and far hills */}
      <svg className="cut-layer cut-boil cut-boil-a" viewBox={VB} preserveAspectRatio="xMidYMax slice">
        <g filter="url(#cut-shadow)" className="cut-edge">
          <path d={SUN} className="cut-sun" />
          <path d={CLOUD_A} className="cut-cloud" />
          <path d={CLOUD_B} className="cut-cloud" />
          <path d={HILLS_FAR} className="cut-hill-far" />
        </g>
      </svg>

      {/* layer 2 — near hills, the court, the far player, the net */}
      <svg className="cut-layer cut-boil cut-boil-b" viewBox={VB} preserveAspectRatio="xMidYMax slice">
        <g filter="url(#cut-shadow)" className="cut-edge">
          <path d={HILLS_NEAR} className="cut-hill-near" />
          <path d={COURT} className="cut-court" />
        </g>
        <g className="cut-line">
          {LINES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <Puppet x={900} y={628} scale={0.55} flip seedBase={300} shirt="cut-shirt-b" armClass="cut-arm-far" foreClass="cut-fore-far" />
        <g filter="url(#cut-shadow)">
          <rect x="342" y="630" width="12" height="120" className="cut-post" />
          <rect x="1086" y="630" width="12" height="120" className="cut-post" />
          <path d={NET} fill="url(#cut-net)" className="cut-net" />
          <path d={NET_TAPE} className="cut-net-tape" />
        </g>
      </svg>

      {/* layer 3 — the near player and the shuttle in flight */}
      <svg className="cut-layer cut-boil cut-boil-c" viewBox={VB} preserveAspectRatio="xMidYMax slice">
        <Puppet x={680} y={838} scale={1} seedBase={100} shirt="cut-shirt-a" armClass="cut-arm-near" foreClass="cut-fore-near" />
        <g className="cut-shuttle">
          <g filter="url(#cut-shadow)" className="cut-edge cut-shuttle-tilt">
            <path d={SHUTTLE_SKIRT} className="cut-feathers" />
            <path d="M-11 -6 L11 -6 M-4 9 L-10 -20 M4 9 L10 -20" className="cut-feather-line" />
            <path d={SHUTTLE_CORK} className="cut-cork" />
          </g>
        </g>
      </svg>
    </div>
  )
}

interface PuppetProps {
  x: number
  y: number
  scale: number
  flip?: boolean
  seedBase: number
  shirt: string
  armClass: string
  foreClass: string
}

/** A jointed paper player: each part cut separately, held together by brass split pins. */
function Puppet({ x, y, scale, flip = false, seedBase: s, shirt, armClass, foreClass }: PuppetProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <g className="cut-bob">
        <g filter="url(#cut-shadow)" className="cut-edge">
          {/* legs + shoes */}
          <path d={cutPolygon([[-22, -96], [-6, -96], [-12, -8], [-30, -8]], s + 1, 1.5)} className="cut-shorts" />
          <path d={cutPolygon([[6, -96], [22, -96], [32, -8], [14, -8]], s + 2, 1.5)} className="cut-shorts" />
          <path d={cutPolygon([[-34, -12], [-8, -12], [-6, 0], [-40, 0]], s + 3, 1)} className="cut-shoe" />
          <path d={cutPolygon([[12, -12], [36, -12], [42, 0], [10, 0]], s + 4, 1)} className="cut-shoe" />
          {/* torso */}
          <path d={cutPolygon([[-30, -178], [30, -178], [26, -92], [-26, -92]], s + 5, 2)} className={shirt} />
          {/* back arm (balance) */}
          <path d={cutPolygon([[-30, -172], [-18, -172], [-46, -120], [-58, -126]], s + 6, 1.2)} className="cut-skin" />
          {/* head */}
          <path d={cutEllipse(2, -206, 25, 27, s + 7, 14, 0.04)} className="cut-skin" />
          <path d={cutPolygon([[-24, -216], [-8, -238], [22, -236], [28, -214], [12, -224], [-6, -220]], s + 8, 1.5)} className="cut-hair" />
        </g>
        <circle cx="12" cy="-208" r="2.6" className="cut-eye" />

        {/* racket arm: the upper arm swings at the shoulder pin, forearm + racket at the elbow pin */}
        <g className={armClass}>
          <path d={cutPolygon([[18, -176], [32, -176], [30, -116], [16, -116]], s + 9, 1)} className="cut-skin cut-edge" filter="url(#cut-shadow)" />
          <g className={foreClass}>
            <path d={cutPolygon([[16, -122], [30, -122], [28, -68], [16, -68]], s + 10, 1)} className="cut-skin cut-edge" filter="url(#cut-shadow)" />
            <g filter="url(#cut-shadow)">
              <path d={cutPolygon([[19, -74], [25, -74], [25, -10], [19, -10]], s + 11, 0.6)} className="cut-handle" />
              <path d={cutEllipse(22, 26, 26, 34, s + 12, 14, 0.04)} className="cut-frame cut-edge" />
              <path d={cutEllipse(22, 26, 19, 27, s + 13, 12, 0.03)} className="cut-strings" />
            </g>
            <circle cx="22" cy="-70" r="3.2" className="cut-pin" />
          </g>
          <circle cx="23" cy="-120" r="3.4" className="cut-pin" />
        </g>
        <circle cx="25" cy="-171" r="3.6" className="cut-pin" />
        <circle cx="-24" cy="-168" r="3" className="cut-pin" />
      </g>
    </g>
  )
}
