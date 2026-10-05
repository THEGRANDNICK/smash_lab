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
import WheelPicker from './WheelPicker'

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
  const known = (id?: string) => (id && items.some((s) => s.id === id) ? id : undefined)
  const defaultString = (items.find((s) => s.id === 'yonex-nanogy-99') ?? items[0]).id
  const [builds, setBuilds] = useState<Build[]>(() => {
    const a: Build = { balance: 'standard', stringId: known(preset?.stringId) ?? defaultString, tensionKg: preset?.tensionKg ?? 11 }
    const b = known(preset?.compareStringId)
    return b ? [a, { ...a, stringId: b }] : [a]
  })
  const [active, setActive] = useState(0)
  const build = builds[Math.min(active, builds.length - 1)]
  const [racketMaxKg, setRacketMaxKg] = useState<number | undefined>(preset?.racketMaxKg)
  // Packet data by default; Smash Lab's hands-on ratings only when switched on.
  const [source, setSource] = useState<'maker' | 'handsOn'>('maker')
  const string = items.find((s) => s.id === build.stringId) ?? items[0]
  const shelfOfString = useMemo(() => Object.fromEntries(items.map((s) => [s.id, shelfOf(s, profiles[s.id])])) as Record<string, ShelfId>, [items, profiles])
  const maxStated = (racketMaxKg ?? DEFAULT_RACKET_MAX_KG) - CROSS_OFFSET_KG

  const statsFor = (b: Build): SetupStats => {
    const s = items.find((x) => x.id === b.stringId) ?? items[0]
    return setupStats({ string: s, profile: profiles[s.id], tensionKg: b.tensionKg, balance: b.balance, pool: items, source })
  }
  const allStats = builds.map(statsFor)
  const stats = allStats[Math.min(active, builds.length - 1)]
  const [previous, setPrevious] = useState<SetupStats | null>(null)
  const [garage, setGarage] = useState<Build[]>([])

  function change(next: Partial<Build>) {
    setPrevious(stats)
    setBuilds((all) => all.map((b, i) => (i === active ? { ...b, ...next, tensionKg: Math.min(next.tensionKg ?? b.tensionKg, maxStated) } : b)))
  }

  // the strings wheel, in shelf order (Start here → Crisp control → Easy power → All-round)
  const wheelStrings = SHELVES.flatMap((sh) => items.filter((s) => shelfOfString[s.id] === sh.id))
  const provenance = provenanceOf(profiles[string.id])
  const whatsAppUrl = buildEnquiryWhatsAppUrl({
    stringName: `${string.brand} ${string.name}`,
    tensionKg: build.tensionKg,
    mainsKg: build.tensionKg - CROSS_OFFSET_KG,
    crossKg: build.tensionKg + CROSS_OFFSET_KG,
    racketMaxKg,
    racketBalance: BALANCE_WORDS[build.balance],
    dataSourceLabel: source === 'maker' ? 'Workshop · manufacturer data' : 'Workshop · manufacturer + Smash Lab hands-on',
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <header className="text-center max-w-2xl mx-auto">
        <span className="tape">Setup workshop</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">Build your setup</h1>
        <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">Scroll through rackets, strings and tensions — the bars show what each change does. Rules of thumb, not lab data.</p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Data source">
        {(
          [
            ['maker', 'Manufacturer data'],
            ['handsOn', '+ Smash Lab hands-on'],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={source === id}
            onClick={() => {
              setPrevious(stats)
              setSource(id)
            }}
            className={`focus-ring rounded-full border-2 px-4 py-1.5 text-sm font-semibold cursor-pointer ${
              source === id ? 'border-court-800 bg-court-800 text-white dark:border-shuttle-500 dark:bg-shuttle-500 dark:text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* rackets on top, bars below — pinned while you scroll through the parts */}
        <section aria-label="Your setup" className="paper min-w-0 p-4 sticky top-16 z-20 lg:top-24">
          <div className="flex justify-center gap-4">
            {builds.map((b, i) => {
              const s = items.find((x) => x.id === b.stringId) ?? items[0]
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  aria-label={`Edit racket ${i === 0 ? 'A' : 'B'}`}
                  className={`focus-ring rounded-xl p-1 cursor-pointer ${builds.length > 1 && i === active ? 'ring-2 ring-shuttle-500' : ''}`}
                >
                  <WorkshopRacket balance={b.balance} gauge={stringGauge(s) ?? 0.66} shelf={shelfOfString[s.id] ?? 'allRound'} tensionKg={b.tensionKg} stringKey={s.id} className="h-28 sm:h-36 w-auto mx-auto" />
                  {builds.length > 1 && (
                    <span className="block text-[11px] font-bold" style={{ color: i === 0 ? '#ef7410' : '#2f63c9' }}>
                      {i === 0 ? 'A' : 'B'} · {s.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/70">
            {builds.length > 1 ? `Editing racket ${active === 0 ? 'A' : 'B'} · ` : ''}
            {BALANCE_WORDS[build.balance]} · {string.name} · {formatKg(build.tensionKg - CROSS_OFFSET_KG)} / {formatKg(build.tensionKg + CROSS_OFFSET_KG)}
          </p>
          <ul className="mt-3 space-y-1.5" aria-label="What this setup does">
            {STAT_ORDER.map(({ key, label }) => (
              <li key={key} className="grid grid-cols-[4.75rem_1fr] items-center gap-2 text-[11px]">
                <span className="text-ink-700/80 dark:text-shuttle-100/80">
                  {label}
                  {stats.estimated.includes(key) && <span title="estimated from packet data">*</span>}
                </span>
                <span className="space-y-0.5">
                  {allStats.map((st, i) => (
                    <StatBar
                      key={i}
                      label={`${label}${builds.length > 1 ? ` (${i === 0 ? 'A' : 'B'})` : ''}`}
                      now={st.segments[key]}
                      before={i === active ? previous?.segments[key] : undefined}
                      color={builds.length > 1 ? (i === 0 ? 'bg-shuttle-500' : 'bg-[#2f63c9]') : 'bg-shuttle-500'}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {source === 'handsOn' && stats.estimated.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-700/70 dark:text-shuttle-100/70">
              * no hands-on rating yet — packet data used ({provenance.ratedCount} of 15 properties of {string.name} are rated).
            </p>
          )}
          <div className="mt-3 text-center">
            {builds.length < 2 ? (
              <button
                type="button"
                onClick={() => {
                  setBuilds((all) => [...all, { ...all[0] }])
                  setActive(1)
                }}
                className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-4 py-1.5 text-xs font-semibold cursor-pointer"
              >
                + Add a racket to compare
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBuilds((all) => [all[active === 1 ? 0 : 1]])
                  setActive(0)
                }}
                className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-4 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Remove racket {active === 0 ? 'A' : 'B'}
              </button>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-5">
          <section className="paper p-4 sm:p-5" aria-labelledby="ws-racket">
            <h2 id="ws-racket" className="font-display font-bold text-ink-900 dark:text-shuttle-50">1 · Racket <span className="font-normal text-sm text-ink-700/70 dark:text-shuttle-100/70">(optional)</span></h2>
            <div className="mt-3">
              <WheelPicker
                label="racket balance"
                items={BALANCES.map((b) => ({ id: b.id, label: b.label, sub: b.hint }))}
                value={build.balance}
                onChange={(id: string) => change({ balance: id as RacketBalance })}
              />
            </div>
          </section>

          <section className="paper p-4 sm:p-5" aria-labelledby="ws-string">
            <h2 id="ws-string" className="font-display font-bold text-ink-900 dark:text-shuttle-50">2 · String</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Jump to a shelf">
              {SHELVES.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => {
                    const first = wheelStrings.find((s) => shelfOfString[s.id] === sh.id)
                    if (first) change({ stringId: first.id })
                  }}
                  aria-pressed={shelfOfString[string.id] === sh.id}
                  className={`focus-ring shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1 text-xs font-semibold cursor-pointer ${
                    shelfOfString[string.id] === sh.id ? 'border-court-800 bg-court-800 text-white dark:border-shuttle-500 dark:bg-shuttle-500 dark:text-court-900' : 'border-court-900/15 dark:border-white/20 text-ink-900 dark:text-shuttle-50'
                  }`}
                >
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle" style={{ background: SHELF_COLOR[sh.id] }} />
                  {sh.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">{SHELVES.find((x) => x.id === shelfOfString[string.id])?.blurb}</p>
            <div className="mt-3">
              <WheelPicker
                label="string"
                rows={5}
                items={wheelStrings.map((s) => ({ id: s.id, label: `${s.brand} ${s.name}`, sub: stringGauge(s) != null ? `${stringGauge(s)} mm` : 'hybrid', swatch: SHELF_COLOR[shelfOfString[s.id]] }))}
                value={build.stringId}
                onChange={(id: string) => change({ stringId: id })}
              />
            </div>
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
                    setBuilds((all) => all.map((b) => ({ ...b, tensionKg: Math.min(b.tensionKg, kg - CROSS_OFFSET_KG) })))
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
                          <li key={key} className="grid grid-cols-[4rem_1fr] items-center gap-1 text-[10px] text-ink-700/80 dark:text-shuttle-100/80">
                            {label}
                            <StatBar label={label} now={st.segments[key]} compact />
                          </li>
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

/**
 * A six-segment bar (Mario Kart style). Gains since the previous pick glow green, losses show red;
 * the ±delta has a fixed-width column so it always stays inside the card.
 */
function StatBar({ label, now, before, compact = false, color = 'bg-shuttle-500' }: { label: string; now: number; before?: number; compact?: boolean; color?: string }) {
  const delta = before == null ? 0 : now - before
  return (
    <span className="flex items-center gap-1.5">
      <span role="img" className="flex gap-[2px]" aria-label={`${label}: ${now} of ${SEGMENTS}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const filled = i < now
          const gained = delta > 0 && i >= now - delta && i < now
          const lost = delta < 0 && i >= now && i < now - delta
          return (
            <span
              key={i}
              className={`${compact ? 'h-1.5 w-2.5' : 'h-2 w-3'} rounded-[2px] ${gained ? 'bg-emerald-500' : filled ? color : lost ? 'border border-red-500 bg-red-500/20' : 'bg-court-900/10 dark:bg-white/10'}`}
            />
          )
        })}
      </span>
      {!compact && (
        <span aria-hidden="true" className={`w-6 shrink-0 text-right font-bold tabular-nums ${delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {delta ? (delta > 0 ? `+${delta}` : delta) : ''}
        </span>
      )}
    </span>
  )
}
