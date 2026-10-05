import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* last line of defence: never a blank page — show what went wrong instead */}
    <ErrorBoundary area="Smash Lab">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
