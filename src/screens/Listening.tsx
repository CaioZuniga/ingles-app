import { Icon } from '../components/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { LISTENING, rankFor, TOPIC_LABEL } from '../data'
import { db, logAttempt, logMistakes } from '../db/db'
import { generateListening } from '../ai/tasks'
import { loadLearner, useProfile } from '../state/learner'
import { speakScript, stop, speak } from '../speech/tts'
import { diffWords } from '../engine/diff'
import { ErrorBox, LevelPill, Loading, NeedsKey, Screen, Segmented, useSpeechPrefs } from '../components/ui'
import { LEVELS, type Level, type ListeningItem, type Topic } from '../types'

function useDone() {
  return useLiveQuery(async () => new Set((await db.attempts.where('skill').equals('listening').toArray()).map((a) => a.activity)))
}

export function ListeningList() {
  const profile = useProfile()
  const done = useDone()
  const ai = useLiveQuery(() => db.lessons.where('skill').equals('listening').reverse().limit(10).toArray())
  if (!profile || !done) return null
  return (
    <Screen title="Listening" back="/praticar">
      <Link to="/praticar/listening/nova" className="card mb-5 flex items-center gap-3 border-lis/40 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'color-mix(in oklab, var(--color-lis) 15%, transparent)', color: 'var(--color-lis)' }}>
          <Icon name="sparkle" />
        </span>
        <div>
          <div className="font-semibold">Novo áudio sob medida (IA)</div>
          <div className="text-xs text-muted">Escolha tema e nível; a IA escreve, o celular lê em voz alta.</div>
        </div>
      </Link>
      {!!ai?.length && (
        <>
          <div className="eyebrow mb-2">Criados pela IA</div>
          <div className="mb-5 space-y-1.5">
            {ai.map((l) => (
              <Item key={l.id} item={l.payload as ListeningItem} to={`/praticar/listening/ai-${l.id}`} done={done.has(`listening:${(l.payload as ListeningItem).id}`)} />
            ))}
          </div>
        </>
      )}
      <div className="eyebrow mb-2">Biblioteca</div>
      <div className="space-y-1.5">
        {rankFor(LISTENING, profile).map((l) => (
          <Item key={l.id} item={l} to={`/praticar/listening/${l.id}`} done={done.has(`listening:${l.id}`)} />
        ))}
      </div>
    </Screen>
  )
}

function Item({ item, to, done }: { item: ListeningItem; to: string; done: boolean }) {
  return (
    <Link to={to} className="card flex items-center gap-3 px-4 py-3">
      <span className="text-lis">
        <Icon name={item.kind === 'dialogue' ? 'chat' : 'headphones'} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate">{item.title}</div>
        <div className="text-xs text-muted">{item.topics.map((t) => TOPIC_LABEL[t]).join(' · ')}</div>
      </div>
      {done && <span className="text-ok">✓</span>}
      <LevelPill level={item.level} />
    </Link>
  )
}

