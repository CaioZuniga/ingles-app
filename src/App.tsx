import { useEffect } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useProfile } from './state/learner'
import { stop } from './speech/tts'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Practice } from './screens/Practice'
import { GrammarList, GrammarTopicScreen, GrammarAi } from './screens/Grammar'
import { ListeningList, ListeningPlayer, ListeningAi } from './screens/Listening'
import { WritingList, WritingTask } from './screens/Writing'
import { SpeakingHub, Shadowing, SpeakingPromptScreen, RoleplayScreen } from './screens/Speaking'
import { Words, WordReview, WordBrowse } from './screens/Words'
import { Tutor } from './screens/Tutor'
import { ProgressScreen } from './screens/Progress'
import { SettingsScreen } from './screens/Settings'

const TABS = [
  { to: '/', label: 'Hoje', icon: '☀︎', end: true },
  { to: '/praticar', label: 'Praticar', icon: '◆' },
  { to: '/palavras', label: 'Palavras', icon: '❖' },
  { to: '/progresso', label: 'Progresso', icon: '▲' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙︎' },
]

/** Cada tela nova abre no topo (o navegador mantém a rolagem da anterior) e sem áudio da tela anterior. */
function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    stop()
  }, [pathname])
  return null
}

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${isActive ? 'text-accent' : 'text-dim'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  const profile = useProfile()
  if (profile === undefined) return null
  if (profile === null) return <Onboarding />
  return (
    <HashRouter>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/praticar" element={<Practice />} />
        <Route path="/praticar/gramatica" element={<GrammarList />} />
        <Route path="/praticar/gramatica/sugerida" element={<GrammarAi />} />
        <Route path="/praticar/gramatica/:id" element={<GrammarTopicScreen />} />
        <Route path="/praticar/listening" element={<ListeningList />} />
        <Route path="/praticar/listening/nova" element={<ListeningAi />} />
        <Route path="/praticar/listening/:id" element={<ListeningPlayer />} />
        <Route path="/praticar/writing" element={<WritingList />} />
        <Route path="/praticar/writing/:id" element={<WritingTask />} />
        <Route path="/praticar/speaking" element={<SpeakingHub />} />
        <Route path="/praticar/speaking/shadowing" element={<Shadowing />} />
        <Route path="/praticar/speaking/resposta/:id" element={<SpeakingPromptScreen />} />
        <Route path="/praticar/speaking/conversa/:id" element={<RoleplayScreen />} />
        <Route path="/palavras" element={<Words />} />
        <Route path="/palavras/revisar" element={<WordReview />} />
        <Route path="/palavras/explorar" element={<WordBrowse />} />
        <Route path="/tutor" element={<Tutor />} />
        <Route path="/progresso" element={<ProgressScreen />} />
        <Route path="/ajustes" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </HashRouter>
  )
}
