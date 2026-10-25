import { describe, expect, it } from 'vitest'
import { addDays, newCard, review } from './srs'
import { isCorrect, sameText, shuffleChoices } from './check'
import { diffWords } from './diff'
import { computeRatings, dailyPlan, ratingToLevel, streak } from './progress'
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
    const plan = dailyPlan({ profile, ratings: computeRatings(profile, []), attempts: [], dueCards: 12, totalCards: 40 })
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
