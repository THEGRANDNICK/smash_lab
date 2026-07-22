import { motion } from 'framer-motion'
import Shuttlecock from './Shuttlecock'

interface ProgressBarProps {
  step: number
  total: number
}

export default function ProgressBar({ step, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.min(100, (step / total) * 100) : 0

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-xs font-medium text-court-800/70 dark:text-shuttle-100/70">
        <span>
          Question {Math.min(step + 1, total)} of {total}
        </span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-court-900/10 dark:bg-white/10 overflow-visible">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-shuttle-500 to-shuttle-400"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        <motion.div
          className="absolute -top-2.5 text-shuttle-600 drop-shadow"
          initial={false}
          animate={{ left: `calc(${percent}% - 12px)` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          aria-hidden="true"
        >
          <Shuttlecock className="w-6 h-6 rotate-90" />
        </motion.div>
      </div>
    </div>
  )
}
