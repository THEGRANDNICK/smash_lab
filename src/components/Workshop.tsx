import { useMemo, useState } from 'react'
import { strings as builtInStrings, type StringItem } from '../data/strings'
import { STRING_SPECIALIST_PROFILES, type StringSpecialistProfile } from '../data/stringSpecialistProfiles'
import { CROSS_OFFSET_KG, DEFAULT_RACKET_MAX_KG } from '../config/tensionRules'
import { CONTACT } from '../data/contact'
import { buildEnquiryWhatsAppUrl } from '../logic/contactMessage'
import { provenanceOf } from '../logic/provenance'
import { SEGMENTS, SHELF_COLOR, SHELVES, STAT_ORDER, setupStats, shelfOf, stringGauge, type RacketBalance, type SetupStats, type ShelfId } from '../logic/setupStats'
import { formatKg, formatLbs } from '../logic/units'
import { readWorkshopPreset } from '../logic/workshopPreset'
import WorkshopRacket from './WorkshopRacket'

const BALANCES: { id: RacketBalance; label: string; hint: string }[] = [
  { id: 'standard', label: "Don't know", hint: 'a standard, even-balanced racket' },
  { id: 'headHeavy', label: 'Head-heavy', hint: 'more power, slower handling' },
  { id: 'even', label: 'Even balance', hint: 'all-round' },
  { id: 'headLight', label: 'Head-light', hint: 'fast handling, less power' },
]
const BALANCE_WORDS: Record<RacketBalance, string> = { standard: 'standard', headHeavy: 'head-heavy', even: 'even balance', headLight: 'head-light' }

interface Build {
  balance: RacketBalance
  stringId: string
  tensionKg: number
}

interface WorkshopProps {
  pool?: StringItem[]
  specialistProfiles?: Record<string, StringSpecialistProfile>
}

/**
 * The Setup Workshop — Mario Kart for badminton setups. Pick a racket balance, a string and a
 * tension; the paper racket changes with every pick and six bars show what it does, with the change
 * against your previous pick highlighted (green = gained, red = lost). Save up to three builds in the
 * garage to compare. Opens with the quiz's recommendation when you come from a result.
 */
