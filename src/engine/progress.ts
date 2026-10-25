import { LEVELS, SKILLS, type Attempt, type Goal, type Level, type Mistake, type Profile, type Skill, type SkillRatings } from '../types'
import { today } from './srs'

// Nível estimado por habilidade (0–600, 100 pontos por nível CEFR), pontos fracos e sequência de dias.

export const levelBase = (l: Level) => LEVELS.indexOf(l) * 100

export function ratingToLevel(r: number): { level: Level; plus: boolean; label: string } {
  const i = Math.max(0, Math.min(5, Math.floor(r / 100)))
  const plus = r - i * 100 >= 50
  return { level: LEVELS[i], plus, label: `${LEVELS[i]}${plus ? '+' : ''}` }
}

/**
 * Cada atividade dá uma "nota de desempenho" na escala de níveis: errar tudo num conteúdo B2 indica B1;
 * acertar metade, B1+; acertar tudo, B2+. O nível estimado anda em direção a essa nota
 * (passo maior nas primeiras atividades, para calibrar rápido).
 */
export function performance(level: Level, score: number): number {
  return levelBase(level) - 100 + 190 * Math.max(0, Math.min(1, score))
}

export function computeRatings(profile: Profile, attempts: Attempt[]): SkillRatings {
  const start = levelBase(profile.level) + 50
  const r = Object.fromEntries(SKILLS.map((s) => [s, start])) as SkillRatings
  const n = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>
  const sorted = [...attempts].sort((a, b) => a.date.localeCompare(b.date))
  for (const a of sorted) {
    if (!a.level) continue
    // Cartões de vocabulário são muitos e curtos: pesam menos cada um.
    const alpha = (n[a.skill] < 10 ? 0.25 : 0.12) * (a.activity === 'card' ? 0.15 : 1)
    r[a.skill] = Math.max(0, Math.min(600, r[a.skill] + alpha * (performance(a.level, a.score) - r[a.skill])))
    n[a.skill]++
  }
  return r
}

export function overallLabel(r: SkillRatings): string {
  return ratingToLevel(SKILLS.reduce((s, k) => s + r[k], 0) / SKILLS.length).label
}

export function estimatedText(r: SkillRatings): string {
  return SKILLS.map((s) => `${s} ${ratingToLevel(r[s]).label}`).join(', ')
}

/** Etiquetas de erro mais frequentes nos últimos 45 dias (erros recentes pesam mais). */
export function weaknesses(attempts: Attempt[], mistakes: Mistake[], max = 6): string[] {
  const since = Date.now() - 45 * 86400000
  const w = new Map<string, number>()
  const add = (tag: string, date: string, weight: number) => {
    const t = Date.parse(date)
    if (!tag || t < since) return
    const recency = 0.5 + 0.5 * ((t - since) / (Date.now() - since))
    w.set(tag, (w.get(tag) ?? 0) + weight * recency)
  }
  for (const a of attempts) for (const tag of a.errorTags) add(tag, a.date, 1)
  for (const m of mistakes) if (!m.reviewed) add(m.tag, m.date, 1.5)
  return [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([t]) => t)
}

export function streak(attempts: Attempt[]): number {
  const days = new Set(attempts.map((a) => today(new Date(a.date))))
  let n = 0
  const d = new Date()
  if (!days.has(today(d))) d.setDate(d.getDate() - 1) // ainda dá tempo de estudar hoje
  while (days.has(today(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function minutesToday(attempts: Attempt[]): number {
  const t = today()
  return Math.round(attempts.filter((a) => today(new Date(a.date)) === t).reduce((s, a) => s + a.seconds, 0) / 60)
}

// ---------- Plano do dia ----------

export interface PlanItem {
  skill: Skill
  title: string
  why: string
  minutes: number
  to: string
  done: boolean
}

/** Peso de cada habilidade por demanda do aluno. */
const GOAL_WEIGHTS: Record<Goal, Partial<Record<Skill, number>>> = {
  work: { writing: 1.4, speaking: 1.4, vocabulary: 1.1 },
  travel: { speaking: 1.5, listening: 1.4 },
  exam: { writing: 1.3, listening: 1.3, speaking: 1.2, grammar: 1.2 },
  content: { listening: 1.6, vocabulary: 1.3 },
}

const SKILL_ITEM: Record<Exclude<Skill, 'vocabulary'>, { title: string; to: string; minutes: number }> = {
  grammar: { title: 'Gramática do dia', to: '/praticar/gramatica/sugerida', minutes: 8 },
  listening: { title: 'Listening', to: '/praticar/listening', minutes: 8 },
  writing: { title: 'Writing com correção', to: '/praticar/writing', minutes: 12 },
  speaking: { title: 'Speaking', to: '/praticar/speaking', minutes: 8 },
}

export function dailyPlan(opts: {
  profile: Profile
  ratings: SkillRatings
  attempts: Attempt[]
  dueCards: number
  totalCards: number
}): PlanItem[] {
  const { profile, ratings, attempts, dueCards, totalCards } = opts
  const t = today()
  const todays = attempts.filter((a) => today(new Date(a.date)) === t)
  const doneSkill = (s: Skill) => todays.some((a) => a.skill === s && a.activity !== 'card')
  const items: PlanItem[] = []

  const reviewedToday = todays.filter((a) => a.activity === 'card').length
  items.push({
    skill: 'vocabulary',
    title: dueCards ? `Revisar ${dueCards} palavra${dueCards > 1 ? 's' : ''}` : totalCards < 20 ? 'Aprender palavras novas' : 'Palavras novas',
    why: dueCards ? 'Repetição espaçada: revisar no dia certo fixa na memória.' : 'Sem revisões pendentes: hora de ampliar o vocabulário.',
    minutes: Math.min(10, Math.max(3, Math.ceil(dueCards / 4))),
    to: '/palavras/revisar',
    done: dueCards === 0 && reviewedToday > 0,
  })

  // Habilidades restantes: as mais fracas (em relação à média), as menos praticadas recentemente e as das suas demandas vêm primeiro.
  const avg = SKILLS.reduce((s, k) => s + ratings[k], 0) / SKILLS.length
  const lastPractice = (s: Skill) => {
    const last = attempts.filter((a) => a.skill === s).map((a) => a.date).sort().pop()
    return last ? (Date.now() - Date.parse(last)) / 86400000 : 30
  }
  const scored = (Object.keys(SKILL_ITEM) as (keyof typeof SKILL_ITEM)[])
    .map((s) => {
      const goalW = profile.goals.reduce((w, g) => w * (GOAL_WEIGHTS[g][s] ?? 1), 1)
      const gap = (avg - ratings[s]) / 50 // abaixo da média: mais prioridade
      const stale = Math.min(lastPractice(s), 7) / 3
      return { s, score: goalW * (1 + Math.max(-0.5, gap) * 0.5 + stale) }
    })
    .sort((a, b) => b.score - a.score)

  let budget = profile.dailyMinutes - items[0].minutes
  for (const { s } of scored) {
    const it = SKILL_ITEM[s]
    if (budget < it.minutes * 0.6 && items.length >= 2) break
    const weak = ratings[s] < avg - 25
    items.push({
      skill: s,
      title: it.title,
      why: weak ? 'É sua habilidade mais fraca agora.' : lastPractice(s) >= 3 ? 'Faz alguns dias que você não pratica.' : 'Ligada às suas demandas.',
      minutes: it.minutes,
      to: it.to,
      done: doneSkill(s),
    })
    budget -= it.minutes
  }
  return items
}
