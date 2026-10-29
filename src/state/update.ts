// Verifica e aplica a versão mais nova do app.
// O build gera version.json (vite.config.ts) com o hash do commit; comparamos com o hash deste build.

export type UpdateStatus = 'latest' | 'newer' | 'offline'

export interface UpdateCheck {
  status: UpdateStatus
  /** Build disponível no servidor (quando há versão nova). */
  latestBuild?: string
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    if (!res.ok) return { status: 'offline' }
    const { build } = (await res.json()) as { build: string }
    return build === __APP_BUILD__ ? { status: 'latest' } : { status: 'newer', latestBuild: build }
  } catch {
    return { status: 'offline' }
  }
}

/** Baixa a versão nova (service worker) e recarrega o app com ela. */
export async function applyUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration()
  if (reg) {
    await reg.update()
    const sw = reg.installing ?? reg.waiting
    if (sw && sw.state !== 'installed' && sw.state !== 'activated') {
      await new Promise<void>((resolve) => sw.addEventListener('statechange', () => (sw.state === 'installed' || sw.state === 'activated') && resolve()))
    }
  }
  window.location.reload()
}
