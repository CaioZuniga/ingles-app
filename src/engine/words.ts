import { db } from '../db/db'
import type { Card, VocabItem } from '../types'
import { newCard } from './srs'

// Entrada de palavras no baralho de revisão (banco base, sugestões da IA ou digitadas pelo aluno).

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export async function addWords(items: Pick<VocabItem, 'term' | 'pt' | 'example' | 'definition'>[], source: Card['source'], ids?: string[]): Promise<number> {
  const existing = new Set((await db.cards.toArray()).map((c) => c.term.toLowerCase()))
  const fresh = items
    .map((it, i) => ({ it, id: ids?.[i] ?? `${source}-${slug(it.term)}` }))
    .filter(({ it }) => !existing.has(it.term.toLowerCase()))
  await db.cards.bulkPut(fresh.map(({ it, id }) => newCard({ ...it, id }, source)))
  return fresh.length
}
