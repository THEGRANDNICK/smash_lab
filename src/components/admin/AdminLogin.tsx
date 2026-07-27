import { useState } from 'react'
import Shuttlecock from '../Shuttlecock'

interface AdminLoginProps {
  onSignIn: (email: string, password: string) => Promise<void>
}

type SubmitState = 'idle' | 'submitting' | 'error'

export default function AdminLogin({ onSignIn }: AdminLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return // prevent duplicate submissions
    setState('submitting')
    setError(null)
    try {
      await onSignIn(email.trim(), password)
      // No need to set state back to 'idle' on success — the parent's
      // auth hook will transition away from this component entirely.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.'
      setError(/invalid login credentials/i.test(message) ? 'Incorrect email or password.' : message)
      setState('error')
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 font-display font-bold text-xl text-ink-900 dark:text-shuttle-50">
          <Shuttlecock className="w-6 h-6 text-shuttle-500" />
          Smash Lab Admin
        </div>
        <p className="text-ink-700/60 dark:text-shuttle-100/60 text-sm mt-2">Sign in to manage inventory.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 space-y-4">
        <div>
          <label htmlFor="admin-email" className="block text-sm font-semibold text-ink-900 dark:text-shuttle-50 mb-1.5">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === 'submitting'}
            className="focus-ring w-full rounded-xl border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-2.5 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="admin-password" className="block text-sm font-semibold text-ink-900 dark:text-shuttle-50 mb-1.5">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={state === 'submitting'}
            className="focus-ring w-full rounded-xl border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-4 py-2.5 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'submitting'}
          className="focus-ring w-full rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-60 disabled:cursor-not-allowed text-court-900 font-bold px-6 py-3 transition-colors cursor-pointer"
        >
          {state === 'submitting' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
