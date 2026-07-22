import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Shuttlecock from './Shuttlecock'

const MESSAGES = ['Measuring your swing speed...', 'Weighing power vs control...', 'Cross-checking durability...', 'Stringing up your match...']

interface CalculatingAnimationProps {
  onDone: () => void
  durationMs?: number
}

export default function CalculatingAnimation({ onDone, durationMs = 2200 }: CalculatingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1))
    }, durationMs / MESSAGES.length)
    const doneTimer = setTimeout(onDone, durationMs)
    return () => {
      clearInterval(messageTimer)
      clearTimeout(doneTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status" aria-live="polite">
      <motion.div
        className="text-court-800 dark:text-shuttle-400"
        animate={{ rotate: [0, 15, -10, 15, 0], y: [0, -10, 0, -6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Shuttlecock className="w-16 h-16" />
      </motion.div>
      <p className="font-display text-xl font-semibold mt-6 text-ink-900 dark:text-shuttle-50">Calculating your perfect string…</p>
      <motion.p key={messageIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink-700/60 dark:text-shuttle-100/60 mt-2 h-6">
        {MESSAGES[messageIndex]}
      </motion.p>
      <div className="flex gap-1.5 mt-6" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-shuttle-500"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}
