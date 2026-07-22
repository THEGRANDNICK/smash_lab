import { motion } from 'framer-motion'
import Shuttlecock from './Shuttlecock'

interface HeroProps {
  onOpenFinder: () => void
  onOpenCompare: () => void
}

export default function Hero({ onOpenFinder, onOpenCompare }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-court-900 to-court-800 text-white">
      <div className="absolute inset-0 court-lines opacity-20" aria-hidden="true" />
      <motion.div
        className="absolute -top-4 right-8 sm:right-24 text-shuttle-400/50 animate-float"
        aria-hidden="true"
      >
        <Shuttlecock className="w-16 h-16 sm:w-24 sm:h-24" />
      </motion.div>
      <motion.div
        className="absolute bottom-10 left-4 sm:left-16 text-shuttle-400/30 animate-drift"
        aria-hidden="true"
      >
        <Shuttlecock className="w-10 h-10 sm:w-14 sm:h-14" />
      </motion.div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-shuttle-400 font-semibold tracking-widest uppercase text-sm"
        >
          Local badminton stringing
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-4xl sm:text-6xl font-bold mt-4 leading-tight"
        >
          Not sure which string
          <br />
          fits your game?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-white/70 max-w-xl mx-auto"
        >
          Take a 60-second quiz and get a matched string + tension setup, strung by hand — built around how you actually play.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            type="button"
            onClick={onOpenFinder}
            className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 text-court-900 font-bold px-8 py-4 text-lg transition-transform hover:scale-105 cursor-pointer shadow-lg shadow-shuttle-500/20"
          >
            🏸 Find My Perfect String
          </button>
          <button
            type="button"
            onClick={onOpenCompare}
            className="focus-ring rounded-full border-2 border-white/30 hover:border-white/60 font-semibold px-8 py-4 text-lg transition-colors cursor-pointer"
          >
            Browse Strings
          </button>
        </motion.div>
      </div>
    </section>
  )
}
