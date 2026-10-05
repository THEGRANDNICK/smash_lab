import type { ReactNode } from 'react'
import FAQ from './FAQ'
import Contact from './Contact'
import { cutEllipse, cutPolygon } from '../logic/scissors'
import { DEFAULT_RACKET_MAX_KG, LEVEL_BASE_RANGES } from '../config/tensionRules'
import { formatKg } from '../logic/units'

/**
 * "Knowledge": what actually matters when choosing a string and a tension, in five cut-paper
 * cards. Replaces the old marketing sections (How it works, Why Smash Lab, restring tip).
 * Content: Badminton Insight, "What Badminton String & Tension Should You Use?" (Aug 2026), plus
 * the stringer's own practice for club players (tension cap). Numbers come from
 * config/tensionRules.ts, so this page can't drift from what the recommendation actually does.
 */
const VIDEO = 'https://www.youtube.com/watch?v=Z09cXPwU-n0'

export default function StringKnowledge() {
  const club = LEVEL_BASE_RANGES.intermediate
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
      <header className="text-center max-w-2xl mx-auto">
        <span className="tape">String knowledge</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">What actually matters</h1>
        <p className="mt-3 text-ink-700/80 dark:text-shuttle-100/80">Five things worth knowing before your next restring — short, practical, no marketing.</p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <KnowledgeCard title="Gauge — the thickness" art={<GaugeArt />} index={0} source={{ href: `${VIDEO}&t=42s`, at: '0:42' }}>
          <p>Most strings are 0.58–0.70 mm. Thicker usually lasts longer; thinner feels livelier, sounds crisper and tends to break sooner. Usually — the material matters too: some 0.68 mm strings are built specifically for durability.</p>
          <p>
            <strong>Beginners:</strong> around 0.70 mm. <strong>Improving players:</strong> 0.68 mm or thinner. Hard hitters who often mishit are better off thicker.
          </p>
        </KnowledgeCard>

        <KnowledgeCard title="Feel — hard, medium, soft" art={<FeelArt />} index={1} source={{ href: `${VIDEO}&t=166s`, at: '2:46' }}>
          <p>A hard string gives sharp, direct feedback on impact; a soft one feels cushioned; medium sits in between. Two strings of the same gauge can feel very different — the core and coating matter too.</p>
        </KnowledgeCard>

        <KnowledgeCard title="Texture — smooth or rough" art={<TextureArt />} index={2} source={{ href: `${VIDEO}&t=201s`, at: '3:21' }}>
          <p>A rougher surface grips the cork more: slices, spinning net shots and touch play feel more controlled. The extra friction wears the string a little faster.</p>
        </KnowledgeCard>

        <KnowledgeCard title="Tension — tighter isn't better" art={<TensionArt />} index={3} source={{ href: `${VIDEO}&t=371s`, at: '6:11' }}>
          <p>Lower tension gives a bigger sweet spot and easier power and forgives off-centre hits. Higher tension gives more control — if you hit the centre consistently.</p>
          <p>
            <strong>Club players (Smash Lab's stringing practice):</strong> around {formatKg(club.target)}, at most {formatKg(club.max)} — most Yonex rackets allow {formatKg(DEFAULT_RACKET_MAX_KG)}, so that leaves a little safety room. A thinner string goes a little lower. <strong>Tournament players:</strong> from 27 lb (≈12.3 kg) — the video's presenters string at 29–30 lb (≈13.2–13.6 kg) — but only if your racket's maximum allows it. Not sure? Start lower and add 0.5 kg per restring.
          </p>
        </KnowledgeCard>

        <KnowledgeCard title="Ageing — when to restring" art={<AgeingArt />} index={4} wide source={{ href: `${VIDEO}&t=616s`, at: '10:16' }}>
          <p>
            Strings lose tension and their coating wears off: the sound gets duller, the bed softer and the strings start to shift — that's your real signal. As a <strong>rough guide, not a schedule</strong>:
            restrings per year ≈ sessions per week (three times a week → about three restrings a year). Thin strings and tensions above about 11 kg (24 lb) tend to break sooner.
          </p>
        </KnowledgeCard>
      </div>

      <p className="mt-6 text-center text-xs text-ink-700/70 dark:text-shuttle-100/70">
        Based on{' '}
        <a href={VIDEO} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-900 dark:hover:text-shuttle-50">
          Badminton Insight — “What Badminton String &amp; Tension Should You Use?” (YouTube, 2026)
        </a>{' '}
        (timestamps on each card) and hands-on stringing for club players. Rules of thumb, not lab measurements.
      </p>

      <section className="paper mt-10 p-5 sm:p-6 text-sm text-ink-700/90 dark:text-shuttle-100/90" aria-labelledby="how-we-rate">
        <span className="tape">Transparency</span>
        <h2 id="how-we-rate" className="mt-3 font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">How Smash Lab rates strings</h2>
        <ul className="mt-3 space-y-2 list-disc pl-5">
          <li>
            Two kinds of ratings: the <strong>manufacturer's</strong> (0–11, from the packet) and <strong>hands-on</strong> ratings (1–5) — mostly from one stringer, plus imported community research where available. Each string's page and the
            stringing bench show how many of its 15 properties are rated and by whom.
          </li>
          <li>
            Hands-on ratings may shift a result by up to 80% — set deliberately high, because packet ratings are inflated (most strings score 8–11 of 11). The flip side: one person's experience matters a lot. The value was raised
            from 65% when the rater's own long-time main string, BG80, could not win for attacking players — so read BG80 results with that in mind.
          </li>
          <li>Strings nobody has rated by hand are ranked <strong>cautiously</strong>: their unknown properties count as an unproven 3/5, because hands-on ratings usually come in below the packet's.</li>
          <li>Scores are <strong>ranking scores, not probabilities</strong>. Small gaps (0–2 points) are called a close call: they flip easily when ratings change slightly.</li>
          <li>Smash Lab can put you in touch with its stringer — that's a personal interest, so the ranking never looks at stock or who strings your racket.</li>
          <li>
            Method and measurements are reproducible:{' '}
            <a href="https://github.com/THEGRANDNICK/smash_lab/tree/main/scripts/analysis" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              scripts/analysis on GitHub
            </a>
            .
          </li>
        </ul>
      </section>

      <FAQ />
      <div id="knowledge-contact">
        <Contact />
      </div>
    </div>
  )
}

