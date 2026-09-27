import type { SpecialistDimensionKey, StringSpecialistProfile } from '../data/stringSpecialistProfiles'

/** Player-facing names, in tie-break order (what a player scanning the card cares about first). */
const HIGHLIGHT_LABELS: [SpecialistDimensionKey, string][] = [
  ['controlPrecision', 'Control'],
  ['shuttleGripHold', 'Shuttle grip'],
  ['attackSmash', 'Attack'],
  ['easyPower', 'Easy power'],
  ['fastDoubles', 'Fast doubles'],
  ['netTechnical', 'Net play'],
  ['normalWearDurability', 'Durability'],
  ['mishitTolerance', 'Mishit tolerance'],
  ['tensionRetention', 'Tension retention'],
  ['comfort', 'Comfort'],
  ['beginnerFriendliness', 'Beginner-friendly'],
  ['value', 'Value'],
  ['allRoundSuitability', 'All-round'],
  ['hardHitterFit', 'Hard hitters'],
  ['flatDriveGame', 'Drives'],
]

const MIN_SCORE = 4.5
const MAX_CHIPS = 3

/**
 * The manufacturer bars above can undersell a string badly (BG80 shows
 * "Control 6" although its hands-on control is 5/5). This row surfaces the
 * top hands-on strengths right on the card, so nobody has to open the
 * Smash Lab Experience panel to find out.
 */
export default function SpecialistHighlights({ profile }: { profile: StringSpecialistProfile | undefined }) {
  if (!profile) return null
  const chips = HIGHLIGHT_LABELS.map(([key, label], order) => ({ label, value: profile.dimensions[key], order }))
    .filter((c): c is { label: string; value: number; order: number } => c.value != null && c.value >= MIN_SCORE)
    .sort((a, b) => b.value - a.value || a.order - b.order)
    .slice(0, MAX_CHIPS)
  if (chips.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Smash Lab hands-on strengths">
      <span className="font-semibold text-ink-700/70 dark:text-shuttle-100/60">🔬 Smash Lab:</span>
      {chips.map((c) => (
        <span key={c.label} className="rounded-full border border-shuttle-500/50 bg-shuttle-500/10 px-2 py-0.5 font-semibold text-ink-900 dark:text-shuttle-50">
          {c.label} {Number.isInteger(c.value) ? c.value : c.value.toFixed(1)}/5
        </span>
      ))}
    </div>
  )
}
