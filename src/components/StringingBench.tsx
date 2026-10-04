import { useState, type DragEvent, type ReactNode } from 'react'
import type { StringItem } from '../data/strings'
import type { SpecialistDimensionKey, StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { formatGauge } from '../logic/formatGauge'
import { stringPagePath } from '../logic/stringPages'
import { cutEllipse, cutPolygon } from '../logic/scissors'
import { PERFORMANCE_AXES, getPerformanceValues } from './performanceAxes'
import { HANDS_ON_PROPERTY_COUNT, provenanceOf } from '../logic/provenance'

/** Drag payload type for a string reel (set by StringTile). */
export const REEL_DRAG_TYPE = 'application/x-smashlab-string'

/** The hands-on ratings shown on the bench — the ones that matter most when choosing (out of 5). */
const HANDS_ON: { key: SpecialistDimensionKey; label: string }[] = [
  { key: 'easyPower', label: 'Power' },
  { key: 'controlPrecision', label: 'Control' },
  { key: 'shuttleGripHold', label: 'Grip' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'normalWearDurability', label: 'Durability' },
]

interface StringingBenchProps {
  items: StringItem[]
  max: number
  specialistProfiles?: Record<string, StringSpecialistProfile>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  /** Radar/table detail, shown in a closed fold when 2+ strings are on the bench. */
  detail?: ReactNode
}

/**
 * The comparison as a stringing bench: paper stringing machines, each with a racket lying flat on
 * it. Drop a reel on the bench (desktop) or tap "+ Racket" on any string and that racket gets
 * strung. Hands-on ratings (out of 5) come first — that's what Smash Lab knows that a packet
 * doesn't; the maker's 0–11 ratings follow in one compact line. ▲ marks the better value.
 */
export default function StringingBench({ items, max, specialistProfiles, onAdd, onRemove, detail }: StringingBenchProps) {
  const [dragOver, setDragOver] = useState(false)
  const slots = Array.from({ length: max }, (_, i) => items[i] ?? null)
  const handsOn = items.map((s) => specialistProfiles?.[s.id]?.dimensions ?? {})
  const maker = items.map((s) => getPerformanceValues(s))
  // ▲ only means something when at least two strings actually have a value to compare.
  const best = (vals: (number | null | undefined)[]) => {
    const known = vals.filter((v): v is number => v != null)
    return known.length > 1 ? Math.max(...known) : null
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData(REEL_DRAG_TYPE)
    if (id) onAdd(id)
  }

  return (
    <section
      aria-label="Stringing bench — compare strings"
      className={`paper p-3 sm:p-4 ${dragOver ? 'ring-4 ring-shuttle-500/60' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(REEL_DRAG_TYPE)) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tape">Stringing bench</span>
        <p className="text-xs text-ink-700/80 dark:text-shuttle-100/80">
          <span className="hidden md:inline">Drag a reel onto the bench — or tap </span>
          <span className="md:hidden">Tap </span>
          <strong>+ Racket</strong> on any string to compare.
        </p>
      </div>

      <ul className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {slots.map((item, i) => {
          // phones show the strung rackets plus ONE empty machine; desktop shows every machine
          const extraEmpty = item == null && i > items.length
          return (
            <li key={item?.id ?? `empty-${i}`} className={`min-w-0 ${extraEmpty ? 'hidden sm:block' : ''} flex gap-3 sm:block`}>
              <div className="w-36 shrink-0 sm:w-full">
                <Machine item={item} />
              </div>
              {item ? (
                <div className="min-w-0 flex-1 sm:mt-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400 truncate">{item.brand}</p>
                      <a
                        href={`${import.meta.env.BASE_URL}${stringPagePath(item.id)}`}
                        className="focus-ring block font-display text-sm sm:text-base font-bold leading-tight text-ink-900 dark:text-shuttle-50 hover:underline truncate"
                      >
                        {item.name}
                      </a>
                      <p className="text-[11px] text-ink-700/70 dark:text-shuttle-100/70">{formatGauge(item) ?? '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Take ${item.name} off the bench`}
                      className="focus-ring shrink-0 rounded-full px-1.5 text-sm text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-court-700 dark:text-shuttle-400">Hands-on · out of 5</p>
                  {(() => {
                    const pv = provenanceOf(specialistProfiles?.[item.id])
                    return (
                      <p className="text-[10px] text-ink-700/70 dark:text-shuttle-100/70">
                        {pv.ratedCount} of {HANDS_ON_PROPERTY_COUNT} rated{pv.source ? ` · ${pv.source}` : ''}{pv.confidence ? ` · ${pv.confidence}` : ''}
                      </p>
                    )
                  })()}
                  {Object.keys(handsOn[items.indexOf(item)]).length === 0 ? (
                    <p className="text-[11px] text-ink-700/70 dark:text-shuttle-100/70">No hands-on notes yet.</p>
                  ) : (
                    <ul className="space-y-0.5" aria-label={`${item.name}, hands-on ratings out of 5`}>
                      {HANDS_ON.map(({ key, label }) => {
                        const v = handsOn[items.indexOf(item)][key]
                        const isBest = v != null && best(handsOn.map((h) => h[key])) === v
                        return (
                          <li key={key} className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-16 shrink-0 text-ink-700/80 dark:text-shuttle-100/80">{label}</span>
                            <span className="relative h-1.5 flex-1 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
                              {v != null && <span className="absolute inset-y-0 left-0 rounded-full bg-court-600 dark:bg-shuttle-400" style={{ width: `${(v / 5) * 100}%` }} />}
                            </span>
                            <span className={`w-8 text-right tabular-nums ${isBest ? 'font-bold text-court-700 dark:text-shuttle-400' : 'text-ink-700/80 dark:text-shuttle-100/80'}`}>
                              {isBest && <span aria-label="highest on the bench" title="Highest value on the bench — not a measurement">▲</span>}
                              {v ?? '–'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <p className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-ink-700/70 dark:text-shuttle-100/70" aria-label={`${item.name}, maker's ratings out of 11`}>
                    <span className="font-semibold">Maker /11:</span>
                    {PERFORMANCE_AXES.map((a) => {
                      const v = maker[items.indexOf(item)][a.key]
                      const isBest = v != null && best(maker.map((m) => m[a.key])) === v
                      return (
                        <span key={a.key} title={a.label} className={isBest ? 'font-bold text-court-700 dark:text-shuttle-400' : ''}>
                          <span aria-hidden="true">{a.emoji}</span>
                          <span className="sr-only">{a.label} </span>
                          {v ?? '–'}
                        </span>
                      )
                    })}
                  </p>
                </div>
              ) : (
                <p className="flex-1 self-center text-[11px] text-ink-700/70 dark:text-shuttle-100/70 sm:mt-1 sm:text-center">Empty machine — add a string.</p>
              )}
            </li>
          )
        })}
      </ul>

      {items.length > 1 && detail && (
        <details className="group mt-3 border-t border-dashed border-court-900/15 dark:border-white/15 pt-2">
          <summary className="focus-ring cursor-pointer list-none text-xs font-semibold text-ink-700/80 dark:text-shuttle-100/80 [&::-webkit-details-marker]:hidden">
            More detail: radar &amp; table <span aria-hidden="true">▾</span>
          </summary>
          <div className="mt-3">{detail}</div>
        </details>
      )}
    </section>
  )
}

// The stringing machine, cut from felt/foam card like the reference: blue base, green frame with
// two posts, cream arms with dark clamps, the blue tension head on the right. Loosely cut, not crisp.
const BASE = cutPolygon([[6, 92], [196, 92], [192, 104], [10, 104]], 1101, 1.2)
const FRAME = cutPolygon([[4, 76], [142, 72], [146, 90], [8, 94]], 1102, 1.4)
const SLOT = cutPolygon([[26, 80], [118, 78], [120, 84], [28, 86]], 1103, 0.8)
const POST_L = cutPolygon([[18, 40], [36, 40], [40, 78], [14, 78]], 1104, 1.2)
const POST_R = cutPolygon([[110, 40], [128, 40], [132, 76], [106, 76]], 1105, 1.2)
const ARM_L = cutPolygon([[30, 38], [60, 44], [58, 50], [28, 46]], 1106, 0.9)
const ARM_R = cutPolygon([[114, 38], [86, 44], [88, 50], [116, 46]], 1107, 0.9)
const CLAMP_L = cutPolygon([[54, 30], [64, 32], [62, 46], [56, 44]], 1108, 0.8)
const CLAMP_R = cutPolygon([[90, 32], [100, 30], [98, 44], [92, 46]], 1109, 0.8)
const BOX = cutPolygon([[146, 50], [194, 50], [196, 92], [144, 92]], 1110, 1.2)
const PANEL = cutPolygon([[150, 60], [190, 60], [190, 74], [150, 74]], 1111, 0.7)
const HEAD = cutPolygon([[154, 38], [190, 38], [192, 50], [152, 50]], 1112, 1)
const KNOB = cutEllipse(14, 50, 6, 6, 1113, 9, 0.05)
const RACKET_HEAD = cutEllipse(73, 36, 30, 11, 1114, 14, 0.03)

function Machine({ item }: { item: StringItem | null }) {
  const strung = item != null
  return (
    <svg viewBox="0 0 200 112" className="block w-full h-auto" role="img" aria-label={strung ? `Stringing machine with a racket strung with ${item.name}` : 'Empty stringing machine'}>
      <defs>
        <clipPath id="bench-head">
          <ellipse cx="73" cy="36" rx="28" ry="9.5" />
        </clipPath>
      </defs>
      <rect x="18" y="102" width="10" height="6" rx="2" className="fill-ink-900/70" />
      <rect x="172" y="102" width="10" height="6" rx="2" className="fill-ink-900/70" />
      <path d={BASE} className="fill-[#2f63c9]" />
      <path d={FRAME} className="fill-[#2f9a46]" />
      <path d={SLOT} className="fill-[#f3e3b5]" />
      <path d={POST_L} className="fill-[#2f9a46]" />
      <path d={POST_R} className="fill-[#2f9a46]" />
      <path d={KNOB} className="fill-[#2f63c9]" />
      <circle cx="14" cy="50" r="3" className="fill-[#ffcf33]" />
      <path d={ARM_L} className="fill-[#f3e3b5]" />
      <path d={ARM_R} className="fill-[#f3e3b5]" />
      <path d={BOX} className="fill-[#2f63c9]" />
      <path d={PANEL} className="fill-[#f3e3b5]" />
      <circle cx="158" cy="67" r="3.6" className="fill-[#ffcf33]" />
      <circle cx="169" cy="67" r="3.6" className="fill-[#ffcf33]" />
      <circle cx="182" cy="67" r="4.2" className="fill-[#e2463b]" />
      <path d={HEAD} className="fill-[#2b2b2e]" />
      <circle cx="150" cy="44" r="5" className="fill-[#2f63c9]" />

      {/* the racket, lying flat on the machine; handle towards the left post */}
      <g className={strung ? '' : 'opacity-55'}>
        <rect x="14" y="33.5" width="32" height="5" rx="2" className="fill-ink-900/80" />
        <path d={RACKET_HEAD} className={strung ? 'fill-[#fff8ea]' : 'fill-none'} />
        {strung && (
          <g className="bench-strings" clipPath="url(#bench-head)" key={item.id}>
            {[52, 59, 66, 73, 80, 87, 94].map((x) => (
              <path key={`v${x}`} d={`M${x} 24 L${x - 3} 48`} className="stroke-[#ef7410]" strokeWidth="1.3" />
            ))}
            {[30, 34, 38, 42].map((y) => (
              <path key={`h${y}`} d={`M40 ${y} L106 ${y}`} className="stroke-[#ff8a1f]" strokeWidth="1.3" />
            ))}
          </g>
        )}
        <path d={RACKET_HEAD} className="fill-none stroke-[#d5523b]" strokeWidth="3.5" strokeDasharray={strung ? undefined : '5 4'} />
      </g>
      <path d={CLAMP_L} className="fill-[#2b2b2e]" />
      <path d={CLAMP_R} className="fill-[#2b2b2e]" />
    </svg>
  )
}
