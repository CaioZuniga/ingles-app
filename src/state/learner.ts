import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings } from '../db/db'
import { computeRatings, dailyPlan, estimatedText, weaknesses } from '../engine/progress'
import { makePicker } from '../engine/picker'
import { today } from '../engine/srs'
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
    const [profile, attempts, mistakes, cards, settings] = await Promise.all([db.profile.get('me'), db.attempts.toArray(), db.mistakes.toArray(), db.cards.toArray(), getSettings()])
    if (!profile) return null
    const ratings = computeRatings(profile, attempts)
    const weak = weaknesses(attempts, mistakes)
    const t = today()
    const dueCards = cards.filter((c) => c.due <= t).length
    const dueMistakes = mistakes.filter((m) => !m.reviewed && (m.due ?? t) <= t).length
    const hasKey = Boolean(settings.apiKey)
    const plan = dailyPlan({
      profile,
      ratings,
      attempts,
      dueCards,
      totalCards: cards.length,
      dueMistakes,
      pick: makePicker({ profile, ratings, attempts, weaknesses: weak, hasKey }),
    })
    return { profile, attempts, mistakes, cards, ratings, weaknesses: weak, dueCards, dueMistakes, hasKey, plan }
  })
}