function KnowledgeCard({ title, art, children, index, wide = false, source }: { title: string; art: ReactNode; children: ReactNode; index: number; wide?: boolean; source?: { href: string; at: string } }) {
  return (
    <article className={`paper deal p-5 sm:p-6 flex gap-4 ${wide ? 'sm:col-span-2' : ''}`} style={{ ['--deal-i' as string]: index }}>
      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20" aria-hidden="true">
        {art}
      </div>
      <div className="min-w-0 space-y-2 text-sm text-ink-700/90 dark:text-shuttle-100/90">
        <h2 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">{title}</h2>
        {children}
        {source && (
          <p className="text-xs">
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-ink-700/70 dark:text-shuttle-100/70 hover:text-ink-900 dark:hover:text-shuttle-50">
              ▶ In the video at {source.at}
            </a>
          </p>
        )}
      </div>
    </article>
  )
}

/* Small cut-paper illustrations — same scissor helper as the stage, so they share its hand. */
const svg = { viewBox: '0 0 80 80', width: '100%', height: '100%' }

function GaugeArt() {
  return (
    <svg {...svg}>
      <path d={cutEllipse(40, 40, 36, 36, 901, 14, 0.04)} className="fill-[#f3e3b5]" />
      <path d={cutPolygon([[18, 14], [21, 14], [21, 66], [18, 66]], 902, 0.4)} className="fill-court-700" />
      <path d={cutPolygon([[36, 14], [44, 14], [44, 66], [36, 66]], 903, 0.6)} className="fill-court-700" />
      <path d={cutPolygon([[56, 14], [66, 14], [66, 66], [56, 66]], 904, 0.8)} className="fill-court-700" />
    </svg>
  )
}

function FeelArt() {
  return (
    <svg {...svg}>
      <path d={cutEllipse(40, 40, 36, 36, 911, 14, 0.04)} className="fill-[#f3e3b5]" />
      <path d={cutPolygon([[14, 52], [30, 52], [30, 58], [14, 58]], 912, 0.6)} className="fill-[#d5523b]" />
      <path d={cutPolygon([[32, 50], [48, 50], [48, 58], [32, 58]], 913, 0.6)} className="fill-[#ffb830]" />
      <path d={cutEllipse(58, 50, 9, 6, 914, 9, 0.05)} className="fill-court-600" />
      <path d={cutPolygon([[20, 22], [24, 22], [24, 46], [20, 46]], 915, 0.5)} className="fill-ink-700" />
    </svg>
  )
}

function TextureArt() {
  return (
    <svg {...svg}>
      <path d={cutEllipse(40, 40, 36, 36, 921, 14, 0.04)} className="fill-[#f3e3b5]" />
      <path d={cutPolygon([[10, 30], [70, 30], [70, 36], [10, 36]], 922, 0.4)} className="fill-court-700" />
      <path d="M10 48 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4" className="stroke-court-700 fill-none" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}

function TensionArt() {
  return (
    <svg {...svg}>
      <path d={cutEllipse(40, 34, 24, 30, 931, 14, 0.04)} className="fill-[#d5523b]" />
      <path d={cutEllipse(40, 34, 18, 24, 932, 12, 0.03)} className="fill-[#fffaf0]" />
      {[30, 36, 42, 48].map((x) => (
        <path key={x} d={`M${x} 12 L${x} 56`} className="stroke-ink-700/60" strokeWidth="1.4" />
      ))}
      {[22, 28, 34, 40, 46].map((y) => (
        <path key={y} d={`M24 ${y} L56 ${y}`} className="stroke-ink-700/60" strokeWidth="1.4" />
      ))}
      <path d={cutPolygon([[37, 62], [43, 62], [43, 78], [37, 78]], 933, 0.5)} className="fill-ink-700" />
    </svg>
  )
}

function AgeingArt() {
  return (
    <svg {...svg}>
      <path d={cutPolygon([[12, 16], [68, 16], [68, 70], [12, 70]], 941, 1.2)} className="fill-[#fffaf0] stroke-ink-700/30" strokeWidth="1.5" />
      <path d={cutPolygon([[12, 16], [68, 16], [68, 28], [12, 28]], 942, 0.8)} className="fill-[#d5523b]" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={18 + c * 12} y={34 + r * 11} width="8" height="7" rx="1.5" className={r * 4 + c < 3 ? 'fill-court-600' : 'fill-ink-700/15'} />),
      )}
    </svg>
  )
}
