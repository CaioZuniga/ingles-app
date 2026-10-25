import { GRAMMAR, LISTENING, rankFor, ROLEPLAYS, SPEAKING_PROMPTS, WRITING } from '../data'
import { LEVELS, type Attempt, type Level, type Profile, type Skill, type SkillRatings } from '../types'
import { ratingToLevel, type Pick } from './progress'
import { today } from './srs'

// Escolhe a atividade concreta de cada habilidade para o plano do dia:
// no nível estimado daquela habilidade, nos seus temas, priorizando o que você ainda não fez
// (ou fez mal) e os seus pontos fracos. Se já praticou a habilidade hoje, mantém a mesma escolha.

interface Ctx {
  profile: Profile
  ratings: SkillRatings
  attempts: Attempt[]
  weaknesses: string[]
  hasKey: boolean
}

const near = (a: Level, b: Level) => Math.abs(LEVELS.indexOf(a) - LEVELS.indexOf(b)) <= 1

export function makePicker(ctx: Ctx) {
  const { profile, ratings, attempts, weaknesses, hasKey } = ctx
  const t = today()
  const best = new Map<string, number>()
  const last = new Map<string, string>()
  for (const a of attempts) {
    best.set(a.activity, Math.max(best.get(a.activity) ?? 0, a.score))
    if ((last.get(a.activity) ?? '') < a.date) last.set(a.activity, a.date)
  }
  const doneToday = (s: Skill) =>
    attempts.filter((a) => a.skill === s && today(new Date(a.date)) === t && a.activity !== 'card' && a.activity !== 'mistakes').pop()

  return (skill: Exclude<Skill, 'vocabulary'>): Pick | null => {
    const lvl = ratingToLevel(ratings[skill]).level
    const already = doneToday(skill)

    if (skill === 'grammar') {
      const id = already?.activity.startsWith('grammar:') ? already.activity.slice(8) : undefined
      const pool = GRAMMAR.filter((g) => near(g.level, lvl))
      const scored = (id ? GRAMMAR.filter((g) => g.id === id) : pool)
        .map((g) => {
          const b = best.get(`grammar:${g.id}`)
          let score = b === undefined ? 2 : (1 - b) * 3 // não feito ou mal feito primeiro
          if (weaknesses.includes(g.id)) score += 3
          if (g.level === lvl) score += 0.5
          // Feito nos últimos 3 dias: espera um pouco.
          if (Date.now() - Date.parse(last.get(`grammar:${g.id}`) ?? '1970') < 3 * 86400000) score -= 2
          return { g, score }
        })
        .sort((a, b) => b.score - a.score)
      const g = scored[0]?.g
      if (!g) return id?.startsWith('ai-') ? { title: 'Gramática: aula sob medida', to: '/praticar/gramatica/sugerida', activity: 'grammar' } : null
      return { title: `Gramática: ${g.title}`, to: `/praticar/gramatica/${g.id}`, activity: 'grammar' }
    }

    if (skill === 'listening') {
      const id = already?.activity.slice('listening:'.length)
      const item = LISTENING.find((l) => l.id === id) ?? rankFor(LISTENING, profile, lvl).find((l) => !best.has(`listening:${l.id}`))
      if (!item) return hasKey ? { title: 'Listening: novo áudio sob medida', to: '/praticar/listening/nova', activity: 'listening' } : { title: 'Listening', to: '/praticar/listening', activity: 'listening' }
      return { title: `Listening: ${item.title}`, to: `/praticar/listening/${item.id}`, activity: 'listening' }
    }

    if (skill === 'writing') {
      if (!hasKey) return null // a correção depende da IA
      const id = already?.activity.slice('writing:'.length)
      const w = WRITING.find((x) => x.id === id) ?? rankFor(WRITING, profile, lvl).find((x) => !best.has(`writing:${x.id}`))
      if (!w) return { title: 'Writing: texto livre', to: '/praticar/writing/livre', activity: 'writing' }
      return { title: `Writing: ${w.title}`, to: `/praticar/writing/${w.id}`, activity: 'writing' }
    }

    // Speaking: sem IA, shadowing; com IA, alterna conversa e resposta falada.
    if (!hasKey || already?.activity === 'shadowing') return { title: 'Speaking: ouvir e repetir', to: '/praticar/speaking/shadowing', activity: 'shadowing' }
    if (already?.activity.startsWith('roleplay:')) {
      const rp = ROLEPLAYS.find((r) => `roleplay:${r.id}` === already.activity)
      return { title: `Conversa: ${rp?.title ?? 'roleplay'}`, to: rp ? `/praticar/speaking/conversa/${rp.id}` : '/praticar/speaking', activity: 'roleplay' }
    }
    const roleplays = attempts.filter((a) => a.activity.startsWith('roleplay:')).length
    const prompts = attempts.filter((a) => a.activity.startsWith('speaking:')).length
    if (roleplays <= prompts) {
      const rp = rankFor(ROLEPLAYS, profile, lvl).find((r) => !best.has(`roleplay:${r.id}`)) ?? rankFor(ROLEPLAYS, profile, lvl)[0]
      return { title: `Conversa: ${rp.title}`, to: `/praticar/speaking/conversa/${rp.id}`, activity: 'roleplay' }
    }
    const id = already?.activity.slice('speaking:'.length)
    const sp = SPEAKING_PROMPTS.find((x) => x.id === id) ?? rankFor(SPEAKING_PROMPTS, profile, lvl).find((x) => !best.has(`speaking:${x.id}`)) ?? rankFor(SPEAKING_PROMPTS, profile, lvl)[0]
    return { title: 'Speaking: responder em voz alta', to: `/praticar/speaking/resposta/${sp.id}`, activity: 'speaking' }
  }
}
