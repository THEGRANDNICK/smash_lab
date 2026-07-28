import type { StringColorSwatch as StringColorSwatchValue } from '../logic/stringColor'

interface StringColorSwatchProps {
  swatch: StringColorSwatchValue
  /** 'sm' for compact contexts (comparison headings, chips), 'md' (default) for catalog cards, 'lg' for the hero. */
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSNAME: Record<NonNullable<StringColorSwatchProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-4.5 h-4.5',
}

/**
 * The PHYSICAL STRING COLOR swatch — distinct from a chart-series legend
 * dot (see ComparisonTable.tsx / StringComparison.tsx, which use
 * performanceAxes.ts's RADAR_COMPARE_COLORS for "which line is this
 * string" and never this component). Communicates its value via an
 * explicit title/aria-label, never color alone.
 */
export default function StringColorSwatch({ swatch, size = 'md' }: StringColorSwatchProps) {
  return (
    <span
      role="img"
      aria-label={`String color: ${swatch.label}`}
      title={`String color: ${swatch.label}`}
      className={`inline-block rounded-full shrink-0 ${SIZE_CLASSNAME[size]} ${swatch.ringClassName}`}
      style={{ backgroundColor: swatch.hex }}
    />
  )
}
