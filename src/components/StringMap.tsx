import { useMemo, useState } from 'react'
import type { StringItem, StringCategory } from '../data/strings'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { getSpecialistProfile } from '../data/stringSpecialistProfiles'
import { computeStringMapPosition } from '../logic/stringMapPosition'
import { computeLabelOffsets } from '../logic/stringMapLabelLayout'
import { RADAR_COMPARE_COLORS } from './performanceAxes'

interface StringMapProps {
  items: StringItem[]
  /** Defaults to the local stringSpecialistProfiles.ts lookup when omitted — pass the live, Supabase-merged map from useSpecialistProfiles(). */
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Which data source to plot the vertical (soft/hard) and horizontal (hold/repulsion) axes from — mirrors the quiz's manufacturer-only vs. manufacturer+specialist toggle. Purely a display choice; never affects recommendation scoring. */
  useSpecialistData?: boolean
  /**
   * Ordered ids to highlight, strongest first — e.g. [rank1Id, rank2Id,
   * rank3Id] on the recommendation page. Index 0 gets the strongest
   * highlight and a permanent label; indices 1/2 get a subtler highlight.
   * Omit entirely for a plain browsing map with no ranking context.
   */
  rankedIds?: string[]
  /** Ids currently selected for comparison — drawn with a ring matching their compare-chip color (same order/palette as the radar/table series). */
  selectedIds?: string[]
  /** True once the max comparison size is reached — unselected points become inert rather than clickable. */
  selectionFull?: boolean
  onToggleSelect?: (id: string) => void
  className?: string
}

const CATEGORY_COLOR: Record<StringCategory, { fill: string; dot: string; label: string }> = {
  repulsion: { fill: 'fill-shuttle-500', dot: 'bg-shuttle-500', label: 'Quick Repulsion' },
  control: { fill: 'fill-court-700 dark:fill-emerald-400', dot: 'bg-court-700 dark:bg-emerald-400', label: 'Control' },
  durability: { fill: 'fill-sky-600 dark:fill-sky-400', dot: 'bg-sky-600 dark:bg-sky-400', label: 'Durability' },
}

const VIEW = 440
const CENTER = 220
const CIRCLE_R = 150
const INNER_RING_R = CIRCLE_R * 0.55
const PLOT_HALF = 100
const AXIS_LABEL_R = CIRCLE_R + 22
/** Points always get a persistent label (not just on hover/focus) below this count — keeps a full ~20-string catalogue from turning into label soup while still reading clearly for a filtered/short list. */
const ALWAYS_LABEL_THRESHOLD = 10

function feelWord(softHard: number): string {
  return softHard < 0.34 ? 'soft feel' : softHard > 0.66 ? 'hard feel' : 'medium feel'
}

function holdWord(holdRepulsion: number): string {
  return holdRepulsion < 0.34 ? 'maximum hold' : holdRepulsion > 0.66 ? 'quick repulsion' : 'balanced hold and repulsion'
}

function describePosition(holdRepulsion: number, softHard: number): string {
  return `${holdWord(holdRepulsion)}, ${feelWord(softHard)}`
}

/**
 * A 2D "feel map" — horizontal axis Maximum Hold ↔ Quick Repulsion,
 * vertical axis Soft Feel ↔ Hard Feel — drawn inside a circular frame with
 * axis lines through the center and a subtle inner reference ring. A
 * genuine two-axis Cartesian scatter, never a radar chart. Positions come
 * entirely from computeStringMapPosition() (real manufacturer/specialist
 * data fields, never a hardcoded per-string coordinate) — intentionally
 * directional, not a precise measurement. Label collisions are resolved
 * by computeLabelOffsets(), which only ever moves where a label is
 * drawn, never the underlying coordinate a leader line always points
 * back to.
 */
