import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Shown above the message, e.g. "The admin area". */
  area: string
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string
}

/**
 * Instead of a blank page when something crashes while rendering, show what went wrong — the
 * error message and where — with a reload button. Makes problems reportable ("send me what it
 * says") instead of invisible.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? '' })
    console.error(`[${this.props.area}]`, error, info.componentStack)
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children
    const details = `${error.name}: ${error.message}\n${componentStack.trim().split('\n').slice(0, 6).join('\n')}`
    return (
      <div role="alert" className="max-w-2xl mx-auto my-12 px-4">
        <div className="paper p-6">
          <span className="tape">Something broke</span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900 dark:text-shuttle-50">{this.props.area} couldn't be shown</h1>
          <p className="mt-2 text-sm text-ink-700/80 dark:text-shuttle-100/80">Reloading often helps. If it keeps happening, send this message to the developer:</p>
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-court-900/5 dark:bg-white/5 p-3 text-xs whitespace-pre-wrap">{details}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-400 text-court-900 font-bold px-5 py-2 cursor-pointer"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(details)}
              className="focus-ring rounded-full border-2 border-court-900/20 dark:border-white/30 font-semibold px-5 py-2 cursor-pointer"
            >
              Copy message
            </button>
          </div>
        </div>
      </div>
    )
  }
}
