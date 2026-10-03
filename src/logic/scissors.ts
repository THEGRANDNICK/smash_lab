// "Scissors" for the cut-out scene: turns ideal shapes into outlines that look hand-cut from card.
//
// Real scissors can't cut a perfect curve — a round shape becomes many short, straight snips, each
// a little off. These helpers do exactly that, with a seeded random generator so a shape is cut the
// same way on every load (no flicker between visits, stable server/client output).

type Point = [number, number]

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const fmt = (n: number) => Math.round(n * 10) / 10

function toPath(points: Point[]): string {
  return `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`
}

/** An ellipse cut as `snips` short straight cuts, each corner nudged by up to `rough` (fraction of the radius). */
export function cutEllipse(cx: number, cy: number, rx: number, ry: number, seed: number, snips = 16, rough = 0.05): string {
  const r = rng(seed)
  const pts: Point[] = []
  const start = r() * Math.PI * 2
  for (let i = 0; i < snips; i++) {
    const a = start + (i / snips) * Math.PI * 2 + (r() - 0.5) * (Math.PI / snips) * 0.6
    const k = 1 + (r() - 0.5) * 2 * rough
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return toPath(pts)
}

/**
 * A polygon cut by hand: each straight side gets a slight wobble (an extra snip somewhere along it)
 * and every corner is nudged by up to `rough` units.
 */
export function cutPolygon(points: Point[], seed: number, rough = 2): string {
  const r = rng(seed)
  const out: Point[] = []
  points.forEach(([x, y], i) => {
    out.push([x + (r() - 0.5) * 2 * rough, y + (r() - 0.5) * 2 * rough])
    const [nx, ny] = points[(i + 1) % points.length]
    const len = Math.hypot(nx - x, ny - y)
    if (len > rough * 18) {
      const t = 0.35 + r() * 0.3
      out.push([x + (nx - x) * t + (r() - 0.5) * rough * 1.6, y + (ny - y) * t + (r() - 0.5) * rough * 1.6])
    }
  })
  return toPath(out)
}

/**
 * A hill/cloud silhouette from left to right: a row of bumps along `baseY`, closed down to `bottom`.
 * Each bump is a handful of straight snips.
 */
export function cutHills(fromX: number, toX: number, baseY: number, bottom: number, bumps: { x: number; w: number; h: number }[], seed: number): string {
  const r = rng(seed)
  const pts: Point[] = [[fromX, bottom], [fromX, baseY]]
  for (const b of bumps) {
    const steps = 7
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = b.x - b.w / 2 + t * b.w
      const y = baseY - Math.sin(t * Math.PI) * b.h
      pts.push([x + (r() - 0.5) * 6, y + (r() - 0.5) * 6])
    }
  }
  pts.push([toX, baseY], [toX, bottom])
  return toPath(pts)
}
