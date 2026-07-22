import { PERFORMANCE_AXES, PERFORMANCE_MAX, type PerformanceDimension } from './performanceAxes'

export interface RadarSeries {
  id: string
  label: string
  values: Record<PerformanceDimension, number | null>
  /** Tailwind classes for the polygon stroke, e.g. "stroke-court-700 dark:stroke-shuttle-400". */
  strokeClassName: string
  /** Tailwind classes for the polygon fill, e.g. "fill-court-700/20 dark:fill-shuttle-400/25". */
  fillClassName: string
}

const AXIS_COUNT = PERFORMANCE_AXES.length
const ANGLE_STEP = (2 * Math.PI) / AXIS_COUNT
const START_ANGLE = -Math.PI / 2 // first axis points straight up, like Yonex's own string-comparison charts

function pointAt(index: number, ratio: number, center: number, radius: number) {
  const angle = START_ANGLE + index * ANGLE_STEP
  return {
    x: center + Math.cos(angle) * radius * ratio,
    y: center + Math.sin(angle) * radius * ratio,
  }
}

function polygonPoints(values: Record<PerformanceDimension, number | null>, center: number, radius: number): string {
  return PERFORMANCE_AXES.map((axis, i) => {
    const raw = values[axis.key]
    const ratio = raw == null ? 0 : Math.max(0, Math.min(1, raw / PERFORMANCE_MAX))
    const { x, y } = pointAt(i, ratio, center, radius)
    return `${x},${y}`
  }).join(' ')
}

function labelAnchor(index: number): { anchor: 'start' | 'middle' | 'end'; dy: number } {
  const angle = START_ANGLE + index * ANGLE_STEP
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
  const dy = sin > 0.3 ? 12 : sin < -0.3 ? -4 : 4
  return { anchor, dy }
}

function describeSeries(series: RadarSeries): string {
  const parts = PERFORMANCE_AXES.map((axis) => {
    const v = series.values[axis.key]
    return `${axis.label} ${v == null ? 'unknown' : `${v} out of ${PERFORMANCE_MAX}`}`
  })
  return `${series.label}: ${parts.join(', ')}`
}

interface RadarChartProps {
  series: RadarSeries[]
  size?: number
  /** Show exact numeric values at each vertex — only sensible with a single series. */
  showValues?: boolean
}

export default function RadarChart({ series, size = 220, showValues = false }: RadarChartProps) {
  const padding = size * 0.24
  const center = size / 2
  const radius = size / 2 - padding
  const rings = [0.25, 0.5, 0.75, 1]

  const ariaLabel = series.length === 1 ? describeSeries(series[0]) : `Radar comparison of ${series.length} strings: ${series.map(describeSeries).join('. ')}`

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[260px] mx-auto" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>

        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={PERFORMANCE_AXES.map((_, i) => {
              const { x, y } = pointAt(i, r, center, radius)
              return `${x},${y}`
            }).join(' ')}
            fill="none"
            className="stroke-court-900/10 dark:stroke-white/10"
            strokeWidth={1}
          />
        ))}

        {/* Spokes */}
        {PERFORMANCE_AXES.map((axis, i) => {
          const { x, y } = pointAt(i, 1, center, radius)
          return <line key={axis.key} x1={center} y1={center} x2={x} y2={y} className="stroke-court-900/10 dark:stroke-white/10" strokeWidth={1} />
        })}

        {/* Data polygons, drawn after the grid so they sit on top */}
        {series.map((s) => (
          <polygon
            key={s.id}
            points={polygonPoints(s.values, center, radius)}
            className={`${s.strokeClassName} ${s.fillClassName}`}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}

        {/* Axis labels — kept short and close to the ring so they never overflow the viewBox */}
        {PERFORMANCE_AXES.map((axis, i) => {
          const { x, y } = pointAt(i, 1.1, center, radius)
          const { anchor, dy } = labelAnchor(i)
          return (
            <text
              key={axis.key}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              className="fill-ink-700/70 dark:fill-shuttle-100/70 text-[9px] font-medium"
              aria-hidden="true"
            >
              {axis.emoji} {axis.shortLabel}
            </text>
          )
        })}

        {/* Optional exact values, single-series only, to match the precision Bars view offers */}
        {showValues &&
          series.length === 1 &&
          PERFORMANCE_AXES.map((axis, i) => {
            const raw = series[0].values[axis.key]
            if (raw == null) return null
            const ratio = Math.max(0, Math.min(1, raw / PERFORMANCE_MAX))
            const { x, y } = pointAt(i, ratio, center, radius)
            return (
              <text key={axis.key} x={x} y={y - 6} textAnchor="middle" className="fill-ink-900 dark:fill-shuttle-50 text-[9px] font-semibold" aria-hidden="true">
                {raw}
              </text>
            )
          })}
      </svg>

      {/* Redundant accessible text for screen readers / non-visual contexts */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}
