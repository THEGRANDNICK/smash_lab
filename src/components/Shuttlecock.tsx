interface ShuttlecockProps {
  className?: string
}

/** A small inline shuttlecock glyph used for decorative accents and the quiz progress bar. */
export default function Shuttlecock({ className = 'w-6 h-6' }: ShuttlecockProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="46" r="12" fill="currentColor" opacity="0.95" />
      <path
        d="M32 34 L18 8 M32 34 L26 6 M32 34 L38 6 M32 34 L46 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path d="M18 8 Q32 2 46 8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}
