import { useEffect, useState } from 'react'
import { isSoundEnabled, onSoundSettingChange, setSoundEnabled } from '../logic/sound'

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

/** Tap sounds on/off — always in the header, remembered on this device. */
export default function SoundToggle() {
  const [on, setOn] = useState(isSoundEnabled)
  useEffect(() => onSoundSettingChange(setOn), [])
  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? 'Sounds on — turn off' : 'Sounds off — turn on'}
      title={on ? 'Turn sounds off' : 'Turn sounds on'}
      data-sound="none"
      className="focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-court-900/15 dark:border-white/20 p-2 lg:px-3 text-ink-700/80 dark:text-shuttle-100/80 hover:text-ink-900 dark:hover:text-shuttle-50 cursor-pointer"
    >
      {on ? (
        <svg {...icon}>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
        </svg>
      ) : (
        <svg {...icon}>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        </svg>
      )}
      {/* the word makes the button's purpose obvious where there's room */}
      <span className="hidden lg:inline text-xs font-semibold">{on ? 'Sound on' : 'Sound off'}</span>
    </button>
  )
}
