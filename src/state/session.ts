import { useSyncExternalStore } from 'react'
import type { PlanItem } from '../engine/progress'
import type { Attempt, Skill } from '../types'

// Sessão guiada do dia: encadeia os itens do plano. Fica no localStorage para sobreviver a recarregar a página.

export interface SessionStep {
  title: string
  to: string
  skill: Skill
  /** O que conta como "feito": revisão de cartões, revisão de erros ou qualquer atividade da habilidade. */
  kind: 'cards' | 'mistakes' | 'skill'
}

export interface Session {
  startedAt: string
  steps: SessionStep[]
  index: number
}

const KEY = 'fluent-session'
const listeners = new Set<() => void>()
let cache: Session | null | undefined

function read(): Session | null {
  if (cache !== undefined) return cache
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null
    // Sessão de outro dia não vale mais.
    cache = s && new Date(s.startedAt).toDateString() === new Date().toDateString() ? s : null
  } catch {
    cache = null
  }
  return cache
}

function write(s: Session | null) {
  cache = s
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* sem armazenamento: a sessão vale até fechar a aba */
  }
  listeners.forEach((l) => l())
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
  )
}

export function startSession(plan: PlanItem[]): string | null {
  const steps: SessionStep[] = plan
    .filter((p) => !p.done)
    .map((p) => ({ title: p.title, to: p.to, skill: p.skill, kind: p.to.startsWith('/palavras') ? 'cards' : p.to.startsWith('/erros') ? 'mistakes' : 'skill' }))
  if (!steps.length) return null
  write({ startedAt: new Date().toISOString(), steps, index: 0 })
  return steps[0].to
}

/** Avança; devolve a rota seguinte ou a do resumo no fim. */
export function nextStep(): string {
  const s = read()
  if (!s) return '/'
  if (s.index + 1 >= s.steps.length) {
    write({ ...s, index: s.steps.length })
    return '/sessao/fim'
  }
  write({ ...s, index: s.index + 1 })
  return s.steps[s.index + 1].to
}

export function endSession() {
  write(null)
}

export function stepDone(step: SessionStep, attempts: Attempt[], since: string): boolean {
  return attempts.some(
    (a) =>
      a.date >= since &&
      (step.kind === 'cards' ? a.activity === 'card' : step.kind === 'mistakes' ? a.activity === 'mistakes' : a.skill === step.skill && a.activity !== 'card' && a.activity !== 'mistakes'),
  )
}
