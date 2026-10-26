import { useState, type ReactNode } from 'react'
import { APP_URL, canPromptInstall, isStandalone, promptInstall, skipInstall, useInstallState, type InstallState } from '../state/platform'
import { Icon } from './icons'

// Como instalar o Fluent: botão nativo no Android, passo a passo no iPhone e QR code no computador.

const DISMISS_KEY = 'fluent:instalar-dispensado'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallSteps({ state }: { state: InstallState }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (state === 'android')
    return (
      <button className="btn-primary w-full" onClick={() => promptInstall()}>
        <Icon name="check" size={16} /> Instalar app
      </button>
    )

  if (state === 'recem-instalado')
    return (
      <p className="rounded-xl border border-ok/35 bg-ok/10 p-3.5 text-sm">
        Pronto! Feche o navegador e abra o <b>Fluent</b> pelo ícone na tela inicial.
      </p>
    )

  if (state === 'android-menu')
    return (
      <Steps
        items={[
          <>
            Toque no menu <b>⋮</b> do Chrome, no canto de cima.
          </>,
          <>
            Escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).
          </>,
          <>Abra o Fluent pelo ícone novo.</>,
        ]}
      />
    )

  if (state === 'ios-outro-navegador')
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">
          No iPhone, a instalação funciona pelo <b>Safari</b>. Copie o endereço e abra no Safari.
        </p>
        <CopyUrl copied={copied} onCopy={copy} />
      </div>
    )

  if (state === 'ios')
    return (
      <Steps
        items={[
          <span className="flex flex-wrap items-center gap-1.5">
            Toque em <b>Compartilhar</b> <ShareIcon /> na barra do Safari.
          </span>,
          <>
            Role e toque em <b>Adicionar à Tela de Início</b>.
          </>,
          <>
            Toque em <b>Adicionar</b> e abra o Fluent pelo ícone novo.
          </>,
        ]}
      />
    )

  if (state === 'computador')
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <img src={`${import.meta.env.BASE_URL}instalar-qr.svg`} alt="QR code com o endereço do app" className="h-40 w-40 shrink-0 rounded-xl bg-white p-2" />
        <div className="flex flex-col gap-2.5 text-sm">
          <p className="leading-relaxed">
            Aponte a câmera do celular para o código. Ele abre o Fluent no navegador, e lá aparece o passo a passo:
          </p>
          <ul className="space-y-1 text-muted">
            <li>
              • <b className="text-fg">iPhone:</b> abra no Safari → Compartilhar → Adicionar à Tela de Início.
            </li>
            <li>
              • <b className="text-fg">Android:</b> abra no Chrome → menu ⋮ → Instalar app.
            </li>
          </ul>
          <CopyUrl copied={copied} onCopy={copy} />
          {canPromptInstall() && (
            <button className="btn-ghost text-sm" onClick={() => promptInstall()}>
              Instalar também neste computador
            </button>
          )}
        </div>
      </div>
    )

  return null
}

/** Convite para instalar (Home e Ajustes). Some quando o app já está instalado. */
export function InstallCard({ dismissible = false }: { dismissible?: boolean }) {
  const state = useInstallState()
  const [dismissed, setDismissed] = useState(readDismissed)
  if (state === 'instalado' || (dismissible && dismissed)) return null
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Sem armazenamento: some só nesta visita.
    }
  }
  return (
    <section className="card mb-4 flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{state === 'computador' ? 'Instale no seu celular' : 'Instale o app'}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Abre em tela cheia, com ícone próprio, e funciona sem internet (menos as funções de IA).
            {state.startsWith('ios') && ' No iPhone, o app instalado começa sem os dados do Safari: se já usou por aqui, exporte um backup em Ajustes e restaure lá.'}
            {state === 'computador' && ' Os dados de cada aparelho ficam separados; use o backup em Ajustes para levar seu progresso.'}
          </p>
        </div>
        {dismissible && (
          <button onClick={dismiss} aria-label="Dispensar" className="px-1 text-lg text-dim">
            ×
          </button>
        )}
      </div>
      <InstallSteps state={state} />
    </section>
  )
}

/** Tela antes do cadastro, no celular aberto pelo navegador: instalar primeiro evita cadastrar duas vezes no iPhone. */
export function InstallFirst({ onSkip }: { onSkip: () => void }) {
  const state = useInstallState()
  if (isStandalone()) return null
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 safe-top">
      <div className="hero -mx-4 px-4 pt-8 pb-6">
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="h-16 w-16 rounded-2xl" />
        <h1 className="h1 mt-4">Instale o Fluent</h1>
        <p className="mt-2 text-muted">Ele vira um app no seu celular: ícone na tela inicial, tela cheia e funciona sem internet. Leva 10 segundos.</p>
      </div>
      <div className="card mt-2 p-4">
        <InstallSteps state={state} />
      </div>
      {state.startsWith('ios') && (
        <p className="mt-3 text-xs leading-relaxed text-dim">
          Instale antes de começar: no iPhone, o app instalado e o Safari guardam os dados separados.
        </p>
      )}
      <button
        className="mt-6 w-full py-3 text-sm text-muted underline"
        onClick={() => {
          skipInstall()
          onSkip()
        }}
      >
        Agora não, usar pelo navegador
      </button>
    </div>
  )
}

function CopyUrl({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-card2 p-2 pl-3">
      <code className="min-w-0 flex-1 text-xs break-all text-accent select-all">{APP_URL}</code>
      <button className="btn-primary px-3 py-2 text-sm" onClick={onCopy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-[18px] w-[18px] text-accent" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label="ícone de compartilhar">
      <path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
