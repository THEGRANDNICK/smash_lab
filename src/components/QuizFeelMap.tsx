import { useMemo } from 'react'
import { strings as builtInStrings, type StringItem } from '../data/strings'
import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { computeStringMapPosition } from '../logic/stringMapPosition'
import { inTheRunning } from '../logic/inTheRunning'
import type { QuizAnswers } from '../logic/types'

interface QuizFeelMapProps {
  answers: QuizAnswers
  pool?: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
  /** Phones: a short strip above the question instead of the full panel. */
  compact?: boolean
}

/**
 * The live feel map beside the quiz: every string is a tiny reel on a felt court, placed by feel
 * (soft ↔ hard, hold ↔ quick repulsion). As answers come in, strings that drop out of the running
 * tip over and fade — in stepped, stop-motion frames — and a counter tells the story
 * ("21 → 12 → 8 → 5"). The rule behind it is logic/inTheRunning.ts, so the map can never show
 * something the recommendation doesn't actually do.
 */
export default function QuizFeelMap({ answers, pool, specialistProfiles, compact = false }: QuizFeelMapProps) {
  const items = pool ?? builtInStrings
  const profiles = specialistProfiles ?? STRING_SPECIALIST_PROFILES
  const running = useMemo(() => inTheRunning(answers, items, profiles), [answers, items, profiles])
  const positions = useMemo(
    () => Object.fromEntries(items.map((s) => [s.id, computeStringMapPosition(s, profiles[s.id], true)])),
    [items, profiles],
  )

  const count = running.inIds.size
  const leader = items.find((s) => s.id === running.leaderId)

  return (
    <section aria-label="Strings still in the running" className={`paper p-3 ${compact ? '' : 'sm:p-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="tape">Feel map</span>
        <p aria-live="polite" className="text-xs font-semibold text-ink-700/80 dark:text-shuttle-100/80 tabular-nums">
          {count} of {running.total} <span className="font-normal">strings in the running</span>
        </p>
      </div>

      <div className={`felt relative overflow-hidden rounded-xl ${compact ? 'mt-3 h-28' : 'mt-3 aspect-[4/3]'}`}>
        {/* cream tape lines: the court, cut-out style */}
        <span aria-hidden="true" className="absolute inset-2 rounded-md border-[3px] border-[#f3e3b5]/80" />
        <span aria-hidden="true" className="absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-[#f3e3b5]/80" />
        <span aria-hidden="true" className="absolute top-1/2 left-2 right-2 h-[3px] -translate-y-1/2 bg-[#f3e3b5]/80" />
        {!compact && (
          <>
            <span aria-hidden="true" className="map-axis top-3">↑ hard</span>
            <span aria-hidden="true" className="map-axis bottom-3">↓ soft</span>
          </>
        )}

        {items.map((s) => {
          const pos = positions[s.id]
          if (!pos) return null
          const isIn = running.inIds.has(s.id)
          const isLeader = s.id === running.leaderId
          return (
            <span
              key={s.id}
              title={s.name}
              className={`map-reel ${isIn ? '' : 'map-reel-out'} ${isLeader ? 'map-reel-leader' : ''}`}
              style={{ left: `${8 + pos.holdRepulsion * 84}%`, top: `${8 + (1 - pos.softHard) * 84}%` }}
            >
              {isLeader && !compact && <span className={`map-reel-label ${pos.holdRepulsion > 0.55 ? 'map-reel-label-left' : ''}`}>{s.name}</span>}
            </span>
          )
        })}
      </div>

      {!compact && (
        <p aria-hidden="true" className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-700/70 dark:text-shuttle-100/70">
          <span>← hold</span>
          <span>lively →</span>
        </p>
      )}
      {leader && (
        <p className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">
          Leading right now: <strong className="text-ink-900 dark:text-shuttle-50">{leader.name}</strong>
        </p>
      )}
    </section>
  )
}
