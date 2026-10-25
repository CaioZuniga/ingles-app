import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeRatings, estimatedText, weaknesses } from '../engine/progress'
import type { LearnerContext } from '../ai/tasks'
import type { Profile } from '../types'

// Contexto do aluno para a IA e para as telas, sempre atualizado a partir do banco local.

export async function loadLearner(): Promise<LearnerContext> {
  const [profile, attempts, mistakes] = await Promise.all([db.profile.get('me'), db.attempts.toArray(), db.mistakes.toArray()])
  if (!profile) throw new Error('Perfil não encontrado.')
  return { profile, weaknesses: weaknesses(attempts, mistakes), estimated: attempts.length ? estimatedText(computeRatings(profile, attempts)) : '' }
}

export function useProfile(): Profile | undefined | null {
  // null = carregado e sem perfil; undefined = carregando.
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null)
}

export function useLearnerStats() {
  return useLiveQuery(async () => {
    const [profile, attempts, mistakes, cards] = await Promise.all([db.profile.get('me'), db.attempts.toArray(), db.mistakes.toArray(), db.cards.toArray()])
    if (!profile) return null
    return { profile, attempts, mistakes, cards, ratings: computeRatings(profile, attempts), weaknesses: weaknesses(attempts, mistakes) }
  })
}
