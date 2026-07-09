import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import { AppProviders } from './app/AppProviders'
import { AppRouter } from './app/AppRouter'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
    <PWAUpdatePrompt />
  </StrictMode>,
)
