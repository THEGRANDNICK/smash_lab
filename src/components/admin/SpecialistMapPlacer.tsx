import { useMemo, useRef, useState } from 'react'
import type { StringCategory } from '../../data/strings'
import type { SpecialistDimensionKey } from '../../data/stringSpecialistProfiles'
import { useStringPool } from '../../hooks/useStringPool'
import { useSpecialistProfiles } from '../../hooks/useSpecialistProfiles'
import { computeStringMapPosition } from '../../logic/stringMapPosition'
import { computeLabelOffsets } from '../../logic/stringMapLabelLayout'
import { deriveDimensions, type MapPlacement, type MishitBehaviour } from '../../logic/mapPlacement'
import { DIMENSION_OPTIONS } from '../../services/specialistAdminService'

interface SpecialistMapPlacerProps {
  stringId: string
  value: MapPlacement | null
  onChange: (next: MapPlacement | null) => void
  /** Dimensions the stringer typed by hand — shown as "overrides map" in the preview. */
  manualDimensions: Partial<Record<SpecialistDimensionKey, string>>
  disabled?: boolean
}

// Same geometry as the public StringMap, so a pin lands exactly where players will see it.
const VIEW = 440
const CENTER = 220
const CIRCLE_R = 150
const PLOT_HALF = 100
const AXIS_LABEL_R = CIRCLE_R + 22
const KEY_STEP = 0.02

const DOT_FILL: Record<StringCategory, string> = {
  repulsion: 'fill-shuttle-500',
  control: 'fill-court-700 dark:fill-shuttle-400',
  durability: 'fill-sky-600 dark:fill-sky-400',
}