export default function Workshop({ pool, specialistProfiles }: WorkshopProps) {
  const items = pool ?? builtInStrings
  const profiles = specialistProfiles ?? STRING_SPECIALIST_PROFILES
  const [preset] = useState(() => readWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage))
  const [build, setBuild] = useState<Build>(() => ({
    balance: 'standard',
    stringId: preset?.stringId && items.some((s) => s.id === preset.stringId) ? preset.stringId : (items.find((s) => s.id === 'yonex-nanogy-99') ?? items[0]).id,
    tensionKg: preset?.tensionKg ?? 11,
  }))
  const [racketMaxKg, setRacketMaxKg] = useState<number | undefined>(preset?.racketMaxKg)
  const string = items.find((s) => s.id === build.stringId) ?? items[0]
  const shelfOfString = useMemo(() => Object.fromEntries(items.map((s) => [s.id, shelfOf(s, profiles[s.id])])) as Record<string, ShelfId>, [items, profiles])
  const [shelf, setShelf] = useState<ShelfId>(shelfOfString[string.id] ?? 'startHere')
  const maxStated = (racketMaxKg ?? DEFAULT_RACKET_MAX_KG) - CROSS_OFFSET_KG

  const statsFor = (b: Build): SetupStats => {
    const s = items.find((x) => x.id === b.stringId) ?? items[0]
    return setupStats({ string: s, profile: profiles[s.id], tensionKg: b.tensionKg, balance: b.balance, pool: items })
  }
  const stats = statsFor(build)
  const [previous, setPrevious] = useState<SetupStats | null>(null)
  const [garage, setGarage] = useState<Build[]>([])

  function change(next: Partial<Build>) {
    setPrevious(stats)
    setBuild((b) => ({ ...b, ...next, tensionKg: Math.min(next.tensionKg ?? b.tensionKg, maxStated) }))
  }

  const provenance = provenanceOf(profiles[string.id])
  const whatsAppUrl = buildEnquiryWhatsAppUrl({
    stringName: `${string.brand} ${string.name}`,
    tensionKg: build.tensionKg,
    mainsKg: build.tensionKg - CROSS_OFFSET_KG,
    crossKg: build.tensionKg + CROSS_OFFSET_KG,
    racketMaxKg,
    racketBalance: BALANCE_WORDS[build.balance],
    dataSourceLabel: 'Built in the Smash Lab workshop',
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center max-w-2xl mx-auto">
        <span className="tape">Setup workshop</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">Build your setup</h1>
        <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">Pick a racket, a string and a tension — the bars show what each change does. Rules of thumb, not lab data.</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* the racket + stats: pinned while you scroll through the parts */}
        <section aria-label="Your setup" className="paper min-w-0 p-4 sticky top-16 z-20 lg:top-24">
          <div className="flex gap-4 items-center">
            <WorkshopRacket
              balance={build.balance}
              gauge={stringGauge(string) ?? 0.66}
              shelf={shelfOfString[string.id] ?? 'allRound'}
              tensionKg={build.tensionKg}
              stringKey={string.id}
              className="w-20 sm:w-28 lg:w-32 shrink-0 h-auto"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">{BALANCE_WORDS[build.balance]} racket</p>
              <p className="font-display font-bold text-ink-900 dark:text-shuttle-50 leading-tight">{string.brand} {string.name}</p>
              <p className="text-xs text-ink-700/80 dark:text-shuttle-100/80">
                {formatKg(build.tensionKg - CROSS_OFFSET_KG)} mains / {formatKg(build.tensionKg + CROSS_OFFSET_KG)} crosses
              </p>
              <ul className="mt-2 space-y-1" aria-label="What this setup does">
                {STAT_ORDER.map(({ key, label }) => (
                  <StatBar key={key} label={label} now={stats.segments[key]} before={previous?.segments[key]} estimated={stats.estimated.includes(key)} />
                ))}
              </ul>
            </div>
          </div>
          {stats.estimated.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-700/70 dark:text-shuttle-100/70">
              * estimated from packet data — {provenance.ratedCount} of 15 properties of this string have hands-on ratings.
            </p>
          )}
        </section>

        {/* min-w-0: grid items default to their content width — the swipeable shelf row would widen the page */}
        <div className="min-w-0 space-y-5">
          <section className="paper p-4 sm:p-5" aria-labelledby="ws-racket">
            <h2 id="ws-racket" className="font-display font-bold text-ink-900 dark:text-shuttle-50">1 · Racket <span className="font-normal text-sm text-ink-700/70 dark:text-shuttle-100/70">(optional)</span></h2>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BALANCES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={build.balance === b.id}
                  onClick={() => change({ balance: b.id })}
                  className={`press focus-ring rounded-xl border-2 px-3 py-2 text-left cursor-pointer ${
                    build.balance === b.id ? 'border-shuttle-500 bg-shuttle-100 dark:bg-shuttle-500/15' : 'border-court-900/10 dark:border-white/15 card-stock'
                  }`}
                >
                  <span className="block text-sm font-semibold text-ink-900 dark:text-shuttle-50">{b.label}</span>
                  <span className="block text-[11px] text-ink-700/70 dark:text-shuttle-100/70">{b.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="paper p-4 sm:p-5" aria-labelledby="ws-string">
            <h2 id="ws-string" className="font-display font-bold text-ink-900 dark:text-shuttle-50">2 · String</h2>
            <div role="tablist" aria-label="String shelves" className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {SHELVES.map((sh) => (
                <button
                  key={sh.id}
                  role="tab"
                  type="button"
                  aria-selected={shelf === sh.id}
                  onClick={() => setShelf(sh.id)}
                  className={`focus-ring shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer ${
                    shelf === sh.id ? 'border-court-800 bg-court-800 text-white dark:border-shuttle-500 dark:bg-shuttle-500 dark:text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
                  }`}
                >
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ background: SHELF_COLOR[sh.id] }} />
                  {sh.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">{SHELVES.find((x) => x.id === shelf)?.blurb}</p>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items
                .filter((s) => shelfOfString[s.id] === shelf)
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={build.stringId === s.id}
                      onClick={() => change({ stringId: s.id })}
                      className={`press focus-ring w-full rounded-xl border-2 px-3 py-2 text-left cursor-pointer ${
                        build.stringId === s.id ? 'border-shuttle-500 bg-shuttle-100 dark:bg-shuttle-500/15' : 'border-court-900/10 dark:border-white/15 card-stock'
                      }`}
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-shuttle-700 dark:text-shuttle-400">{s.brand}</span>
                      <span className="block text-sm font-semibold text-ink-900 dark:text-shuttle-50">{s.name}</span>
                      <span className="block text-[11px] text-ink-700/70 dark:text-shuttle-100/70">{stringGauge(s) != null ? `${stringGauge(s)} mm` : 'hybrid'}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>

          <section className="paper p-4 sm:p-5" aria-labelledby="ws-tension">
            <h2 id="ws-tension" className="font-display font-bold text-ink-900 dark:text-shuttle-50">3 · Tension</h2>
            <p className="mt-2 font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">
              {formatKg(build.tensionKg - CROSS_OFFSET_KG)} mains / {formatKg(build.tensionKg + CROSS_OFFSET_KG)} crosses
            </p>
            <p className="text-sm text-ink-700/70 dark:text-shuttle-100/70">Average {formatKg(build.tensionKg)} (≈ {formatLbs(build.tensionKg)})</p>
            <label className="block mt-3">
              <span className="sr-only">Tension</span>
              <input
                type="range"
                min={8}
                max={maxStated}
                step={0.5}
                value={Math.min(build.tensionKg, maxStated)}
                onChange={(e) => change({ tensionKg: Number(e.target.value) })}
                className="w-full accent-shuttle-500"
              />
            </label>
            <p className="flex justify-between text-[11px] text-ink-700/70 dark:text-shuttle-100/70">
              <span>{formatKg(8)} · forgiving</span>
              <span>max {formatKg(maxStated)} · crisp</span>
            </p>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-ink-900 dark:text-shuttle-50">My racket's max:</span>
              <input
                type="number"
                inputMode="numeric"
                min={14}
                max={40}
                defaultValue={racketMaxKg ? Math.round(racketMaxKg / 0.45359237) : undefined}
                placeholder="e.g. 28"
                className="focus-ring w-20 rounded-lg border-2 border-court-900/20 dark:border-white/25 card-stock px-2 py-1 text-ink-900 dark:text-shuttle-50"
                onBlur={(e) => {
                  const lbs = Number(e.target.value)
                  if (Number.isFinite(lbs) && lbs >= 14 && lbs <= 40) {
                    const kg = Math.round(lbs * 0.45359237 * 10) / 10
                    setRacketMaxKg(kg)
                    setBuild((b) => ({ ...b, tensionKg: Math.min(b.tensionKg, kg - CROSS_OFFSET_KG) }))
                  }
                }}
              />
              <span className="text-ink-700/80 dark:text-shuttle-100/80">lbs {racketMaxKg ? '✓' : '— not checked, 12.5 kg assumed'}</span>
            </label>
          </section>

          <section className="paper p-4 sm:p-5" aria-labelledby="ws-garage">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="ws-garage" className="font-display font-bold text-ink-900 dark:text-shuttle-50">Garage</h2>
              <button
                type="button"
                disabled={garage.length >= 3}
                onClick={() => setGarage((g) => [...g, build].slice(-3))}
                className="press focus-ring rounded-full border-2 border-court-900/20 dark:border-white/25 px-4 py-1.5 text-sm font-semibold cursor-pointer disabled:opacity-40"
              >
                + Save this build {garage.length >= 3 ? '(full)' : `(${garage.length}/3)`}
              </button>
            </div>
            {garage.length === 0 ? (
              <p className="mt-2 text-sm text-ink-700/70 dark:text-shuttle-100/70">Save up to three builds to compare them side by side.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {garage.map((g, i) => {
                  const s = items.find((x) => x.id === g.stringId)
                  const st = statsFor(g)
                  return (
                    <li key={i} className="rounded-xl border-2 border-court-900/10 dark:border-white/15 p-3">
                      <p className="text-[11px] text-ink-700/70 dark:text-shuttle-100/70">{BALANCE_WORDS[g.balance]} · {formatKg(g.tensionKg)}</p>
                      <p className="font-semibold text-ink-900 dark:text-shuttle-50">{s?.name}</p>
                      <ul className="mt-1 space-y-0.5">
                        {STAT_ORDER.map(({ key, label }) => (
                          <StatBar key={key} label={label} now={st.segments[key]} compact />
                        ))}
                      </ul>
                      <div className="mt-2 flex gap-3 text-xs font-semibold">
                        <button type="button" onClick={() => change(g)} className="focus-ring underline cursor-pointer text-court-800 dark:text-shuttle-400">
                          Load
                        </button>
                        <button type="button" onClick={() => setGarage((all) => all.filter((_, j) => j !== i))} className="focus-ring underline cursor-pointer text-ink-700/80 dark:text-shuttle-100/80">
                          Remove
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-sound="pluck"
              className="press focus-ring block rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 text-center font-bold py-3"
            >
              💬 Ask {CONTACT.name} to string this · WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/** A six-segment bar (Mario Kart style). Gains since the previous pick glow green, losses show red. */
function StatBar({ label, now, before, estimated = false, compact = false }: { label: string; now: number; before?: number; estimated?: boolean; compact?: boolean }) {
  const delta = before == null ? 0 : now - before
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span className={`${compact ? 'w-16' : 'w-[4.6rem]'} shrink-0 text-ink-700/80 dark:text-shuttle-100/80`}>
        {label}
        {estimated && <span title="estimated from packet data">*</span>}
      </span>
      <span role="img" className="flex gap-[3px]" aria-label={`${label}: ${now} of ${SEGMENTS}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const filled = i < now
          const gained = delta > 0 && i >= now - delta && i < now
          const lost = delta < 0 && i >= now && i < now - delta
          return (
            <span
              key={i}
              className={`${compact ? 'h-1.5 w-2.5' : 'h-2 w-3.5'} rounded-[2px] ${
                gained ? 'bg-emerald-500' : filled ? 'bg-shuttle-500' : lost ? 'border border-red-500 bg-red-500/20' : 'bg-court-900/10 dark:bg-white/10'
              }`}
            />
          )
        })}
      </span>
      {!compact && delta !== 0 && (
        <span className={`font-bold tabular-nums ${delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </li>
  )
}

