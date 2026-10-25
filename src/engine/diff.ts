import { normalize } from './check'

// Compara palavra a palavra o que se esperava ouvir com o que o reconhecimento de voz entendeu
// (shadowing e ditado). LCS simples: suficiente para frases curtas.
export interface DiffToken {
  word: string
  ok: boolean
}

const words = (s: string) => normalize(s).replace(/-/g, ' ').split(' ').filter(Boolean)

/** Números falados viram dígitos no reconhecimento ("five" → "5"): trata os dois como iguais. */
const NUM: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
}
const same = (a: string, b: string) => a === b || NUM[a] === b || NUM[b] === a

export function diffWords(expected: string, heard: string): { tokens: DiffToken[]; score: number } {
  const e = words(expected)
  const h = words(heard)
  const dp: number[][] = Array.from({ length: e.length + 1 }, () => new Array(h.length + 1).fill(0))
  for (let i = e.length - 1; i >= 0; i--)
    for (let j = h.length - 1; j >= 0; j--)
      dp[i][j] = same(e[i], h[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < e.length) {
    if (j < h.length && same(e[i], h[j])) {
      tokens.push({ word: e[i], ok: true })
      i++
      j++
    } else if (j < h.length && dp[i][j + 1] >= dp[i + 1][j]) j++
    else {
      tokens.push({ word: e[i], ok: false })
      i++
    }
  }
  const hits = tokens.filter((t) => t.ok).length
  // Penaliza palavras extras inventadas pelo aluno, sem deixar negativo.
  const extra = Math.max(0, h.length - hits)
  const score = e.length ? Math.max(0, (hits - extra * 0.5) / e.length) : 0
  return { tokens, score }
}
