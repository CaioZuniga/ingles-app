import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes empacotadas no app (só o alfabeto latino): funcionam offline.
import '@fontsource/fraunces/latin-600.css'
import '@fontsource/fraunces/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './index.css'
import App from './App.tsx'
import { loadVoices, stop } from './speech/tts'
import { initTheme } from './state/theme'

initTheme()

void loadVoices()
// Sair do app (trocar de aba, minimizar, fechar) também encerra qualquer leitura em voz alta.
document.addEventListener('visibilitychange', () => document.hidden && stop())
window.addEventListener('pagehide', stop)
// Pede ao navegador para não apagar o banco local quando faltar espaço.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
