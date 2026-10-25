import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GRAMMAR, PHRASES, VOCAB } from '../data'
import { db, logAttempt } from '../db/db'
import { diffWords } from '../engine/diff'
import { ratingToLevel } from '../engine/progress'
import { useProfile } from '../state/learner'
import { speak } from '../speech/tts'
import { Bar, Screen, useSpeechPrefs } from '../components/ui'
import { Icon, SkillTile } from '../components/icons'
import { SKILL_LABEL } from '../data'
import type { Level, Profile, Skill, SkillRatings } from '../types'

// Teste de nivelamento (~8 min): vocabulário, gramática e listening, 2 itens por nível de A1 a C1.
// Nota por habilidade = 100 × soma dos acertos por nível (ex.: A1 100%, A2 100%, B1 50% → 250 = B1+).
// Writing e speaking partem da média de gramática e vocabulário (produção costuma vir um pouco abaixo).

const TEST_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const PER_LEVEL = 2

type Q =
  | { skill: 'vocabulary'; level: Level; term: string; options: string[]; answer: string }
  | { skill: 'grammar'; level: Level; prompt: string; options: string[]; answer: string }
  | { skill: 'listening'; level: Level; text: string }

const sample = <T,>(list: T[], n: number) => [...list].sort(() => Math.random() - 0.5).slice(0, n)

function buildTest(): Q[] {
  const qs: Q[] = []
  for (const level of TEST_LEVELS) {
    const words = VOCAB.filter((v) => v.level === level)
    for (const w of sample(words, PER_LEVEL)) {
      const wrong = sample(words.filter((x) => x.id !== w.id && x.pt !== w.pt), 3).map((x) => x.pt)
      qs.push({ skill: 'vocabulary', level, term: w.term, options: sample([w.pt, ...wrong], 4), answer: w.pt })
    }
  }
  for (const level of TEST_LEVELS) {
    const choices = GRAMMAR.filter((g) => g.level === level).flatMap((g) => g.exercises.filter((e) => e.kind === 'choice'))
    for (const e of sample(choices, PER_LEVEL)) if (e.kind === 'choice') qs.push({ skill: 'grammar', level, prompt: e.prompt, options: sample(e.options, e.options.length), answer: e.options[e.answer] })
  }
  for (const level of TEST_LEVELS) {
    for (const p of sample(PHRASES.filter((x) => x.level === level && x.text.split(' ').length >= 4), 1)) qs.push({ skill: 'listening', level, text: p.text })
  }
  return qs
}

export function scoreTest(results: { skill: Skill; level: Level; score: number }[]): SkillRatings {
  const per = (skill: Skill) =>
    TEST_LEVELS.reduce((sum, level) => {
      const r = results.filter((x) => x.skill === skill && x.level === level)
      return sum + (r.length ? r.reduce((m, x) => m + x.score, 0) / r.length : 0) * 100
    }, 0)
  const vocabulary = per('vocabulary')
  const grammar = per('grammar')
  const listening = per('listening')
  const production = Math.max(0, (vocabulary + grammar) / 2 - 30)
  return { vocabulary, grammar, listening, writing: production, speaking: production }
}

