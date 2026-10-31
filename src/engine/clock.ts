import { useCallback, useEffect, useRef } from 'react'

/**
 * Tempo ativo de uma atividade: só conta enquanto o app está visível na tela.
 * Com Date.now() puro, um app deixado em segundo plano (ou com o celular bloqueado) virava horas de estudo.
 */
export function useActiveClock() {
  const ms = useRef(0)
  const since = useRef<number | null>(null)

  const restart = useCallback(() => {
    ms.current = 0
    since.current = document.visibilityState === 'visible' ? performance.now() : null
  }, [])

  useEffect(() => {
    restart()
    const sync = () => {
      const now = performance.now()
      if (document.visibilityState === 'visible') {
        if (since.current === null) since.current = now
      } else if (since.current !== null) {
        ms.current += now - since.current
        since.current = null
      }
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [restart])

  const seconds = useCallback(() => Math.round((ms.current + (since.current === null ? 0 : performance.now() - since.current)) / 1000), [])

  return { seconds, restart }
}
