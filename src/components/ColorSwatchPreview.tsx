import { useMemo, useState } from 'react'
import type { StringItem } from '../data/strings'
import { buildColorPreview, type StringColorSwatch as StringColorSwatchValue } from '../logic/stringColor'
import StringColorSwatch from './StringColorSwatch'

interface ColorSwatchPreviewProps {
  item: Pick<StringItem, 'isHybrid' | 'mainString' | 'crossString' | 'inventoryColor' | 'colors' | 'stock'>
  /** How many solid swatches to show before collapsing the rest behind a "+N" control. Hybrid strings always render as a single split circle regardless. */
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
}

const SPLIT_SIZE_CLASSNAME: Record<NonNullable<ColorSwatchPreviewProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-4.5 h-4.5',
}

function HybridSplitSwatch({ main, cross, size }: { main: StringColorSwatchValue; cross: StringColorSwatchValue; size: NonNullable<ColorSwatchPreviewProps['size']> }) {
  return (
    <span
      role="img"
      aria-label={`Hybrid string colors: ${main.label} main, ${cross.label} cross`}
      title={`Main: ${main.label} · Cross: ${cross.label}`}
      className={`inline-block rounded-full shrink-0 ring-1 ring-black/20 dark:ring-white/40 ${SPLIT_SIZE_CLASSNAME[size]}`}
      style={{ background: `conic-gradient(${main.hex} 0deg 180deg, ${cross.hex} 180deg 360deg)` }}
    />
  )
}

/**
 * Compact physical-string-color preview: one dot per known color (up to
 * `maxVisible`), a "+N" control that expands/collapses the rest inline, or
 * a single two-tone split circle for a hybrid string whose main/cross
 * colors are both known. Renders nothing when there's no recognized color
 * data — never a placeholder. Color names are exposed only through
 * aria-label/title on each dot, never as visible text on the card.
 */
export default function ColorSwatchPreview({ item, maxVisible = 3, size = 'sm' }: ColorSwatchPreviewProps) {
  const preview = useMemo(() => buildColorPreview(item, maxVisible), [item, maxVisible])
  const [expanded, setExpanded] = useState(false)

  if (preview.kind === 'none') return null

  if (preview.kind === 'hybrid') {
    return <HybridSplitSwatch main={preview.main} cross={preview.cross} size={size} />
  }

  const overflowCount = preview.overflow.length

  return (
    <span className="inline-flex items-center gap-1">
      {preview.visible.map((swatch) => (
        <StringColorSwatch key={swatch.hex} swatch={swatch} size={size} />
      ))}
      {expanded && preview.overflow.map((swatch) => <StringColorSwatch key={swatch.hex} swatch={swatch} size={size} />)}
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Show fewer colors' : `Show ${overflowCount} more color${overflowCount > 1 ? 's' : ''}`}
          className="focus-ring rounded-full text-[10px] font-semibold leading-none text-ink-700/60 dark:text-shuttle-100/60 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer px-1 py-1.5 -my-1.5"
        >
          {expanded ? '−' : `+${overflowCount}`}
        </button>
      )}
    </span>
  )
}
