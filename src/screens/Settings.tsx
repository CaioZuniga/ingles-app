import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, getSettings, importBackup, saveSettings } from '../db/db'
import { MODELS, testKey } from '../ai/client'
import { englishVoices, loadVoices, speak } from '../speech/tts'
import { sttSupported } from '../speech/stt'
import { useProfile } from '../state/learner'
import { ProfileForm } from './Onboarding'
import { Screen } from '../components/ui'

export function SettingsScreen() {
  const profile = useProfile()
  const settings = useLiveQuery(getSettings)
  const [key, setKey] = useState<string | null>(null)
  const [test, setTest] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [editProfile, setEditProfile] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadVoices().then(() => setVoices(englishVoices()))
  }, [])

  if (!profile || !settings) return null
  const keyValue = key ?? settings.apiKey

  const saveKey = async () => {
    await saveSettings({ apiKey: keyValue.trim() })
    setTest('Testando…')
    try {
      setTest(`✓ Funcionou: “${await testKey()}”`)
    } catch (e) {
      setTest(`✗ ${(e as Error).message}`)
    }
  }

  const backup = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const file = new File([blob], `fluent-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
    // No celular, abre a folha de compartilhar (salvar no Drive/Arquivos); no computador, baixa.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Backup Fluent' })
        return
      } catch {
        /* cancelado: cai no download */
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (f: File) => {
    try {
      await importBackup(JSON.parse(await f.text()))
      setMsg('Backup restaurado.')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  if (editProfile)
    return (
      <Screen title="Meu perfil" back={true}>
        <ProfileForm
          initial={profile}
          cta="Salvar"
          onSave={async (p) => {
            await db.profile.put(p)
            setEditProfile(false)
          }}
        />
      </Screen>
    )

  return (
    <Screen title="Ajustes">
      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Perfil</div>
        <div className="text-sm text-muted">
          {profile.name || 'Sem nome'} · {profile.level} · {profile.dailyMinutes} min/dia
        </div>
        <button className="btn-ghost mt-3 w-full text-sm" onClick={() => setEditProfile(true)}>
          Editar nível, demandas e contexto
        </button>
      </section>

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">IA (Claude API)</div>
        <p className="mb-3 text-sm text-muted">
          Crie uma chave em <span className="text-fg">console.anthropic.com</span> → API Keys. Ela fica guardada só neste aparelho e não vai para o backup.
        </p>
        <input className="field font-mono text-sm" type="password" value={keyValue} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
        <button className="btn-primary mt-2 w-full" disabled={!keyValue.trim()} onClick={saveKey}>
          Salvar e testar
        </button>
        {test && <div className={`mt-2 text-sm ${test.startsWith('✓') ? 'text-ok' : test.startsWith('✗') ? 'text-bad' : 'text-muted'}`}>{test}</div>}
        <div className="eyebrow mb-2 mt-4">Modelo</div>
        <div className="space-y-1.5">
          {MODELS.map((m) => (
            <button key={m.id} onClick={() => saveSettings({ model: m.id })} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${settings.model === m.id ? 'border-accent bg-accent/10' : 'border-line bg-card2'}`}>
              <span className="font-medium">{m.label}</span>
              <span className="text-xs text-muted">{m.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Voz e velocidade</div>
        <select className="field" value={settings.voiceURI} onChange={(e) => saveSettings({ voiceURI: e.target.value })}>
          <option value="">Automática (melhor voz {profile.accent === 'en-GB' ? 'britânica' : 'americana'})</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-muted">Velocidade</span>
          <input type="range" min={0.6} max={1.2} step={0.05} value={settings.speechRate} onChange={(e) => saveSettings({ speechRate: Number(e.target.value) })} className="flex-1 accent-[var(--color-accent)]" />
          <span className="w-10 text-right text-sm">{settings.speechRate.toFixed(2)}×</span>
        </div>
        <button className="btn-ghost mt-3 w-full text-sm" onClick={() => speak('Hi! This is how I sound. Shall we practise some English today?', { accent: profile.accent, voiceURI: settings.voiceURI, rate: settings.speechRate })}>
          🔊 Testar voz
        </button>
        <p className="mt-2 text-xs text-dim">
          iPhone: vozes melhores em Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Inglês (baixe uma “Melhorada”). Android: Configurações → Texto para fala → Google.
          {!sttSupported() && ' Reconhecimento de voz indisponível aqui: use o microfone do teclado nos campos de texto.'}
        </p>
      </section>

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Backup</div>
        <p className="mb-3 text-sm text-muted">Seus dados ficam só neste aparelho. Faça backup de vez em quando (e para trocar de celular).</p>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-sm" onClick={backup}>
            Exportar
          </button>
          <button className="btn-ghost flex-1 text-sm" onClick={() => fileRef.current?.click()}>
            Restaurar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        {msg && <div className="mt-2 text-sm text-muted">{msg}</div>}
      </section>
    </Screen>
  )
}
