import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface WheelItem {
  id: string
  label: string
  sub?: string
  /** A small colour dot (e.g. the string's shelf). */
  swatch?: string
}

interface WheelPickerProps {
  items: WheelItem[]
  value: string
  onChange: (id: string) => void
  label: string
  /** Visible rows (odd number keeps one in the middle). */
  rows?: 3 | 5
}

const ROW = 52

/**
 * A Mario Kart-style parts wheel: scroll, swipe or turn the mouse wheel and whatever lands in the
 * frame in the middle is picked — the stats update as you go. Neighbours shrink and fade like a
 * drum. Arrow keys and tapping work too (keyboard and screen readers: it's a listbox).
 */
export default function WheelPicker({ items, value, onChange, label, rows = 3 }: WheelPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const index = Math.max(0, items.findIndex((i) => i.id === value))
  const pad = ((rows - 1) / 2) * ROW

  // keep the wheel on the chosen item when it changes from outside (or on first render)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW, behavior: 'auto' })
    setScrollTop(index * ROW)
  }, [index])

  function goTo(i: number) {
    const clamped = Math.max(0, Math.min(items.length - 1, i))
    ref.current?.scrollTo({ top: clamped * ROW, behavior: 'smooth' })
    if (items[clamped] && items[clamped].id !== value) onChange(items[clamped].id)
  }

  function onScroll() {
    const el = ref.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (settle.current) window.clearTimeout(settle.current)
    // pick whatever is in the frame once the wheel comes to rest
    settle.current = window.setTimeout(() => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)))
      if (items[i] && items[i].id !== value) onChange(items[i].id)
    }, 110)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(index + 1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(index - 1)
    }
  }

  return (
    <div className="relative flex items-stretch gap-2">
      <div className="relative flex-1" style={{ height: rows * ROW }}>
        {/* the selection frame in the middle */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 rounded-xl border-2 border-shuttle-500 bg-shuttle-500/10" style={{ top: pad, height: ROW }} />
        <div
          ref={ref}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`wheel-${label}-${index}`}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="focus-ring h-full overflow-y-auto snap-y snap-mandatory rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: pad, paddingBottom: pad }}
        >
          {items.map((item, i) => {
            const distance = Math.min(2, Math.abs(i * ROW - scrollTop) / ROW)
            return (
              <div
                key={item.id}
                id={`wheel-${label}-${i}`}
                role="option"
                aria-selected={i === index}
                onClick={() => goTo(i)}
                className="snap-center flex items-center gap-3 px-3 cursor-pointer select-none"
                style={{ height: ROW, transform: `scale(${1 - distance * 0.1})`, opacity: 1 - distance * 0.35 }}
              >
                {item.swatch && <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.swatch }} />}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-900 dark:text-shuttle-50">{item.label}</span>
                  {item.sub && <span className="block truncate text-[11px] text-ink-700/70 dark:text-shuttle-100/70">{item.sub}</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={`Previous ${label}`} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 h-9 w-9 font-bold cursor-pointer disabled:opacity-30">
          ▲
        </button>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === items.length - 1} aria-label={`Next ${label}`} className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 h-9 w-9 font-bold cursor-pointer disabled:opacity-30">
          ▼
        </button>
      </div>
    </div>
  )
}
