import { useRef, useState } from 'react'

interface ImageSwiperProps {
  front?: string
  back?: string
  /** e.g. "Yonex BG80" — becomes "Yonex BG80 — packet, front/back". */
  label: string
  /** Shown big when there's no image yet. */
  placeholderText: string
  className?: string
}

/**
 * Front/back packet photos. Swipe on touch screens (native scroll-snap, no gesture library),
 * tap the dots or use the arrow keys elsewhere. With no images it shows a calm typographic
 * placeholder instead of an empty box, so tiles keep the same shape either way.
 */
export default function ImageSwiper({ front, back, label, placeholderText, className = '' }: ImageSwiperProps) {
  const images = [front && { src: front, side: 'front' }, back && { src: back, side: 'back' }].filter(Boolean) as { src: string; side: string }[]
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className={`aspect-square rounded-xl bg-gradient-to-br from-court-800 to-court-700 flex items-center justify-center p-4 ${className}`} aria-hidden="true">
        <span className="font-display text-2xl sm:text-3xl font-bold text-white/90 text-center leading-tight">{placeholderText}</span>
      </div>
    )
  }

  function go(i: number) {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scroller}
        className="aspect-square rounded-xl bg-white flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
        tabIndex={images.length > 1 ? 0 : -1}
        role={images.length > 1 ? 'group' : undefined}
        aria-label={images.length > 1 ? `${label} packet photos — use arrow keys to switch` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(Math.min(images.length - 1, index + 1))
          if (e.key === 'ArrowLeft') go(Math.max(0, index - 1))
        }}
      >
        {images.map((img) => (
          <img
            key={img.side}
            src={img.src}
            alt={`${label} — packet, ${img.side}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full shrink-0 snap-center object-contain p-2"
            draggable={false}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.side}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${img.side}`}
              aria-pressed={index === i}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${index === i ? 'w-5 bg-court-800' : 'w-2.5 bg-court-800/30 hover:bg-court-800/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
