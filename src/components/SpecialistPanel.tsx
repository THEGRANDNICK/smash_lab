import { useState } from 'react'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles'

const EXPERIENCE_LABEL: Record<StringSpecialistProfile['experienceSource'], string> = {
  personal: 'Personal play',
  club: 'Club observation',
  'stringing-observation': 'Stringing observation',
  manufacturer: 'Manufacturer info',
  community: 'Community reports',
  mixed: 'Personal play + club/stringing observation',
}

const CONFIDENCE_LABEL: Record<StringSpecialistProfile['confidence'], string> = {
  'very-high': 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unknown: 'Unknown',
}

const FEEL_LABEL: Record<string, string> = {
  hard: 'Hard / direct',
  medium: 'Medium',
  soft: 'Soft / forgiving',
}

function formatTag(tag: string): string {
  return tag
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export default function SpecialistPanel({ profile }: { profile: StringSpecialistProfile }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-court-900/10 dark:border-white/10 bg-court-900/[0.03] dark:bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left cursor-pointer"
      >
        <span className="text-xs font-semibold text-court-800 dark:text-shuttle-400">🔬 Smash Lab Experience</span>
        <span className={`text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm">
          {profile.specialistTags && profile.specialistTags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Best for</p>
              <p className="text-ink-900 dark:text-shuttle-50 mt-0.5">{profile.specialistTags.slice(0, 4).map(formatTag).join(' • ')}</p>
            </div>
          )}

          {profile.feel && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Feel</p>
              <p className="text-ink-900 dark:text-shuttle-50 mt-0.5">{FEEL_LABEL[profile.feel]}</p>
            </div>
          )}

          {profile.strengths && profile.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Strengths</p>
              <ul className="mt-0.5 space-y-0.5 text-ink-700/80 dark:text-shuttle-100/80">
                {profile.strengths.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.weaknesses && profile.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Trade-offs</p>
              <ul className="mt-0.5 space-y-0.5 text-ink-700/80 dark:text-shuttle-100/80">
                {profile.weaknesses.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {profile.subjectiveNotes && <p className="text-ink-700/70 dark:text-shuttle-100/70 italic">{profile.subjectiveNotes}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-court-900/10 dark:border-white/10 text-xs">
            <p>
              <span className="font-semibold text-ink-700/60 dark:text-shuttle-100/60">Experience: </span>
              <span className="text-ink-900 dark:text-shuttle-50">{EXPERIENCE_LABEL[profile.experienceSource]}</span>
            </p>
            <p>
              <span className="font-semibold text-ink-700/60 dark:text-shuttle-100/60">Confidence: </span>
              <span className="text-ink-900 dark:text-shuttle-50">{CONFIDENCE_LABEL[profile.confidence]}</span>
            </p>
          </div>
          <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50">
            Based on personal play, stringing observations and club experience — separate from the manufacturer ratings above.
          </p>
        </div>
      )}
    </div>
  )
}
