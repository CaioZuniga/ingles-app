import { describe, expect, it } from 'vitest'
import { addDays, newCard, review } from './srs'
import { isCorrect, sameText, shuffleChoices } from './check'
import { diffWords } from './diff'
import { computeRatings, dailyPlan, ratingToLevel, streak } from './progress'
import { makePicker } from './picker'
import { reminderIcs } from './reminder'
import { gradeMistake } from '../screens/Mistakes'
import { scoreTest } from '../screens/Placement'
import { estimateCost } from '../ai/client'
import type { Mistake } from '../types'
import type { Attempt, Exercise, Profile } from '../types'
import grammar from '../data/grammar.json'
import vocabulary from '../data/vocabulary.json'
import listening from '../data/listening.json'

const profile: Profile = {
  id: 'me', name: 'Caio', level: 'B1', goals: ['work', 'travel'], exam: 'none', topics: ['real-estate'],
  context: '', dailyMinutes: 20, explainIn: 'pt', accent: 'en-US', createdAt: '2026-10-01T00:00:00Z',
}

describe('srs', () => {
  it('agenda revisões cada vez mais espaçadas e reinicia ao errar', () => {
    let c = newCard({ id: 'x', term: 'lease', pt: 'locação', example: '', definition: '' }, 'bank', '2026-10-01')
    c = review(c, 2, '2026-10-01')
    expect(c.due).toBe('2026-10-02')
    c = review(c, 2, '2026-10-02')
    expect(c.interval).toBe(6)
    c = review(c, 2, '2026-10-08')
    expect(c.interval).toBe(15)
    c = review(c, 0, '2026-10-23')
    expect(c.interval).toBe(0)
    expect(c.reps).toBe(0)
    expect(c.ease).toBeLessThan(2.5)
  })
  it('soma dias atravessando o mês', () => expect(addDays('2026-10-30', 3)).toBe('2026-11-02'))
})

describe('correção', () => {
  it('aceita contrações, maiúsculas e pontuação', () => {
    expect(sameText("I've been here", 'i have been here.')).toBe(true)
    expect(sameText("doesn't", 'does not')).toBe(true)
    expect(sameText('It’s fine', "it's fine")).toBe(true)
    expect(sameText('He go', 'He goes')).toBe(false)
  })
  it('embaralhar opções mantém a resposta certa', () => {
    const ex: Exercise = { kind: 'choice', prompt: 'a ___', options: ['x', 'y', 'z', 'w'], answer: 2, explanation: '' }
    for (let i = 0; i < 20; i++) {
      const [s] = shuffleChoices([ex])
      expect(s.kind === 'choice' && s.options[s.answer]).toBe('z')
    }
  })
})

describe('diff de fala', () => {
  it('marca palavras faltando e aceita números', () => {
    const r = diffWords('I have five properties in Miami', 'I have 5 properties Miami')
    expect(r.tokens.filter((t) => !t.ok).map((t) => t.word)).toEqual(['in'])
    expect(r.score).toBeCloseTo(5 / 6)
  })
})

describe('progresso', () => {
  const at = (date: string, score: number, level: Attempt['level'] = 'B1'): Attempt => ({ date, skill: 'grammar', activity: 'g', score, level, seconds: 60, errorTags: [] })
  it('sobe o nível ao acertar conteúdo acima', () => {
    const r = computeRatings(profile, Array.from({ length: 10 }, (_, i) => at(`2026-10-${10 + i}T10:00:00Z`, 1, 'B2')))
    expect(ratingToLevel(r.grammar).level).toBe('B2')
  })
  it('desce ao errar conteúdo mais fácil', () => {
    const r = computeRatings(profile, Array.from({ length: 10 }, (_, i) => at(`2026-10-${10 + i}T10:00:00Z`, 0.2, 'A2')))
    expect(ratingToLevel(r.grammar).level).toBe('A1')
  })
  it('conta a sequência de dias', () => {
    const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
    expect(streak([at(d(0), 1), at(d(1), 1), at(d(2), 1), at(d(4), 1)])).toBe(3)
  })
  it('monta o plano dentro do tempo diário, com revisão primeiro', () => {
    const ratings = computeRatings(profile, [])
    const plan = dailyPlan({ profile, ratings, attempts: [], dueCards: 12, totalCards: 40, dueMistakes: 0, pick: makePicker({ profile, ratings, attempts: [], weaknesses: [], hasKey: true }) })
    expect(plan[0].skill).toBe('vocabulary')
    expect(plan.length).toBeGreaterThanOrEqual(2)
    expect(plan.slice(1).some((p) => p.skill === 'speaking')).toBe(true)
  })
})

