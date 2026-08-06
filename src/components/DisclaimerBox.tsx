interface DisclaimerBoxProps {
  className?: string
}

/**
 * Feature F — the manufacturer-data disclaimer, exact wording from the
 * product brief. Shown once per major section that uses manufacturer
 * ratings (result page, general comparison), never repeated card-by-card.
 */
export default function DisclaimerBox({ className = '' }: DisclaimerBoxProps) {
  return (
    <p className={`text-xs text-ink-700/50 dark:text-shuttle-100/50 text-center max-w-2xl mx-auto ${className}`}>
      Performance ratings are based primarily on manufacturer information and, when enabled, Smash Lab specialist calibration. Manufacturer rating scales are not fully standardized across brands, and
      real playing experience may vary by racket, tension and player.
    </p>
  )
}