export function Placement() {
  const profile = useProfile()
  const nav = useNavigate()
  const prefs = useSpeechPrefs()
  const test = useMemo(buildTest, [])
  const [stage, setStage] = useState<'intro' | 'test' | 'done'>('intro')
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState('')
  const [plays, setPlays] = useState(0)
  const [playing, setPlaying] = useState(false)
  const results = useRef<{ skill: Skill; level: Level; score: number }[]>([])
  const started = useRef(Date.now())
  const [ratings, setRatings] = useState<SkillRatings | null>(null)
  if (!profile) return null
  const q = test[i]

  const answer = async (score: number) => {
    results.current.push({ skill: q.skill, level: q.level, score })
    setTyped('')
    setPlays(0)
    if (i + 1 < test.length) return setI(i + 1)
    const r = scoreTest(results.current)
    const avg = (r.vocabulary + r.grammar + r.listening) / 3
    const updated: Profile = { ...profile, level: ratingToLevel(avg).level, placement: { date: new Date().toISOString(), ratings: r } }
    await db.profile.put(updated)
    await logAttempt({ skill: 'grammar', activity: 'placement', level: updated.level, score: avg / 600, seconds: Math.round((Date.now() - started.current) / 1000), errorTags: [] })
    setRatings(r)
    setStage('done')
  }

  if (stage === 'intro')
    return (
      <Screen title="Teste de nivelamento" back="/">
        <div className="card p-5">
          <p className="text-[15px] leading-relaxed">
            São <strong>{test.length} perguntas</strong> (uns 8 minutos) de vocabulário, gramática e listening, do básico ao avançado. Não tem problema errar: o teste serve para o app começar no ponto certo em cada habilidade.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>• Responda sem consultar nada.</li>
            <li>• Se não souber, escolha “Não sei” — chutar atrapalha o resultado.</li>
            <li>• No listening, ligue o som.</li>
          </ul>
          <button
            className="btn-primary mt-5 w-full"
            onClick={() => {
              started.current = Date.now()
              setStage('test')
            }}
          >
            Começar
          </button>
        </div>
      </Screen>
    )

  if (stage === 'done' && ratings)
    return (
      <Screen title="Seu nível" eyebrow="Resultado do nivelamento">
        <div className="hero -mx-4 mb-4 px-4 py-6 text-center">
          <div className="font-display text-6xl font-semibold">{ratingToLevel((ratings.vocabulary + ratings.grammar + ratings.listening) / 3).label}</div>
          <div className="mt-1 text-muted">nível geral estimado</div>
        </div>
        <div className="card divide-y divide-line">
          {(['vocabulary', 'grammar', 'listening', 'writing', 'speaking'] as Skill[]).map((k) => (
            <div key={k} className="flex items-center gap-3 p-4">
              <SkillTile skill={k} />
              <div className="flex-1">
                {SKILL_LABEL[k]}
                {(k === 'writing' || k === 'speaking') && <div className="text-xs text-dim">estimado; ajusta quando você praticar</div>}
              </div>
              <div className="font-display text-xl font-semibold">{ratingToLevel(ratings[k]).label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">O plano do dia e o conteúdo sugerido já usam esses níveis. Eles continuam se ajustando a cada atividade.</p>
        <button className="btn-primary mt-5 w-full" onClick={() => nav('/')}>
          Ir para o plano de hoje
        </button>
      </Screen>
    )

  return (
    <Screen title="Nivelamento" eyebrow={`${SKILL_LABEL[q.skill]} · pergunta ${i + 1} de ${test.length}`} back="/">
      <div className="mb-5">
        <Bar value={i / test.length} />
      </div>
      <div className="card p-5">
        {q.skill === 'vocabulary' && (
          <>
            <div className="mb-1 text-sm text-muted">O que significa…</div>
            <div className="mb-4 font-display text-3xl font-semibold">{q.term}</div>
          </>
        )}
        {q.skill === 'grammar' && (
          <>
            <div className="mb-1 text-sm text-muted">Complete:</div>
            <div className="mb-4 text-xl leading-snug">{q.prompt}</div>
          </>
        )}
        {q.skill !== 'listening' ? (
          <div className="space-y-2">
            {q.options.map((o) => (
              <button key={o} className="block w-full rounded-xl border border-line bg-card2 px-4 py-3 text-left" onClick={() => answer(o === q.answer ? 1 : 0)}>
                {o}
              </button>
            ))}
            <button className="block w-full rounded-xl px-4 py-3 text-left text-muted" onClick={() => answer(0)}>
              Não sei
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm text-muted">Ouça e escreva a frase (pode ouvir até 3 vezes).</div>
            <button
              className="btn-ghost mb-3 w-full"
              disabled={plays >= 3 || playing}
              onClick={async () => {
                setPlays(plays + 1)
                setPlaying(true)
                await speak(q.text, prefs)
                setPlaying(false)
              }}
            >
              <Icon name={playing ? 'speaker' : 'play'} size={16} /> {playing ? 'Tocando…' : `Ouvir ${plays ? `(${plays}/3)` : ''}`}
            </button>
            <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="O que você ouviu" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="en" />
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => answer(0)}>
                Não entendi
              </button>
              <button className="btn-primary flex-1" disabled={!typed.trim() || !plays} onClick={() => answer(diffWords(q.text, typed).score)}>
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