const DURABILITY_STEPS: { value: number; label: string }[] = [
  { value: 1, label: 'Fragile' },
  { value: 2, label: 'Below avg' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Tough' },
  { value: 5, label: 'Bomb-proof' },
]

const MISHIT_STEPS: { value: MishitBehaviour; label: string }[] = [
  { value: 'sensitive', label: 'Snaps easily' },
  { value: 'normal', label: 'Normal' },
  { value: 'robust', label: 'Survives mishits' },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const toSvg = (holdRepulsion: number, softHard: number) => ({
  x: CENTER + (holdRepulsion - 0.5) * 2 * PLOT_HALF,
  y: CENTER - (softHard - 0.5) * 2 * PLOT_HALF,
})

export default function SpecialistMapPlacer({ stringId, value, onChange, manualDimensions, disabled = false }: SpecialistMapPlacerProps) {
  const pool = useStringPool()
  const profiles = useSpecialistProfiles()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [showNames, setShowNames] = useState(true)

  const self = pool.find((s) => s.id === stringId)

  const others = useMemo(
    () =>
      pool
        .filter((s) => s.id !== stringId)
        .map((item) => {
          const pos = computeStringMapPosition(item, profiles[item.id], true)
          return { item, ...toSvg(pos.holdRepulsion, pos.softHard) }
        }),
    [pool, profiles, stringId],
  )

  const labelOffsets = useMemo(() => computeLabelOffsets(others.map((o) => ({ id: o.item.id, x: o.x, y: o.y }))), [others])

  // Where the string currently lands on the public map — a starting hint before the first placement.
  const autoPosition = useMemo(() => {
    if (!self) return null
    const pos = computeStringMapPosition(self, profiles[stringId], true)
    return toSvg(pos.holdRepulsion, pos.softHard)
  }, [self, profiles, stringId])

  const pin = value ? toSvg(value.holdRepulsion, value.softHard) : null
  const derived = value ? deriveDimensions(value) : null

  function placementFromEvent(e: React.PointerEvent<SVGSVGElement>): { holdRepulsion: number; softHard: number } | null {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const local = pt.matrixTransform(ctm.inverse())
    return {
      holdRepulsion: Math.round(clamp01((local.x - CENTER) / (2 * PLOT_HALF) + 0.5) * 100) / 100,
      softHard: Math.round(clamp01((CENTER - local.y) / (2 * PLOT_HALF) + 0.5) * 100) / 100,
    }
  }

  function update(partial: Partial<MapPlacement>) {
    const base: MapPlacement = value ?? { holdRepulsion: 0.5, softHard: 0.5 }
    onChange({ ...base, ...partial })
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (disabled) return
    const next = placementFromEvent(e)
    if (!next) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    update(next)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging || disabled) return
    const next = placementFromEvent(e)
    if (next) update(next)
  }

  function handleKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (disabled) return
    const cur = value ?? { holdRepulsion: 0.5, softHard: 0.5 }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    update({ holdRepulsion: clamp01(Math.round((cur.holdRepulsion + m[0]) * 100) / 100), softHard: clamp01(Math.round((cur.softHard + m[1]) * 100) / 100) })
  }

  return (
    <section className="rounded-xl border-2 border-shuttle-500/40 p-4 space-y-4">
      <div>
        <h4 className="font-semibold text-ink-900 dark:text-shuttle-50">Place it on the map</h4>
        <p className="text-xs text-ink-700/60 dark:text-shuttle-100/60 mt-1">
          Click or drag where this string sits compared to the others. That plus the two durability answers fills in every dimension below — anything you type by hand still wins.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        <div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className={`w-full h-auto touch-none select-none rounded-lg focus-ring ${disabled ? 'opacity-60' : 'cursor-crosshair'}`}
            tabIndex={disabled ? -1 : 0}
            role="application"
            aria-label={`Feel map placement for ${self ? `${self.brand} ${self.name}` : stringId}. Use arrow keys to move the pin.`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onKeyDown={handleKeyDown}
          >
            <circle cx={CENTER} cy={CENTER} r={CIRCLE_R} className="fill-none stroke-court-900/15 dark:stroke-white/15" />
            <rect x={CENTER - PLOT_HALF} y={CENTER - PLOT_HALF} width={PLOT_HALF * 2} height={PLOT_HALF * 2} className="fill-court-900/[0.03] dark:fill-white/[0.03] stroke-court-900/10 dark:stroke-white/10" strokeDasharray="2 4" />
            <line x1={CENTER - CIRCLE_R} y1={CENTER} x2={CENTER + CIRCLE_R} y2={CENTER} className="stroke-court-900/15 dark:stroke-white/15" />
            <line x1={CENTER} y1={CENTER - CIRCLE_R} x2={CENTER} y2={CENTER + CIRCLE_R} className="stroke-court-900/15 dark:stroke-white/15" />

            <text x={CENTER} y={CENTER - AXIS_LABEL_R} textAnchor="middle" className="fill-ink-700/50 dark:fill-shuttle-100/50 text-[9px] font-semibold uppercase tracking-wide">Hard feel</text>
            <text x={CENTER} y={CENTER + AXIS_LABEL_R + 6} textAnchor="middle" className="fill-ink-700/50 dark:fill-shuttle-100/50 text-[9px] font-semibold uppercase tracking-wide">Soft feel</text>
            <text x={CENTER - AXIS_LABEL_R} y={CENTER + 3} textAnchor="middle" className="fill-ink-700/50 dark:fill-shuttle-100/50 text-[9px] font-semibold uppercase tracking-wide">Max hold</text>
            <text x={CENTER + AXIS_LABEL_R} y={CENTER + 3} textAnchor="middle" className="fill-ink-700/50 dark:fill-shuttle-100/50 text-[9px] font-semibold uppercase tracking-wide">Repulsion</text>

            {others.map(({ item, x, y }) => {
              const off = labelOffsets.get(item.id) ?? { labelDx: 0, labelDy: -8, hasLeader: false }
              const labelVisible = showNames || hoverId === item.id
              return (
                <g key={item.id} onPointerEnter={() => setHoverId(item.id)} onPointerLeave={() => setHoverId((cur) => (cur === item.id ? null : cur))}>
                  {labelVisible && off.hasLeader && <line x1={x} y1={y} x2={x + off.labelDx} y2={y + off.labelDy} className="stroke-court-900/15 dark:stroke-white/15" strokeWidth={0.75} />}
                  <circle cx={x} cy={y} r={4} className={`${DOT_FILL[item.category]} opacity-50`} />
                  {labelVisible && (
                    <text x={x + off.labelDx} y={y + off.labelDy} textAnchor="middle" className="fill-ink-700/50 dark:fill-shuttle-100/50 text-[6.5px] font-semibold uppercase tracking-wide pointer-events-none">
                      {item.name}
                    </text>
                  )}
                </g>
              )
            })}

            {!pin && autoPosition && (
              <g className="pointer-events-none">
                <circle cx={autoPosition.x} cy={autoPosition.y} r={9} className="fill-none stroke-shuttle-500" strokeWidth={2} strokeDasharray="3 3" />
                <text x={autoPosition.x} y={autoPosition.y + 20} textAnchor="middle" className="fill-shuttle-600 dark:fill-shuttle-400 text-[7px] font-semibold uppercase tracking-wide">
                  now (auto)
                </text>
              </g>
            )}

            {pin && (
              <g className="pointer-events-none">
                <circle cx={pin.x} cy={pin.y} r={14} className="fill-shuttle-500/20" />
                <circle cx={pin.x} cy={pin.y} r={8} className="fill-shuttle-500 stroke-ink-900 dark:stroke-shuttle-50" strokeWidth={2.5} />
                <text x={pin.x} y={pin.y - 17} textAnchor="middle" className="fill-ink-900 dark:fill-shuttle-50 text-[8px] font-bold uppercase tracking-wide">
                  {self?.name ?? stringId}
                </text>
              </g>
            )}
          </svg>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-xs">
            <label className="inline-flex items-center gap-1.5 text-ink-700/60 dark:text-shuttle-100/60 cursor-pointer">
              <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Show names
            </label>
            {value && (
              <button type="button" onClick={() => onChange(null)} disabled={disabled} className="focus-ring font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer">
                Remove placement
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SegmentedChoice
            label="Everyday wear durability"
            options={DURABILITY_STEPS}
            selected={value?.durability}
            disabled={disabled}
            onSelect={(v) => update({ durability: v })}
            onClear={() => value && onChange({ ...value, durability: undefined })}
          />
          <SegmentedChoice
            label="Mishits"
            options={MISHIT_STEPS}
            selected={value?.mishit}
            disabled={disabled}
            onSelect={(v) => update({ mishit: v })}
            onClear={() => value && onChange({ ...value, mishit: undefined })}
          />

          {derived ? (
            <div>
              <p className="text-xs font-semibold text-ink-900 dark:text-shuttle-50 mb-1.5">What the engine will use</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                {DIMENSION_OPTIONS.map(({ key, label }) => {
                  const manual = (manualDimensions[key] ?? '').trim()
                  const auto = derived[key]
                  if (manual === '' && auto == null) return null
                  return (
                    <li key={key} className="flex justify-between gap-2 text-ink-700/70 dark:text-shuttle-100/70">
                      <span className="truncate">{label}</span>
                      <span className={manual !== '' ? 'font-bold text-ink-900 dark:text-shuttle-50' : 'tabular-nums'} title={manual !== '' ? 'Typed by hand — overrides the map' : 'Derived from the map'}>
                        {manual !== '' ? `${manual}✎` : auto}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[10px] text-ink-700/50 dark:text-shuttle-100/50 mt-1.5">✎ = typed by hand, overrides the map. Tension retention and value are never guessed from the map.</p>
            </div>
          ) : (
            <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">No placement yet — the dashed ring shows where the string currently lands automatically.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function SegmentedChoice<T extends string | number>({
  label,
  options,
  selected,
  disabled,
  onSelect,
  onClear,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T | undefined
  disabled: boolean
  onSelect: (v: T) => void
  onClear: () => void
}) {
  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between text-xs font-semibold text-ink-900 dark:text-shuttle-50 mb-1.5">
        {label}
        {selected != null && (
          <button type="button" onClick={onClear} disabled={disabled} className="font-normal text-ink-700/50 dark:text-shuttle-100/50 hover:underline cursor-pointer">
            clear
          </button>
        )}
      </legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            aria-pressed={selected === o.value}
            onClick={() => onSelect(o.value)}
            className={`focus-ring rounded-full border-2 text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-60 ${
              selected === o.value ? 'border-shuttle-500 bg-shuttle-500 text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50 hover:border-shuttle-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
