import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { GRAMMAR } from '../data'
import { db } from '../db/db'
import { useLearnerStats, useProfile, loadLearner } from '../state/learner'
import { generateGrammarLesson, type AiGrammarLesson } from '../ai/tasks'
import { shuffleChoices } from '../engine/check'
import { ExerciseRunner } from '../components/ExerciseRunner'
import { ErrorBox, LevelPill, Loading, NeedsKey, Rich, Screen } from '../components/ui'
import { LEVELS, type GrammarTopic, type Level } from '../types'

/** Melhor nota de cada tópico de gramática. */
function useBest() {
  return useLiveQuery(async () => {
    const best = new Map<string, number>()
    for (const a of await db.attempts.where('skill').equals('grammar').toArray()) best.set(a.activity, Math.max(best.get(a.activity) ?? 0, a.score))
    return best
  })
}

export function GrammarList() {
  const profile = useProfile()
  const best = useBest()
  if (!profile || !best) return null
  const byLevel = LEVELS.map((l) => ({ l, items: GRAMMAR.filter((t) => t.level === l) })).filter((g) => g.items.length)
  return (
    <Screen title="Grammar" back="/praticar">
      <Link to="/praticar/gramatica/sugerida" className="card mb-5 flex items-center gap-3 border-gra/40 p-4">
        <span className="text-2xl">✨</span>
        <div>
          <div className="font-semibold">Aula sob medida (IA)</div>
          <div className="text-xs text-muted">Escolhe o ponto que você mais erra, com exemplos do seu contexto.</div>
        </div>
      </Link>
      {byLevel.map(({ l, items }) => (
        <div key={l} className="mb-5">
          <div className={`eyebrow mb-2 ${l === profile.level ? 'text-accent' : ''}`}>
            {l} {l === profile.level && '· seu nível'}
          </div>
          <div className="space-y-1.5">
            {items.map((t) => {
              const b = best.get(`grammar:${t.id}`)
              return (
                <Link key={t.id} to={`/praticar/gramatica/${t.id}`} className="card flex items-center gap-3 px-4 py-3">
                  <span className="flex-1">{t.title}</span>
                  {b !== undefined && <span className={`text-xs font-semibold ${b >= 0.8 ? 'text-ok' : 'text-muted'}`}>{Math.round(b * 100)}%</span>}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </Screen>
  )
}

function Lesson({ topic, activity, level, tag }: { topic: Pick<GrammarTopic, 'title' | 'explanation' | 'examples' | 'exercises'>; activity: string; level: Level; tag: string }) {
  const [mode, setMode] = useState<'learn' | 'practice' | 'done'>('learn')
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  // Reembaralha as opções a cada nova rodada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exercises = useMemo(() => shuffleChoices(topic.exercises), [topic, round])
  if (mode === 'practice')
    return (
      <ExerciseRunner
        key={round}
        exercises={exercises}
        skill="grammar"
        level={level}
        activity={activity}
        tag={tag}
        onDone={(s) => {
          setScore(s)
          setMode('done')
        }}
      />
    )
  if (mode === 'done')
    return (
      <div className="card p-6 text-center">
        <div className="font-display text-5xl font-semibold">{Math.round(score * 100)}%</div>
        <div className="mt-2 text-muted">{score >= 0.8 ? 'Excelente! Tópico dominado.' : score >= 0.5 ? 'Bom, mas vale revisar a explicação.' : 'Esse tópico precisa de mais prática.'}</div>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => setMode('learn')}>
            Rever explicação
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => {
              setRound(round + 1)
              setMode('practice')
            }}
          >
            Refazer
          </button>
        </div>
      </div>
    )
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <Rich text={topic.explanation} />
      </div>
      <div className="card p-4">
        <div className="eyebrow mb-2">Exemplos</div>
        <ul className="space-y-2">
          {topic.examples.map((e, i) => {
            const [en, pt] = e.split(/\s[—–-]\s/)
            return (
              <li key={i}>
                <div>{en}</div>
                {pt && <div className="text-sm text-muted">{pt}</div>}
              </li>
            )
          })}
        </ul>
      </div>
      <button className="btn-primary w-full" disabled={!exercises.length} onClick={() => setMode('practice')}>
        Praticar ({exercises.length} exercícios)
      </button>
    </div>
  )
}

export function GrammarTopicScreen() {
  const { id } = useParams()
  const topic = GRAMMAR.find((t) => t.id === id)
  if (!topic) return <Screen title="Tópico não encontrado" back="/praticar/gramatica">{null}</Screen>
  return (
    <Screen title={topic.title} eyebrow={`Grammar · ${topic.level}`} back="/praticar/gramatica">
      <Lesson topic={topic} activity={`grammar:${topic.id}`} level={topic.level} tag={topic.id} />
    </Screen>
  )
}

export function GrammarAi() {
  const [params] = useSearchParams()
  const stats = useLearnerStats()
  const [focus, setFocus] = useState(params.get('foco') ?? '')
  const [lesson, setLesson] = useState<AiGrammarLesson | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const make = async (f = focus) => {
    setBusy(true)
    setError('')
    try {
      const l = await generateGrammarLesson(await loadLearner(), f)
      setLesson(l)
      await db.lessons.add({ date: new Date().toISOString(), skill: 'grammar', title: l.title, payload: l })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Vindo de um ponto fraco (Home), já gera direto.
  useEffect(() => {
    if (params.get('foco')) void make(params.get('foco')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recent = useLiveQuery(() => db.lessons.where('skill').equals('grammar').reverse().limit(8).toArray())

  if (!stats) return null
  return (
    <Screen title={lesson?.title ?? 'Aula sob medida'} eyebrow="Grammar · IA" back="/praticar/gramatica">
      <NeedsKey>
        {lesson ? (
          <Lesson topic={lesson} activity={`grammar:ai-${lesson.tag}`} level={stats.profile.level} tag={lesson.tag} />
        ) : busy ? (
          <Loading text="Montando sua aula…" />
        ) : (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="eyebrow mb-2">Foco (opcional)</div>
              <input className="field" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex.: preposições em reuniões, phrasal verbs de negociação" />
              {stats.weaknesses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stats.weaknesses.map((w) => (
                    <button key={w} className={focus === w ? 'chip-on' : 'chip'} onClick={() => setFocus(w)}>
                      {w}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-dim">Em branco: a IA escolhe com base nos seus erros e no seu nível.</p>
            </div>
            {error && <ErrorBox error={error} onRetry={() => make()} />}
            <button className="btn-primary w-full" onClick={() => make()}>
              Criar aula
            </button>
            {!!recent?.length && (
              <div>
                <div className="eyebrow mb-2 mt-2">Aulas recentes</div>
                <div className="space-y-1.5">
                  {recent.map((r) => (
                    <button key={r.id} className="card flex w-full items-center px-4 py-3 text-left" onClick={() => setLesson(r.payload as AiGrammarLesson)}>
                      <span className="flex-1">{r.title}</span>
                      <LevelPill level={new Date(r.date).toLocaleDateString('pt-BR')} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </NeedsKey>
    </Screen>
  )
}
