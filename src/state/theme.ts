import { useEffect, useState } from 'react'

// Tema claro/escuro. Preferência por aparelho (localStorage); "auto" segue o sistema.
// O index.html aplica o tema antes do React carregar para não piscar.

export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'fluent-theme'
const media = () => window.matchMedia('(prefers-color-scheme: light)')

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  return pref === 'auto' ? (media().matches ? 'light' : 'dark') : pref
}

export function applyTheme(pref = getThemePref()) {
  const theme = resolve(pref)
  document.documentElement.dataset.theme = theme
  // Barra do navegador/status do celular na mesma cor do fundo.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (theme === 'light' ? '#f6f1e7' : '#0e1014'))
}

export function initTheme() {
  applyTheme()
  media().addEventListener('change', () => getThemePref() === 'auto' && applyTheme())
  requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'))
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState(getThemePref)
  useEffect(() => applyTheme(pref), [pref])
  return [
    pref,
    (p) => {
      try {
        if (p === 'auto') localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, p)
      } catch {
        /* sem armazenamento: vale só nesta sessão */
      }
      setPref(p)
    },
  ]
}
