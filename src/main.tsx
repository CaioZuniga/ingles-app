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
import { loadVoices } from './speech/tts'

void loadVoices()
// Pede ao navegador para não apagar o banco local quando faltar espaço.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
