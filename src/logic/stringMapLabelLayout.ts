// Phase 14 refinement — deterministic label-collision handling for the
// String Map. This ONLY ever nudges where a point's TEXT LABEL is drawn;
// the point's own real coordinate (from stringMapPosition.ts) is never
// touched. Two points that land close together keep their true positions
// and get a short leader line to a label offset just far enough apart to
// stay readable.
//
// Deterministic by construction: clustering is order-independent (ids are
// sorted first) and every offset is a pure function of cluster membership
// and index — the same input set always produces the same layout.

export interface LabelLayoutPoint {
  id: string
  x: number
  y: number
}

export interface LabelLayoutResult {
  labelDx: number
  labelDy: number
  hasLeader: boolean
}

/** Points within this distance (same units as x/y) are considered "colliding" and get spread apart. */
export const CLUSTER_RADIUS = 14
/** How far apart clustered labels are spread, per member. */
const LABEL_SPREAD_STEP = 12
/** Default label offset for an isolated point (just above its marker). */
const ISOLATED_LABEL_DY = -10

function distance(a: LabelLayoutPoint, b: LabelLayoutPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Single-linkage grouping of points within CLUSTER_RADIUS of any other member already in the group — simple and deterministic, appropriate for the catalog's size (tens, not thousands, of points). */
function buildClusters(points: LabelLayoutPoint[]): LabelLayoutPoint[][] {
  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id))
  const assigned = new Set<string>()
  const clusters: LabelLayoutPoint[][] = []

  for (const seed of sorted) {
    if (assigned.has(seed.id)) continue
    const cluster: LabelLayoutPoint[] = [seed]
    assigned.add(seed.id)

    // Grow the cluster until no more unassigned points are within range of any current member.
    let grew = true
    while (grew) {
      grew = false
      for (const candidate of sorted) {
        if (assigned.has(candidate.id)) continue
        if (cluster.some((member) => distance(member, candidate) <= CLUSTER_RADIUS)) {
          cluster.push(candidate)
          assigned.add(candidate.id)
          grew = true
        }
      }
    }
    clusters.push(cluster)
  }

  return clusters
}

/**
 * Computes a label offset (and whether a leader line should connect it back
 * to the real marker) for every point, keyed by id. Isolated points get a
 * small fixed offset just above their marker with no leader line; points
 * sharing a cluster are spread in a small deterministic ring around their
 * shared area, each with a leader line back to its own true coordinate.
 */
export function computeLabelOffsets(points: LabelLayoutPoint[]): Map<string, LabelLayoutResult> {
  const result = new Map<string, LabelLayoutResult>()
  const clusters = buildClusters(points)

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      result.set(cluster[0].id, { labelDx: 0, labelDy: ISOLATED_LABEL_DY, hasLeader: false })
      continue
    }
    // Deterministic order within the cluster: already sorted by id via buildClusters' seed order,
    // but re-sort explicitly here so this function's output never depends on cluster-growth order.
    const ordered = [...cluster].sort((a, b) => a.id.localeCompare(b.id))
    ordered.forEach((p, i) => {
      const angle = (i / ordered.length) * 2 * Math.PI - Math.PI / 2
      const radius = LABEL_SPREAD_STEP * (1 + Math.floor(i / 6))
      result.set(p.id, { labelDx: Math.cos(angle) * radius, labelDy: Math.sin(angle) * radius, hasLeader: true })
    })
  }

  return result
}
