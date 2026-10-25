import type { Card, VocabItem } from '../types'

// Repetição espaçada no estilo SM-2, com 4 botões: errei / difícil / bom / fácil.
export type Grade = 0 | 1 | 2 | 3

export function today(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return today(new Date(y, m - 1, d + days))
}

export function newCard(item: Pick<VocabItem, 'id' | 'term' | 'pt' | 'example' | 'definition'>, source: Card['source'], on = today()): Card {
  return {
    id: item.id,
    term: item.term,
    pt: item.pt,
    example: item.example,
    definition: item.definition,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: on,
    addedAt: on,
    source,
  }
}

export function review(card: Card, grade: Grade, on = today()): Card {
  let { ease, interval, reps, lapses } = card
  if (grade === 0) {
    reps = 0
    lapses += 1
    interval = 0 // volta hoje mesmo, no fim da fila
    ease = Math.max(1.3, ease - 0.2)
  } else {
    reps += 1
    if (reps === 1) interval = grade === 3 ? 3 : 1
    else if (reps === 2) interval = grade === 1 ? 3 : grade === 3 ? 8 : 6
    else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease))
    ease = Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0))
  }
  return { ...card, ease, interval, reps, lapses, due: addDays(on, interval) }
}

/** Texto do próximo intervalo para mostrar no botão ("10 min", "1 d", "6 d"). */
export function previewInterval(card: Card, grade: Grade): string {
  const next = review(card, grade)
  return next.interval === 0 ? 'hoje' : `${next.interval} d`
}

/** Cartão considerado "aprendido" a partir de 21 dias de intervalo. */
export const isMature = (c: Card) => c.interval >= 21
