import type { StringItem } from '../data/strings'
import { stringPagePath } from '../logic/stringPages'
import { writeWorkshopPreset } from '../logic/workshopPreset'
import ImageSwiper from './ImageSwiper'

interface HomeBasicsProps {
  strings: StringItem[]
  onQuiz: () => void
  onDetailedQuiz: () => void
}

/**
 * The short version, before any quiz: most players are well served by one of two classics.
 * Not sure → a thicker, durable string (BG65). A bit more advanced → thinner, harder, more control
 * (BG80). Everything else → the quiz, which tries its best and shows its reasoning.
 */
export default function HomeBasics({ strings, onQuiz, onDetailedQuiz }: HomeBasicsProps) {
  const bg65 = strings.find((s) => s.id === 'yonex-bg65')
  const bg80 = strings.find((s) => s.id === 'yonex-bg80')

  const tryIt = (id: string, tensionKg: number) => {
    writeWorkshopPreset(typeof window === 'undefined' ? null : window.sessionStorage, { stringId: id, tensionKg })
    window.location.hash = 'workshop'
  }

  return (
    <section aria-labelledby="basics-heading" className="max-w-6xl mx-auto px-4 py-8 sm:py-16">
      <div className="text-center max-w-2xl mx-auto">
        <span className="tape">The short version</span>
        <h2 id="basics-heading" className="mt-3 font-display text-2xl sm:text-4xl font-bold text-ink-900 dark:text-shuttle-50">
          Most players need one of two strings
        </h2>
      </div>

      <div className="mt-5 sm:mt-8 grid gap-3 sm:gap-5 md:grid-cols-3">
        <BasicsCard
          index={0}
          title="Not sure? Go thicker."
          item={bg65}
          text="A thicker string (around 0.70 mm) lasts longer and forgives off-centre hits — the safe choice while you're learning, or if you just want it to last. The most popular one:"
          pick="Yonex BG65"
          onTry={bg65 ? () => tryIt(bg65.id, 10.5) : undefined}
        />
        <BasicsCard
          index={1}
          title="A bit more advanced?"
          item={bg80}
          text="Thinner strings (about 0.68 mm and below) feel harder and more direct: more control and a bit more power — but they break sooner. Very popular across the badminton world:"
          pick="Yonex BG80"
          onTry={bg80 ? () => tryIt(bg80.id, 11.5) : undefined}
        />
        <article className="paper deal p-4 sm:p-5 flex flex-col" style={{ ['--deal-i' as string]: 2 }}>
          <h3 className="font-display text-xl font-bold text-ink-900 dark:text-shuttle-50">Everything else: take the quiz</h3>
          <p className="mt-2 text-sm text-ink-700/90 dark:text-shuttle-100/90">
            Four quick questions about how you play. It can't promise to be perfect — but it tries, shows its reasoning, and you can fine-tune the result afterwards.
          </p>
          <div className="mt-auto pt-5 flex flex-col gap-2">
            <button type="button" onClick={onQuiz} data-sound="pluck" className="press focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold px-5 py-2.5 cursor-pointer">
              Find my string
            </button>
            <button
              type="button"
              onClick={onDetailedQuiz}
              className="press focus-ring rounded-full border-2 border-shuttle-500 bg-shuttle-100 hover:bg-shuttle-400/40 dark:bg-shuttle-500/15 px-5 py-2 text-sm font-bold text-court-900 dark:text-shuttle-50 cursor-pointer"
            >
              Detailed quiz (8 questions)
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}

function BasicsCard({ index, title, item, text, pick, onTry }: { index: number; title: string; item?: StringItem; text: string; pick: string; onTry?: () => void }) {
  return (
    <article className="paper deal p-4 sm:p-5 flex flex-col" style={{ ['--deal-i' as string]: index }}>
      <div className="flex items-start gap-4">
        <div className="w-16 sm:w-24 shrink-0">
          <ImageSwiper front={item?.imageUrl} back={item?.imageBackUrl} label={pick} placeholderText={item?.name ?? pick} />
        </div>
        <h3 className="font-display text-lg sm:text-xl font-bold text-ink-900 dark:text-shuttle-50">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-ink-700/90 dark:text-shuttle-100/90">
        {text} <strong className="text-ink-900 dark:text-shuttle-50">{pick}</strong>.
      </p>
      <div className="mt-auto pt-4 sm:pt-5 flex flex-wrap gap-2">
        {item && (
          <a href={`${import.meta.env.BASE_URL}${stringPagePath(item.id)}`} className="press focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 px-4 py-2 text-sm font-semibold text-ink-900 dark:text-shuttle-50">
            About {item.name}
          </a>
        )}
        {onTry && (
          <button type="button" onClick={onTry} className="press focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 px-4 py-2 text-sm font-bold cursor-pointer">
            Try in Workshop
          </button>
        )}
      </div>
    </article>
  )
}
