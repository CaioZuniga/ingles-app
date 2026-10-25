import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from '../db/db'
import { speak, stop } from '../speech/tts'
import { listen, sttSupported, type Listener } from '../speech/stt'
import { useProfile } from '../state/learner'
import { Icon } from './icons'

export function Screen({ title, back, eyebrow, children, right }: { title?: string; back?: string | true; eyebrow?: string; children: ReactNode; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 safe-top">
      {(title || back) && (
        <header className="mb-4 flex items-start gap-3 pt-2">
          {back && (
            <button
              aria-label="Voltar"
              onClick={() => (back === true ? nav(-1) : nav(back))}
              className="-ml-1 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-card text-muted"
            >
              <Icon name="back" size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h1 className="h1 truncate">{title}</h1>}
          </div>
          {right}
        </header>
      )}
      {children}
    </div>
  )
}

/** Markdown mínimo: **negrito**, listas "- " e parágrafos. */
export function Rich({ text, className = '' }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let list: string[] = []
  const inline = (s: string, k: number) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong> : part))
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul${blocks.length}`}>{list.map((l, i) => <li key={i}>{inline(l, i)}</li>)}</ul>)
    list = []
  }
  lines.forEach((l, i) => {
    const t = l.trim()
    if (/^[-•*]\s+/.test(t)) list.push(t.replace(/^[-•*]\s+/, ''))
    else {
      flush()
      if (t) blocks.push(<p key={`p${i}`}>{inline(t, i)}</p>)
    }
  })
  flush()
  return <div className={`prose-lite text-[15px] leading-relaxed text-fg/90 ${className}`}>{blocks}</div>
}

export function useSpeechPrefs() {
  const profile = useProfile()
  const settings = useLiveQuery(getSettings)
  return { accent: profile?.accent ?? 'en-US', voiceURI: settings?.voiceURI, rate: settings?.speechRate ?? 0.95 }
}

/** Botão de ouvir a pronúncia. */
export function SpeakButton({ text, slow, size = 'md', label }: { text: string; slow?: boolean; size?: 'sm' | 'md'; label?: string }) {
  const prefs = useSpeechPrefs()
  const [on, setOn] = useState(false)
  const play = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (on) {
      stop()
      setOn(false)
      return
    }
    setOn(true)
    await speak(text, { ...prefs, rate: slow ? prefs.rate * 0.7 : prefs.rate })
    setOn(false)
  }
  const dim = size === 'sm' ? 'h-8 min-w-8 text-sm' : 'h-10 min-w-10'
  return (
    <button onClick={play} aria-label={label ?? (slow ? 'Ouvir devagar' : 'Ouvir')} className={`${dim} inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-line bg-card2 px-2 ${on ? 'text-accent' : 'text-muted'}`}>
      <Icon name={slow ? 'slow' : 'speaker'} size={size === 'sm' ? 15 : 18} />
      {label && <span className="pr-1 text-sm">{label}</span>}
    </button>
  )
}

/** Microfone: grava, mostra o texto reconhecido e entrega o final. */
export function MicButton({ onResult, continuous, onInterim, disabled }: { onResult: (text: string) => void; continuous?: boolean; onInterim?: (t: string) => void; disabled?: boolean }) {
  const prefs = useSpeechPrefs()
  const [rec, setRec] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<Listener | null>(null)
  const last = useRef('')
  useEffect(() => () => ref.current?.stop(), [])
  if (!sttSupported()) return null
  const toggle = () => {
    if (rec) {
      ref.current?.stop()
      return
    }
    stop()
    setErr('')
    last.current = ''
    setRec(true)
    ref.current = listen({
      lang: prefs.accent,
      continuous,
      onText: (t) => {
        last.current = t
        onInterim?.(t)
      },
      onEnd: (e) => {
        setRec(false)
        if (e) setErr(e)
        if (last.current) onResult(last.current)
      },
    })
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggle}
        disabled={disabled}
        aria-label={rec ? 'Parar de gravar' : 'Falar'}
        className={`grid h-16 w-16 place-items-center rounded-full ${rec ? 'recording bg-spk text-on-skill' : 'border border-line bg-card text-spk'}`}
      >
        <Icon name={rec ? 'stop' : 'mic'} size={26} />
      </button>
      <div className="text-xs text-muted">{rec ? (continuous ? 'Gravando… toque para terminar' : 'Ouvindo…') : 'Toque para falar'}</div>
      {err && <div className="max-w-xs text-center text-xs text-bad">{err}</div>}
    </div>
  )
}

export function Loading({ text = 'Pensando…' }: { text?: string }) {
  return (
    <div className="card flex items-center gap-3 p-4 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {text}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card border-bad/40 p-4 text-sm">
      <div className="text-bad">{error}</div>
      <div className="mt-3 flex gap-2">
        {onRetry && (
          <button className="btn-ghost py-2 text-sm" onClick={onRetry}>
            Tentar de novo
          </button>
        )}
        {/chave/i.test(error) && (
          <Link to="/ajustes" className="btn-ghost py-2 text-sm">
            Abrir Ajustes
          </Link>
        )}
      </div>
    </div>
  )
}

export function Bar({ value, color = 'var(--color-accent)' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-card2">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--color-ok)' : score >= 55 ? 'var(--color-accent)' : 'var(--color-bad)'
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 font-display text-xl font-semibold" style={{ borderColor: color, color }}>
      {Math.round(score)}
    </div>
  )
}

/** Mostra o conteúdo só se houver chave da API; senão, explica como configurar. */
export function NeedsKey({ children }: { children: ReactNode }) {
  const s = useLiveQuery(getSettings)
  if (!s) return null
  if (s.apiKey) return <>{children}</>
  return (
    <div className="card p-4 text-sm text-muted">
      Esta função usa a IA (Claude). Cadastre sua chave da API em{' '}
      <Link to="/ajustes" className="text-accent underline">
        Ajustes
      </Link>{' '}
      — o resto do app funciona sem ela.
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-card p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium ${value === o.v ? 'bg-card2 text-fg' : 'text-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function LevelPill({ level }: { level: string }) {
  return <span className="rounded-md bg-card2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">{level}</span>
}
