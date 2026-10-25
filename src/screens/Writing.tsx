import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { rankFor, WRITING } from '../data'
import { db, logAttempt, logMistakes } from '../db/db'
import { correctWriting, type WritingFeedback } from '../ai/tasks'
import { loadLearner, useProfile } from '../state/learner'
import { IssueList, NewWords, Section } from '../components/Feedback'
import { ErrorBox, LevelPill, Loading, NeedsKey, Rich, ScoreBadge, Screen, Segmented, SpeakButton } from '../components/ui'
import type { Level, WritingPrompt } from '../types'

const GENRE: Record<WritingPrompt['genre'], string> = {
  email: 'E-mail',
  essay: 'Redação',
  message: 'Mensagem',
  summary: 'Resumo',
  report: 'Relatório',
  story: 'História',
  review: 'Review',
}

export function WritingList() {
  const profile = useProfile()
  const history = useLiveQuery(() => db.lessons.where('skill').equals('writing').reverse().limit(10).toArray())
  if (!profile) return null
  return (
    <Screen title="Writing" back="/praticar">
      <Link to="/praticar/writing/livre" className="card mb-5 flex items-center gap-3 border-wri/40 p-4">
        <span className="text-2xl">✍️</span>
        <div>
          <div className="font-semibold">Texto livre / do seu trabalho</div>
          <div className="text-xs text-muted">Cole um e-mail real que você vai mandar e receba a correção.</div>
        </div>
      </Link>
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