export default function StringMap({ items, specialistProfiles, useSpecialistData = true, rankedIds = [], selectedIds = [], selectionFull = false, onToggleSelect, className = '' }: StringMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // Closed by default everywhere — the map itself is the summary; the list is one tap away.
  const [showList, setShowList] = useState(false)

  const points = useMemo(
    () =>
      items.map((item) => {
        const profile = specialistProfiles ? specialistProfiles[item.id] : getSpecialistProfile(item.id)
        const position = computeStringMapPosition(item, profile, useSpecialistData)
        const x = CENTER + (position.holdRepulsion - 0.5) * 2 * PLOT_HALF
        const y = CENTER - (position.softHard - 0.5) * 2 * PLOT_HALF
        return { item, position, x, y }
      }),
    [items, specialistProfiles, useSpecialistData],
  )

  const labelOffsets = useMemo(() => computeLabelOffsets(points.map((p) => ({ id: p.item.id, x: p.x, y: p.y }))), [points])

  const active = points.find((p) => p.item.id === activeId)
  const usedCategories = useMemo(() => new Set(items.map((i) => i.category)), [items])
  const alwaysLabel = items.length <= ALWAYS_LABEL_THRESHOLD

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} role="group" aria-label="String feel map: horizontal axis maximum hold to quick repulsion, vertical axis soft feel to hard feel" className="w-full h-auto">
        <circle cx={CENTER} cy={CENTER} r={CIRCLE_R} className="fill-none stroke-court-900/15 dark:stroke-white/15" />
        <circle cx={CENTER} cy={CENTER} r={INNER_RING_R} className="fill-none stroke-court-900/10 dark:stroke-white/10" strokeDasharray="2 4" />
        <line x1={CENTER - CIRCLE_R} y1={CENTER} x2={CENTER + CIRCLE_R} y2={CENTER} className="stroke-court-900/15 dark:stroke-white/15" />
        <line x1={CENTER} y1={CENTER - CIRCLE_R} x2={CENTER} y2={CENTER + CIRCLE_R} className="stroke-court-900/15 dark:stroke-white/15" />

        <text x={CENTER} y={CENTER - AXIS_LABEL_R} textAnchor="middle" className="fill-ink-700/70 dark:fill-shuttle-100/70 text-[11px] font-semibold uppercase tracking-wide">
          Hard feel
        </text>
        <text x={CENTER} y={CENTER + AXIS_LABEL_R + 6} textAnchor="middle" className="fill-ink-700/70 dark:fill-shuttle-100/70 text-[11px] font-semibold uppercase tracking-wide">
          Soft feel
        </text>
        <text x={CENTER - AXIS_LABEL_R} y={CENTER + 3} textAnchor="middle" className="fill-ink-700/70 dark:fill-shuttle-100/70 text-[11px] font-semibold uppercase tracking-wide">
          Maximum hold
        </text>
        <text x={CENTER + AXIS_LABEL_R} y={CENTER + 3} textAnchor="middle" className="fill-ink-700/70 dark:fill-shuttle-100/70 text-[11px] font-semibold uppercase tracking-wide">
          Quick repulsion
        </text>

        {points.map(({ item, x, y, position }) => {
          const rankIndex = rankedIds.indexOf(item.id)
          const isRanked = rankIndex !== -1
          const isTopRank = rankIndex === 0
          const selectedIndex = selectedIds.indexOf(item.id)
          const isSelected = selectedIndex !== -1
          const isDisabled = onToggleSelect != null && !isSelected && selectionFull
          const isActive = activeId === item.id
          const showLabel = isRanked || isSelected || isActive || alwaysLabel

          const radius = isTopRank ? 9 : isRanked ? 7.5 : isSelected ? 7 : 5
          const categoryColor = CATEGORY_COLOR[item.category]
          const ringClass = isSelected ? (RADAR_COMPARE_COLORS[selectedIndex]?.strokeClassName ?? 'stroke-shuttle-500') : isRanked ? 'stroke-ink-900 dark:stroke-shuttle-50' : ''
          const ringWidth = isTopRank ? 3 : isRanked || isSelected ? 2 : 0

          const offset = labelOffsets.get(item.id) ?? { labelDx: 0, labelDy: -10, hasLeader: false }
          const labelX = x + offset.labelDx
          const labelY = y + offset.labelDy

          const label = `${item.brand} ${item.name}, ${categoryColor.label}: ${describePosition(position.holdRepulsion, position.softHard)}${isTopRank ? ', top recommendation' : isRanked ? ', recommended alternative' : ''}${
            isSelected ? ', selected for comparison' : ''
          }`

          return (
            <g key={item.id}>
              {offset.hasLeader && (showLabel || isActive) && <line x1={x} y1={y} x2={labelX} y2={labelY} className="stroke-court-900/15 dark:stroke-white/15" strokeWidth={0.75} />}
              {isActive && <circle cx={x} cy={y} r={radius + 5} className="fill-court-900/10 dark:fill-white/10" />}
              <circle
                cx={x}
                cy={y}
                r={radius}
                tabIndex={isDisabled ? -1 : 0}
                role={onToggleSelect ? 'button' : 'img'}
                aria-label={label}
                aria-pressed={onToggleSelect ? isSelected : undefined}
                className={`cursor-pointer transition-colors ${categoryColor.fill} ${ringClass} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''} focus-visible:stroke-shuttle-500`}
                style={{ strokeWidth: ringWidth || undefined }}
                onMouseEnter={() => setActiveId(item.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === item.id ? null : cur))}
                onFocus={() => setActiveId(item.id)}
                onBlur={() => setActiveId((cur) => (cur === item.id ? null : cur))}
                onClick={() => !isDisabled && onToggleSelect?.(item.id)}
                onKeyDown={(e) => {
                  if (isDisabled) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleSelect?.(item.id)
                  }
                }}
              />
              {showLabel && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  className={`${isTopRank ? 'text-[10px]' : 'text-[8px]'} uppercase tracking-wide pointer-events-none ${isTopRank ? 'fill-ink-900 dark:fill-shuttle-50 font-bold' : 'fill-ink-700/70 dark:fill-shuttle-100/70 font-semibold'}`}
                >
                  {item.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2" aria-hidden="true">
        {(['repulsion', 'control', 'durability'] as StringCategory[])
          .filter((c) => usedCategories.has(c))
          .map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/60">
              <span className={`w-2 h-2 rounded-full ${CATEGORY_COLOR[c].dot}`} />
              {CATEGORY_COLOR[c].label}
            </span>
          ))}
      </div>

      {active && (
        <p className="mt-2 text-center text-[11px] text-ink-700/70 dark:text-shuttle-100/60">
          {active.item.brand} {active.item.name} — {CATEGORY_COLOR[active.item.category].label} — {describePosition(active.position.holdRepulsion, active.position.softHard)}
          {onToggleSelect && <> · {selectedIds.includes(active.item.id) ? 'selected for comparison' : 'click to add to comparison'}</>}
        </p>
      )}
      <p className="mt-1 text-center text-xs text-ink-700/70 dark:text-shuttle-100/50">Positions are directional estimates, not a precise measurement.</p>

      <details className="mt-3" open={showList} onToggle={(e) => setShowList((e.target as HTMLDetailsElement).open)}>
        <summary className="focus-ring cursor-pointer select-none text-xs font-semibold text-shuttle-700 dark:text-shuttle-400 hover:underline">{showList ? 'Hide list view' : 'Show as a list'}</summary>
        <ul className="mt-2 divide-y divide-court-900/10 dark:divide-white/10 border-2 border-court-900/10 dark:border-white/10 rounded-xl text-sm">
          {points.map(({ item, position }) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold text-ink-900 dark:text-shuttle-50">
                  {item.brand} {item.name}
                </span>
                <span className="block text-xs text-ink-700/70 dark:text-shuttle-100/50">
                  {CATEGORY_COLOR[item.category].label} · {describePosition(position.holdRepulsion, position.softHard)}
                </span>
              </span>
              {onToggleSelect && (
                <button
                  type="button"
                  onClick={() => onToggleSelect(item.id)}
                  disabled={!selectedIds.includes(item.id) && selectionFull}
                  aria-pressed={selectedIds.includes(item.id)}
                  className={`focus-ring shrink-0 rounded-full border-2 text-xs font-semibold px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    selectedIds.includes(item.id) ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
                  }`}
                >
                  {selectedIds.includes(item.id) ? 'Comparing' : '+ Compare'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
