import type { Exercise } from '../types'

// Correção dos exercícios objetivos, tolerante a maiúsculas, pontuação, espaços e apóstrofos curvos.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Expande contrações comuns para aceitar "I'm" = "I am", "doesn't" = "does not" etc. */
export function expand(s: string): string {
  return normalize(s)
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/n't\b/g, ' not')
    .replace(/'m\b/g, ' am')
    .replace(/'re\b/g, ' are')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    .replace(/'d\b/g, ' would')
    .replace(/\bcannot\b/g, 'can not')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sameText(a: string, b: string): boolean {
  return normalize(a) === normalize(b) || expand(a) === expand(b)
}

export type UserAnswer = number | string

export function isCorrect(ex: Exercise, answer: UserAnswer): boolean {
  switch (ex.kind) {
    case 'choice':
      return answer === ex.answer
    case 'gap':
    case 'fix':
      return ex.answers.some((a) => sameText(a, String(answer)))
    case 'order':
      return sameText(ex.answer, String(answer))
  }
}

/** Resposta certa em texto, para mostrar depois do erro. */
export function correctText(ex: Exercise): string {
  switch (ex.kind) {
    case 'choice':
      return ex.options[ex.answer]
    case 'gap':
    case 'fix':
      return ex.answers[0]
    case 'order':
      return ex.answer
  }
}

export function fillGap(prompt: string, word: string): string {
  return prompt.replace(/_{2,}/, word)
}

/** Embaralha as opções de múltipla escolha (a posição da resposta certa não fica previsível). */
export function shuffleChoices(list: Exercise[]): Exercise[] {
  return list.map((ex) => {
    if (ex.kind !== 'choice') return ex
    const order = ex.options.map((_, i) => i).sort(() => Math.random() - 0.5)
    return { ...ex, options: order.map((i) => ex.options[i]), answer: order.indexOf(ex.answer) }
  })
}