export function ListeningAi() {
  const profile = useProfile()
  const nav = useNavigate()
  const [topic, setTopic] = useState<string>('')
  const [level, setLevel] = useState<Level | null>(null)
  const [kind, setKind] = useState<'dialogue' | 'monologue'>('dialogue')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!profile) return null
  const lvl = level ?? profile.level
  const make = async () => {
    setBusy(true)
    setError('')
    try {
      const item = await generateListening(await loadLearner(), topic || profile.context || profile.topics.join(', ') || 'everyday life', lvl, kind)
      const id = await db.lessons.add({ date: new Date().toISOString(), skill: 'listening', title: item.title, payload: { ...item, id: `ai-${Date.now()}` } })
      nav(`/praticar/listening/ai-${id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Screen title="Novo áudio" eyebrow="Listening · IA" back="/praticar/listening">
      <NeedsKey>
        {busy ? (
          <Loading text="Escrevendo o áudio e as perguntas…" />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="eyebrow mb-2">Tema</div>
              <input className="field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: call sobre vacância de um galpão logístico" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => (
                  <button key={t} className="chip text-sm" onClick={() => setTopic(TOPIC_LABEL[t])}>
                    {TOPIC_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Formato</div>
              <Segmented value={kind} onChange={setKind} options={[{ v: 'dialogue', label: 'Diálogo' }, { v: 'monologue', label: 'Monólogo' }]} />
            </div>
            <div>
              <div className="eyebrow mb-2">Nível</div>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button key={l} className={lvl === l ? 'chip-on' : 'chip'} onClick={() => setLevel(l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {error && <ErrorBox error={error} onRetry={make} />}
            <button className="btn-primary w-full" onClick={make}>
              Criar áudio
            </button>
          </div>
        )}
      </NeedsKey>
    </Screen>
  )
}

export function ListeningPlayer() {
  const { id = '' } = useParams()
  const item = useLiveQuery(async () => {
    if (id.startsWith('ai-')) {
      const l = await db.lessons.get(Number(id.slice(3)))
      return (l?.payload as ListeningItem) ?? null
    }
    return LISTENING.find((l) => l.id === id) ?? null
  }, [id])
  if (item === undefined) return null
  if (!item) return <Screen title="Áudio não encontrado" back="/praticar/listening">{null}</Screen>
  return (
    <Screen title={item.title} eyebrow={`Listening · ${item.level}`} back="/praticar/listening">
      <Player key={item.id} item={item} />
    </Screen>
  )
}

function Player({ item }: { item: ListeningItem }) {
  const prefs = useSpeechPrefs()
  const [rate, setRate] = useState(prefs.rate)
  const [playing, setPlaying] = useState(false)
  const [line, setLine] = useState(-1)
  const [showText, setShowText] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>(item.questions.map(() => null))
  const [stage, setStage] = useState<'questions' | 'dictation' | 'done'>('questions')
  const [dict, setDict] = useState<string[]>(item.dictation.map(() => ''))
  const [dictChecked, setDictChecked] = useState(false)
  const [plays, setPlays] = useState(0)
  const cancel = useRef<() => void>(() => {})
  const started = useRef(Date.now())
  const lines = item.transcript.split('\n').filter((l) => l.trim())

  // Trocar de etapa (perguntas → ditado → fim) para o áudio que estiver tocando.
  useEffect(() => {
    stop()
  }, [stage])
  useEffect(() => () => stop(), [])

  const play = async () => {
    if (playing) {
      cancel.current()
      setPlaying(false)
      return
    }
    setPlaying(true)
    setPlays(plays + 1)
    const s = await speakScript(item.transcript, { ...prefs, rate, onLine: setLine })
    cancel.current = s.cancel
    await s.done
    setPlaying(false)
  }

  const allAnswered = answers.every((a) => a !== null)
  const qScore = answers.filter((a, i) => a === item.questions[i].answer).length / item.questions.length
  const dictScores = item.dictation.map((d, i) => diffWords(d, dict[i]).score)
  const dScore = dictScores.reduce((a, b) => a + b, 0) / Math.max(1, dictScores.length)

  const finish = async () => {
    stop()
    const score = item.dictation.length ? qScore * 0.6 + dScore * 0.4 : qScore
    // Ouvir com o texto aberto vale menos (é leitura).
    const adjusted = showText ? score * 0.7 : score
    await logAttempt({
      skill: 'listening',
      activity: `listening:${item.id}`,
      level: item.level,
      score: adjusted,
      seconds: Math.round((Date.now() - started.current) / 1000),
      errorTags: dScore < 0.7 ? ['listening-detail'] : [],
      detail: `perguntas ${Math.round(qScore * 100)}%, ditado ${Math.round(dScore * 100)}%, ouviu ${plays}x`,
    })
    await logMistakes(
      item.dictation
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => dictScores[i] < 0.8)
        .map(({ d, i }) => ({ skill: 'listening' as const, tag: 'listening-detail', wrong: dict[i] || '(em branco)', right: d, note: 'Ditado' })),
    )
    setStage('done')
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <button onClick={play} className="grid h-14 w-14 place-items-center rounded-full bg-lis text-xl text-on-skill" aria-label={playing ? 'Parar' : 'Ouvir'}>
            {playing ? '■' : '▶'}
          </button>
          <div className="flex-1">
            <div className="text-sm text-muted">{item.kind === 'dialogue' ? 'Diálogo — duas vozes' : 'Monólogo'}</div>
            <div className="text-xs text-dim">Ouviu {plays}x</div>
          </div>
          <select className="rounded-lg border border-line bg-card2 px-2 py-1.5 text-sm" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            {[...new Set([0.7, 0.8, 0.9, 1, 1.1, rate])].sort().map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </div>
        <button className="mt-3 text-sm text-muted underline" onClick={() => setShowText(!showText)}>
          {showText ? 'Esconder texto' : 'Mostrar texto (conta menos pontos)'}
        </button>
        {(showText || stage === 'done') && (
          <div className="mt-3 space-y-1.5 text-[15px] leading-relaxed">
            {lines.map((l, i) => (
              <p key={i} className={i === line ? 'text-lis' : 'text-fg/85'}>
                {l}
              </p>
            ))}
          </div>
        )}
      </div>

      {stage === 'questions' && (
        <div className="card p-4">
          <div className="eyebrow mb-3">Perguntas</div>
          <div className="space-y-5">
            {item.questions.map((q, qi) => (
              <div key={qi}>
                <div className="mb-2 font-medium">
                  {qi + 1}. {q.question}
                </div>
                <div className="space-y-1.5">
                  {q.options.map((o, oi) => (
                    <button key={oi} onClick={() => setAnswers(answers.map((a, k) => (k === qi ? oi : a)))} className={`block w-full rounded-xl border px-3 py-2.5 text-left text-[15px] ${answers[qi] === oi ? 'border-lis bg-lis/10' : 'border-line bg-card2'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-5 w-full" disabled={!allAnswered} onClick={() => (item.dictation.length ? setStage('dictation') : finish())}>
            {item.dictation.length ? 'Próximo: ditado' : 'Ver resultado'}
          </button>
        </div>
      )}

      {stage === 'dictation' && (
        <div className="card p-4">
          <div className="eyebrow mb-1">Ditado</div>
          <p className="mb-3 text-sm text-muted">Ouça cada frase e escreva exatamente o que ouviu.</p>
          <div className="space-y-4">
            {item.dictation.map((d, i) => {
              const r = diffWords(d, dict[i])
              return (
                <div key={i}>
                  <div className="mb-1.5 flex gap-2">
                    <button className="btn-ghost px-3 py-2 text-sm" onClick={() => speak(d, { ...prefs, rate })}>
                      ▶ Frase {i + 1}
                    </button>
                    <button className="btn-ghost px-3 py-2 text-sm" onClick={() => speak(d, { ...prefs, rate: rate * 0.7 })}>
                      🐢
                    </button>
                  </div>
                  <input className="field" value={dict[i]} disabled={dictChecked} onChange={(e) => setDict(dict.map((x, k) => (k === i ? e.target.value : x)))} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                  {dictChecked && (
                    <div className="mt-1.5 text-[15px]">
                      {r.tokens.map((t, k) => (
                        <span key={k} className={t.ok ? 'text-ok' : 'text-bad underline'}>
                          {t.word}{' '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!dictChecked ? (
            <button className="btn-primary mt-5 w-full" onClick={() => setDictChecked(true)}>
              Conferir ditado
            </button>
          ) : (
            <button className="btn-primary mt-5 w-full" onClick={finish}>
              Ver resultado
            </button>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="font-display text-4xl font-semibold">{Math.round((item.dictation.length ? qScore * 0.6 + dScore * 0.4 : qScore) * 100)}%</div>
            <div className="text-sm text-muted">
              Perguntas: {Math.round(qScore * 100)}%
              {item.dictation.length > 0 && (
                <>
                  <br />
                  Ditado: {Math.round(dScore * 100)}%
                </>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {item.questions.map((q, i) => (
              <div key={i} className="text-sm">
                <span className={answers[i] === q.answer ? 'text-ok' : 'text-bad'}>{answers[i] === q.answer ? '✓' : '✗'}</span> {q.question}
                {answers[i] !== q.answer && <div className="ml-4 text-muted">Certo: {q.options[q.answer]}</div>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-dim">O texto completo está acima. Dica: ouça de novo lendo junto.</p>
        </div>
      )}
    </div>
  )
}
