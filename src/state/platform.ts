import { useSyncExternalStore } from 'react'

// Instalação do app (PWA) no Android e no iPhone: cada um tem um caminho diferente.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const APP_URL = 'https://caiozuniga.github.io/ingles-app/'

let installEvent: BeforeInstallPromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isAndroid = () => /android/i.test(navigator.userAgent)
/** No iPhone, só o Safari mostra "Adicionar à Tela de Início" de forma confiável. */
export const isIOSSafari = () => isIOS() && !/crios|fxios|edgios|opios|gsa\//i.test(navigator.userAgent)

/** Aberto pelo ícone da tela de início (app instalado), e não pelo navegador. */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function initPlatform() {
  // Android/Chrome (e Chrome/Edge no computador): guarda o convite de instalação para o nosso botão.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    justInstalled = true
    notify()
  })
}

/**
 * 'instalado': aberto pelo ícone. 'recem-instalado': acabou de instalar e ainda está no navegador.
 * 'android': temos o botão nativo. 'android-menu': Android sem o convite (instalar pelo menu ⋮).
 * 'ios' / 'ios-outro-navegador': passo a passo no Safari, ou pedir para abrir no Safari.
 * 'computador': mostra o QR code para abrir no celular (e o botão, se o navegador oferecer).
 */
export type InstallState = 'instalado' | 'recem-instalado' | 'android' | 'android-menu' | 'ios' | 'ios-outro-navegador' | 'computador'

function installState(): InstallState {
  if (isStandalone()) return 'instalado'
  if (justInstalled) return 'recem-instalado'
  if (isIOS()) return isIOSSafari() ? 'ios' : 'ios-outro-navegador'
  if (isAndroid()) return installEvent ? 'android' : 'android-menu'
  return 'computador'
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    installState,
  )
}

export const canPromptInstall = () => installEvent !== null

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false
  await installEvent.prompt()
  const { outcome } = await installEvent.userChoice
  installEvent = null
  notify()
  return outcome === 'accepted'
}

const SKIP_KEY = 'fluent:instalar-pulado'

/**
 * Celular abrindo pelo navegador: oferece instalar antes do cadastro. No iPhone isso evita cadastrar
 * duas vezes, porque o Safari e o app instalado guardam os dados separados.
 */
export function shouldOfferInstallFirst(): boolean {
  if (isStandalone() || !(isIOS() || isAndroid())) return false
  try {
    return localStorage.getItem(SKIP_KEY) !== '1'
  } catch {
    return true
  }
}

export function skipInstall() {
  try {
    localStorage.setItem(SKIP_KEY, '1')
  } catch {
    // Sem armazenamento: a tela volta na próxima visita.
  }
}