describe('banco de conteúdo', () => {
  it('exercícios de gramática são coerentes', () => {
    for (const t of grammar as { exercises: Exercise[] }[])
      for (const ex of t.exercises) {
        if (ex.kind === 'choice') expect(ex.answer).toBeLessThan(ex.options.length)
        if (ex.kind === 'gap') expect(ex.prompt).toMatch(/_{2,}/)
        if (ex.kind === 'order') expect(isCorrect(ex, ex.words.join(' '))).toBe(ex.words.join(' ') === ex.answer || isCorrect(ex, ex.words.join(' ')))
      }
  })
  it('ids únicos', () => {
    const ids = (vocabulary as { id: string }[]).map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect((listening as unknown[]).length).toBeGreaterThan(10)
  })
})

describe('plano concreto', () => {
  it('aponta para exercícios específicos e inclui revisão de erros quando há vários', () => {
    const ratings = computeRatings(profile, [])
    const plan = dailyPlan({ profile, ratings, attempts: [], dueCards: 0, totalCards: 40, dueMistakes: 5, pick: makePicker({ profile, ratings, attempts: [], weaknesses: [], hasKey: false }) })
    expect(plan[1].to).toBe('/erros/revisar')
    // Sem chave da IA não entra writing; speaking vira shadowing.
    expect(plan.some((p) => p.skill === 'writing')).toBe(false)
    for (const p of plan.slice(2)) expect(p.to).toMatch(/\/praticar\/(gramatica|listening|speaking)\/[a-z0-9-]+/)
  })
})

describe('caderno de erros', () => {
  const m: Mistake = { date: '', skill: 'grammar', tag: 'x', wrong: 'a', right: 'b', note: '', reviewed: false, box: 0, due: '2026-10-01' }
  it('sobe de caixa ao acertar e zera ao errar', () => {
    const a = gradeMistake(m, true, '2026-10-01')
    expect([a.box, a.due]).toEqual([1, '2026-10-02'])
    const b = gradeMistake({ ...a, box: 3 }, true, '2026-10-01')
    expect([b.box, b.due]).toEqual([4, '2026-10-15'])
    const c = gradeMistake(b, true, '2026-10-01')
    expect(c.reviewed).toBe(true)
    expect(gradeMistake(c, false, '2026-10-01').box).toBe(0)
  })
})

describe('nivelamento', () => {
  it('soma os acertos por nível', () => {
    const r = scoreTest([
      { skill: 'grammar', level: 'A1', score: 1 },
      { skill: 'grammar', level: 'A2', score: 1 },
      { skill: 'grammar', level: 'B1', score: 0.5 },
      { skill: 'grammar', level: 'B2', score: 0 },
    ])
    expect(ratingToLevel(r.grammar).label).toBe('B1+')
  })
})

describe('lembrete e custo', () => {
  it('gera evento diário com alarme', () => {
    const ics = reminderIcs('20:00', 20, new Date(2026, 9, 25, 21, 0))
    expect(ics).toContain('DTSTART:20261026T200000')
    expect(ics).toContain('DTEND:20261026T202000')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('BEGIN:VALARM')
  })
  it('estima o custo pelo modelo', () => {
    expect(estimateCost('claude-opus-5-5', { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(24)
    expect(estimateCost('claude-haiku-5-5', { input: 2000, output: 1000, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.0007)
  })
})
