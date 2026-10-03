import { useState, type DragEvent, type ReactNode } from 'react'
import type { StringItem } from '../data/strings'
import { formatGauge } from '../logic/formatGauge'
import { stringPagePath } from '../logic/stringPages'
import { PERFORMANCE_AXES, PERFORMANCE_MAX, getPerformanceValues } from './performanceAxes'

/** Drag payload type for a string reel (set by StringTile). */
export const REEL_DRAG_TYPE = 'application/x-smashlab-string'

interface StringingBenchProps {
  items: StringItem[]
  max: number
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  /** Radar/table detail, shown in a closed fold under the bench when 2+ strings are on it. */
  detail?: ReactNode
}

/**
 * The comparison, as a stringing bench: up to `max` small paper stringing machines, each with a
 * racket. Drop a reel on a racket (desktop) or tap "+ Racket" on a string (anywhere) and the racket
 * gets strung — in stepped frames — with a compact stat card underneath. With two or more strings,
 * ▲ marks the best value per rating. Same size and material as the rest of the page.
 */
export default function StringingBench({ items, max, onAdd, onRemove, detail }: StringingBenchProps) {
  const [dragOver, setDragOver] = useState(false)
  const slots = Array.from({ length: max }, (_, i) => items[i] ?? null)
  const values = items.map((s) => getPerformanceValues(s))
  const bestOf = Object.fromEntries(
    PERFORMANCE_AXES.map((a) => [a.key, items.length > 1 ? Math.max(...values.map((v) => v[a.key] ?? -1)) : null]),
  ) as Record<string, number | null>

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData(REEL_DRAG_TYPE)
    if (id) onAdd(id)
  }

  return (
    <section
      aria-label="Stringing bench — compare strings"
      className={`paper p-3 sm:p-4 transition-shadow ${dragOver ? 'ring-4 ring-shuttle-500/60' : ''}`}
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
          <span className="hidden md:inline">Drag a reel onto a racket — or tap </span>
          <span className="md:hidden">Tap </span>
          <strong>+ Racket</strong> on any string to compare.
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
        {slots.map((item, i) => (
          <li key={item?.id ?? `empty-${i}`} className="min-w-0">
            <Machine item={item} />
            {item ? (
              <div className="mt-2">
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
                    aria-label={`Take ${item.name} off the racket`}
                    className="focus-ring shrink-0 rounded-full px-1.5 text-sm text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <ul className="mt-1.5 space-y-0.5" aria-label={`${item.name} ratings out of ${PERFORMANCE_MAX}`}>
                  {PERFORMANCE_AXES.map((axis) => {
                    const v = values[items.indexOf(item)][axis.key]
                    const isBest = v != null && bestOf[axis.key] === v
                    return (
                      <li key={axis.key} className="flex items-center gap-1 text-[11px]" title={axis.label}>
                        <span aria-hidden="true" className="w-4 text-center">
                          {axis.emoji}
                        </span>
                        <span className="sr-only">{axis.label}</span>
                        <span className="relative h-1.5 flex-1 rounded-full bg-court-900/10 dark:bg-white/10 overflow-hidden">
                          <span className="absolute inset-y-0 left-0 rounded-full bg-shuttle-500" style={{ width: `${v == null ? 0 : (v / PERFORMANCE_MAX) * 100}%` }} />
                        </span>
                        <span className={`w-6 text-right tabular-nums ${isBest ? 'font-bold text-court-700 dark:text-shuttle-400' : 'text-ink-700/80 dark:text-shuttle-100/80'}`}>
                          {isBest && <span aria-label="best">▲</span>}
                          {v ?? '—'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-center text-[11px] text-ink-700/70 dark:text-shuttle-100/70">Empty racket</p>
            )}
          </li>
        ))}
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

/** A small paper stringing machine with a racket; strung (in stepped frames) when a string is on it. */
function Machine({ item }: { item: StringItem | null }) {
  const strung = item != null
  return (
    <svg viewBox="0 0 120 150" className="block w-full max-w-[84px] sm:max-w-[110px] mx-auto h-auto" role="img" aria-label={strung ? `Racket strung with ${item.name}` : 'Empty racket'}>
      {/* machine: base, post, turntable arms */}
      <path d="M14 136 L106 136 L102 146 L18 146 Z" className="fill-court-700" />
      <rect x="54" y="104" width="12" height="34" rx="2" className="fill-court-800" />
      <rect x="24" y="98" width="72" height="8" rx="3" className="fill-[#3b6fb6]" />
      {/* racket */}
      <g className={strung ? '' : 'opacity-60'}>
        <rect x="57" y="74" width="6" height="30" rx="2" className="fill-ink-700" />
        <ellipse cx="60" cy="44" rx="30" ry="36" className={strung ? 'fill-[#fff8ea]' : 'fill-none'} />
        <g className={strung ? 'bench-strings' : ''} key={item?.id ?? 'empty'}>
          {strung &&
            [-20, -12, -4, 4, 12, 20].map((dx) => (
              <path key={`v${dx}`} d={`M${60 + dx} 12 L${60 + dx} 76`} className="stroke-[#ef7410]" strokeWidth="1.6" clipPath="url(#bench-head)" />
            ))}
          {strung &&
            [20, 30, 40, 50, 60, 70].map((y) => <path key={`h${y}`} d={`M28 ${y} L92 ${y}`} className="stroke-[#ff8a1f]" strokeWidth="1.6" clipPath="url(#bench-head)" />)}
        </g>
        <ellipse cx="60" cy="44" rx="30" ry="36" className="fill-none stroke-[#d5523b]" strokeWidth="5" strokeDasharray={strung ? undefined : '6 5'} />
      </g>
      <defs>
        <clipPath id="bench-head">
          <ellipse cx="60" cy="44" rx="28" ry="34" />
        </clipPath>
      </defs>
      {!strung && (
        <text x="60" y="48" textAnchor="middle" className="fill-ink-700/60 dark:fill-shuttle-100/60 text-[9px] font-bold">
          drop a reel
        </text>
      )}
    </svg>
  )
}
