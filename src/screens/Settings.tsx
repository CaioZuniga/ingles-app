import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, getSettings, importBackup, saveSettings } from '../db/db'
import type { AiUsage } from '../types'
import { MODELS, testKey } from '../ai/client'
import { englishVoices, loadVoices, speak } from '../speech/tts'
import { sttSupported } from '../speech/stt'
import { useProfile } from '../state/learner'
import { ProfileForm } from './Onboarding'
import { Screen, Segmented } from '../components/ui'
import { Icon } from '../components/icons'
import { useTheme, type ThemePref } from '../state/theme'
import { googleCalendarUrl, reminderIcs } from '../engine/reminder'
import { Link } from 'react-router-dom'

export function SettingsScreen() {
  const profile = useProfile()
  const settings = useLiveQuery(getSettings)
  const [key, setKey] = useState<string | null>(null)
  const [test, setTest] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [editProfile, setEditProfile] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useTheme()
  const [remindAt, setRemindAt] = useState('20:00')
  const usage = useLiveQuery(() => db.usage.orderBy('date').reverse().toArray())

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
        <div className="eyebrow mb-2">Aparência</div>
        <Segmented<ThemePref>
          value={theme}
          onChange={setTheme}
          options={[
            { v: 'auto', label: 'Automático' },
            { v: 'light', label: 'Claro' },
            { v: 'dark', label: 'Escuro' },
          ]}
        />
        <p className="mt-2 text-xs text-dim">Automático segue o modo claro/escuro do seu aparelho.</p>
      </section>

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Perfil</div>
        <div className="text-sm text-muted">
          {profile.name || 'Sem nome'} · {profile.level} · {profile.dailyMinutes} min/dia
          {profile.placement && ` · nivelado em ${new Date(profile.placement.date).toLocaleDateString('pt-BR')}`}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost flex-1 text-sm" onClick={() => setEditProfile(true)}>
            Editar perfil
          </button>
          <Link to="/nivelamento" className="btn-ghost flex-1 text-sm">
            {profile.placement ? 'Refazer nivelamento' : 'Teste de nivelamento'}
          </Link>
        </div>
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

      <UsageSection usage={usage ?? []} />

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Lembrete diário</div>
        <p className="mb-3 text-sm text-muted">Cria um evento diário com alarme no calendário do celular — funciona mesmo com o app fechado.</p>
        <label className="mb-3 flex items-center gap-3">
          <span className="text-sm">Horário</span>
          <input type="time" className="field w-32 py-2" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 text-sm" onClick={() => downloadIcs(reminderIcs(remindAt, profile.dailyMinutes))}>
            <Icon name="bell" size={16} /> iPhone / Outlook
          </button>
          <a className="btn-ghost flex-1 text-sm" href={googleCalendarUrl(remindAt, profile.dailyMinutes)} target="_blank" rel="noreferrer">
            <Icon name="bell" size={16} /> Google Agenda
          </a>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <div className="eyebrow mb-2">Voz e velocidade</div>
        <select className="field" value={settings.voiceURI} onChange={(e) => saveSettings({ voiceURI: e.target.value })}>
          <option value="">Automática (melhor voz {profile.accent === 'en-GB' ? 'britânica' : 'americana'})</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang}){v.localService ? '' : ' · online, pode atrasar'}
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

function downloadIcs(ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lembrete-ingles.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const usd = (v: number) => (v < 0.01 && v > 0 ? `US$ ${v.toFixed(4)}` : `US$ ${v.toFixed(2)}`)

/** Quanto a IA custou: mês atual, média por uso e as chamadas mais recentes. */
function UsageSection({ usage }: { usage: AiUsage[] }) {
  const month = new Date().toISOString().slice(0, 7)
  const thisMonth = usage.filter((u) => u.date.startsWith(month))
  const total = thisMonth.reduce((m, u) => m + u.cost, 0)
  const byTask = new Map<string, { n: number; cost: number }>()
  for (const u of thisMonth) {
    const t = byTask.get(u.task) ?? { n: 0, cost: 0 }
    byTask.set(u.task, { n: t.n + 1, cost: t.cost + u.cost })
  }
  return (
    <section className="card mb-4 p-4">
      <div className="eyebrow mb-2">Custo da IA</div>
      {usage.length === 0 ? (
        <p className="text-sm text-muted">Ainda sem uso. Cada correção, aula ou conversa aparece aqui com o custo estimado.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{usd(total)}</span>
            <span className="text-sm text-muted">
              neste mês · {thisMonth.length} uso{thisMonth.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-3 divide-y divide-line text-sm">
            {[...byTask.entries()]
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([task, v]) => (
                <div key={task} className="flex justify-between py-2">
                  <span>
                    {task} <span className="text-dim">× {v.n}</span>
                  </span>
                  <span className="text-muted">
                    {usd(v.cost)} <span className="text-dim">({usd(v.cost / v.n)} cada)</span>
                  </span>
                </div>
              ))}
          </div>
          <p className="mt-2 text-xs text-dim">Estimativa pelos tokens informados pela API e a tabela de preços de cada modelo. A cobrança oficial está no console da Anthropic.</p>
        </>
      )}
    </section>
  )
}
