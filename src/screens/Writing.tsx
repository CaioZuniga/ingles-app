import { Icon } from '../components/icons'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { rankFor, WRITING } from '../data'
import { db, logAttempt, logMistakes } from '../db/db'
import { correctWriting, generateErrorDrills, type WritingFeedback } from '../ai/tasks'
import { loadLearner, useProfile } from '../state/learner'
import { IssueList, NewWords, Section } from '../components/Feedback'
import { ExerciseRunner } from '../components/ExerciseRunner'
import { ErrorBox, LevelPill, Loading, NeedsKey, Rich, ScoreBadge, Screen, Segmented, SpeakButton } from '../components/ui'
import type { Exercise, Level, Mistake, WritingPrompt } from '../types'

const GENRE: Record<WritingPrompt['genre'], string> = {
  email: 'E-mail',
  essay: 'Redação',
  message: 'Mensagem',
  summary: 'Resumo',
  report: 'Relatório',
  story: 'História',
  review: 'Review',
}

/** Erros de writing ainda não dominados (sem repetição), do mais recente para o mais antigo, sem frases repetidas. */
async function writingMistakes(): Promise<Mistake[]> {
  const all = (await db.mistakes.where('skill').equals('writing').toArray()).filter((m) => !m.reviewed).sort((a, b) => b.date.localeCompare(a.date))
  const seen = new Set<string>()
  return all.filter((m) => {
    const key = `${m.wrong}|${m.right}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function WritingList() {
  const profile = useProfile()
  const history = useLiveQuery(() => db.lessons.where('skill').equals('writing').reverse().limit(10).toArray())
  const mistakes = useLiveQuery(writingMistakes)
  if (!profile) return null
  return (
    <Screen title="Writing" back="/praticar">
      <Link to="/praticar/writing/livre" className="card mb-5 flex items-center gap-3 border-wri/40 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'color-mix(in oklab, var(--color-wri) 15%, transparent)', color: 'var(--color-wri)' }}>
          <Icon name="pen" />
        </span>
        <div>
          <div className="font-semibold">Texto livre / do seu trabalho</div>
          <div className="text-xs text-muted">Cole um e-mail real que você vai mandar e receba a correção.</div>
        </div>
      </Link>
      {!!mistakes?.length && (
        <Link to="/praticar/writing/erros" className="card mb-5 flex items-center gap-3 border-wri/40 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'color-mix(in oklab, var(--color-wri) 15%, transparent)', color: 'var(--color-wri)' }}>
            <Icon name="sparkle" />
          </span>
          <div>
            <div className="font-semibold">Exercícios dos seus erros</div>
            <div className="text-xs text-muted">{mistakes.length} erros de writing viraram exercícios novos para fixar.</div>
          </div>
        </Link>
      )}
      {!!history?.length && (
        <>
          <div className="eyebrow mb-2">Correções anteriores</div>
          <div className="mb-5 space-y-1.5">
            {history.map((h) => (
              <Link key={h.id} to={`/praticar/writing/h-${h.id}`} className="card flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="text-sm font-semibold">{Math.round((h.payload as Saved).feedback.score)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="eyebrow mb-2">Propostas</div>
      <div className="space-y-1.5">
        {rankFor(WRITING, profile).map((w) => (
          <Link key={w.id} to={`/praticar/writing/${w.id}`} className="card flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate">{w.title}</div>
              <div className="text-xs text-muted">
                {GENRE[w.genre]}
                {w.exam && w.exam !== 'none' ? ` · ${w.exam.toUpperCase()}` : ''} · {w.minWords}+ palavras
              </div>
            </div>
            <LevelPill level={w.level} />
          </Link>
        ))}
      </div>
    </Screen>
  )
}

/** Exercícios novos feitos pela IA a partir dos erros de writing; as respostas erradas voltam ao caderno de erros. */
export function WritingDrills() {
  const profile = useProfile()
  const mistakes = useLiveQuery(writingMistakes)
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [round, setRound] = useState(0)
  const [score, setScore] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!profile || mistakes === undefined) return null

  // Tag mais frequente entre os erros, usada no registro das respostas erradas.
  const tag = [...mistakes.reduce((m, x) => m.set(x.tag, (m.get(x.tag) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'writing'

  const make = async () => {
    setBusy(true)
    setError('')
    try {
      const ex = await generateErrorDrills(await loadLearner(), mistakes.slice(0, 12).map((m) => ({ wrong: m.wrong, right: m.right, tag: m.tag, note: m.note })))
      if (!ex.length) throw new Error('A IA não montou exercícios válidos. Tente de novo.')
      await db.lessons.add({ date: new Date().toISOString(), skill: 'writing', title: 'Exercícios dos seus erros', payload: ex })
      setExercises(ex)
      setScore(null)
      setRound(round + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Exercícios dos seus erros" eyebrow="Writing · fixar" back="/praticar/writing">
      {score !== null ? (
        <div className="card p-6 text-center">
          <div className="font-display text-5xl font-semibold">{Math.round(score * 100)}%</div>
          <div className="mt-2 text-muted">{score >= 0.8 ? 'Ótimo: esses erros estão fixando.' : 'Os erros que sobraram voltam no caderno de erros.'}</div>
          <div className="mt-5 flex gap-2">
            <Link to="/praticar/writing" className="btn-ghost flex-1">
              Voltar
            </Link>
            <button className="btn-primary flex-1" onClick={make} disabled={busy}>
              Novos exercícios
            </button>
          </div>
        </div>
      ) : exercises ? (
        <ExerciseRunner key={round} exercises={exercises} skill="writing" level={profile.level} activity="writing:drills" tag={tag} onDone={setScore} />
      ) : busy ? (
        <Loading text="Montando exercícios com os seus erros…" />
      ) : mistakes.length ? (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="eyebrow mb-2">Seus erros recentes</div>
            <ul className="space-y-2.5 text-[15px]">
              {mistakes.slice(0, 12).map((m) => (
                <li key={m.id}>
                  <span className="text-bad line-through">{m.wrong}</span>
                  <span className="mx-1.5 text-dim">→</span>
                  <span className="text-ok">{m.right}</span>
                  <div className="text-xs text-muted">{m.tag}</div>
                </li>
              ))}
            </ul>
          </div>
          <NeedsKey>
            {error && <ErrorBox error={error} onRetry={make} />}
            <button className="btn-primary w-full" onClick={make}>
              Criar exercícios com estes erros
            </button>
          </NeedsKey>
          <p className="text-xs text-dim">A IA cria frases novas com os mesmos padrões de erro, para você praticar em vez de só reler.</p>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <div className="text-4xl">✨</div>
          <div className="mt-2 font-semibold">Nenhum erro de writing pendente.</div>
          <p className="mt-1 text-sm text-muted">Corrija um texto e os erros aparecem aqui para virar exercícios.</p>
          <Link to="/praticar/writing" className="btn-ghost mt-4 w-full">
            Ir para Writing
          </Link>
        </div>
      )}
    </Screen>
  )
}

interface Saved {
  task: string
  text: string
  feedback: WritingFeedback
}

export function WritingTask() {
  const { id = '' } = useParams()
  const profile = useProfile()
  const saved = useLiveQuery(async () => (id.startsWith('h-') ? ((await db.lessons.get(Number(id.slice(2))))?.payload as Saved) ?? null : null), [id])
  const prompt = WRITING.find((w) => w.id === id)
  const [custom, setCustom] = useState('')
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [started] = useState(Date.now())
  if (!profile || saved === undefined) return null

  if (saved) return (
    <Screen title="Correção" eyebrow="Writing" back="/praticar/writing">
      <div className="card mb-4 p-4 text-sm text-muted">{saved.task}</div>
      <FeedbackView fb={saved.feedback} original={saved.text} />
    </Screen>
  )

  const isFree = id === 'livre'
  const task = isFree ? custom || 'Free writing: correct and improve the learner’s text, keeping its purpose.' : `${prompt?.title}\n${prompt?.prompt}`
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const level: Level = prompt?.level ?? profile.level

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const fb = await correctWriting(await loadLearner(), task, text, prompt?.exam && prompt.exam !== 'none' ? prompt.exam : undefined)
      setFeedback(fb)
      await logAttempt({
        skill: 'writing',
        activity: `writing:${id}`,
        level,
        score: Math.max(0, Math.min(1, fb.score / 100)),
        seconds: Math.round((Date.now() - started) / 1000),
        errorTags: [...new Set(fb.issues.map((i) => i.tag))],
      })
      await logMistakes(fb.issues.map((i) => ({ skill: 'writing' as const, tag: i.tag, wrong: i.wrong, right: i.right, note: i.note })))
      await db.lessons.add({ date: new Date().toISOString(), skill: 'writing', title: isFree ? custom.slice(0, 50) || 'Texto livre' : prompt!.title, payload: { task, text, feedback: fb } satisfies Saved })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!isFree && !prompt) return <Screen title="Proposta não encontrada" back="/praticar/writing">{null}</Screen>

  return (
    <Screen title={isFree ? 'Texto livre' : prompt!.title} eyebrow={`Writing · ${level}`} back="/praticar/writing">
      {feedback ? (
        <>
          <FeedbackView fb={feedback} original={text} />
          <button className="btn-ghost mt-4 w-full" onClick={() => setFeedback(null)}>
            Reescrever e corrigir de novo
          </button>
          <Link to="/praticar/writing/erros" className="btn-primary mt-2 block w-full text-center">
            Praticar meus erros
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          {isFree ? (
            <label className="block">
              <div className="eyebrow mb-2">Contexto (opcional)</div>
              <input className="field" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ex.: e-mail para investidor sobre atraso no relatório" />
            </label>
          ) : (
            <div className="card p-4">
              <Rich text={prompt!.prompt} />
              <div className="mt-2 text-xs text-dim">
                {GENRE[prompt!.genre]} · mínimo {prompt!.minWords} palavras
              </div>
            </div>
          )}
          <div>
            <textarea className="field min-h-64 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write here…" lang="en" spellCheck={false} autoCorrect="off" />
            <div className={`mt-1 text-right text-xs ${prompt && words < prompt.minWords ? 'text-dim' : 'text-ok'}`}>{words} palavras</div>
          </div>
          <NeedsKey>
            {busy ? <Loading text="Corrigindo seu texto…" /> : null}
            {error && <ErrorBox error={error} onRetry={submit} />}
            {!busy && (
              <button className="btn-primary w-full" disabled={words < 5} onClick={submit}>
                Corrigir com IA
              </button>
            )}
          </NeedsKey>
          <p className="text-xs text-dim">Dica: desligue o corretor automático do teclado para treinar a ortografia de verdade.</p>
        </div>
      )}
    </Screen>
  )
}

function FeedbackView({ fb, original }: { fb: WritingFeedback; original: string }) {
  const [view, setView] = useState<'corrected' | 'improved' | 'original'>('corrected')
  const shown = view === 'corrected' ? fb.corrected : view === 'improved' ? fb.improved : original
  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-4 p-4">
        <ScoreBadge score={fb.score} />
        <div>
          <div className="font-semibold">Nível do texto: {fb.cefr}</div>
          {fb.examBand && <div className="text-sm text-accent">{fb.examBand}</div>}
          <div className="mt-1 text-sm text-muted">{fb.summary}</div>
        </div>
      </div>
      {fb.strengths.length > 0 && (
        <Section title="Pontos fortes">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {fb.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`Erros (${fb.issues.length})`}>
        <IssueList issues={fb.issues} />
      </Section>
      <Section title="Texto">
        <Segmented value={view} onChange={setView} options={[{ v: 'corrected', label: 'Corrigido' }, { v: 'improved', label: 'Versão melhor' }, { v: 'original', label: 'Seu' }]} />
        <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{shown}</div>
        <div className="mt-3">
          <SpeakButton text={shown} label="Ouvir" size="sm" />
        </div>
      </Section>
      {fb.newWords.length > 0 && (
        <Section title="Expressões para aprender">
          <NewWords words={fb.newWords} />
        </Section>
      )}
    </div>
  )
}
