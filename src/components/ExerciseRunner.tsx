import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise, Level, Skill } from '../types'
import { correctText, fillGap, isCorrect, type UserAnswer } from '../engine/check'
import { logAttempt, logMistakes } from '../db/db'
import { stop } from '../speech/tts'
import { Bar, Rich, SpeakButton } from './ui'

// Roda uma série de exercícios objetivos, corrige na hora e registra acertos e erros.

interface Props {
  exercises: Exercise[]
  skill: Skill
  level: Level
  activity: string
  tag: string
  onDone: (score: number) => void
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export function ExerciseRunner({ exercises, skill, level, activity, tag, onDone }: Props) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<UserAnswer | null>(null)
  const [checked, setChecked] = useState(false)
  const results = useRef<boolean[]>([])
  const started = useRef(Date.now())
  const ex = exercises[i]

  // Próximo exercício (mesma tela) ou saída: o áudio da etapa anterior para.
  useEffect(() => {
    stop()
  }, [i])
  useEffect(() => () => stop(), [])

  const check = (a: UserAnswer) => {
    setAnswer(a)
    setChecked(true)
    const ok = isCorrect(ex, a)
    results.current[i] = ok
    if (!ok)
      void logMistakes([
        {
          skill,
          tag,
          wrong: ex.kind === 'choice' ? ex.options[a as number] : String(a),
          right: ex.kind === 'gap' ? fillGap(ex.prompt, correctText(ex)) : correctText(ex),
          note: ex.explanation,
        },
      ])
  }

  const next = async () => {
    if (i + 1 < exercises.length) {
      setI(i + 1)
      setAnswer(null)
      setChecked(false)
      return
    }
    const hits = results.current.filter(Boolean).length
    const score = hits / exercises.length
    await logAttempt({
      skill,
      activity,
      level,
      score,
      seconds: Math.round((Date.now() - started.current) / 1000),
      errorTags: hits < exercises.length ? [tag] : [],
    })
    onDone(score)
  }

  if (!ex) return null
  const ok = checked && answer !== null && isCorrect(ex, answer)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Bar value={(i + (checked ? 1 : 0)) / exercises.length} color="var(--color-gra)" />
        </div>
        <span className="text-xs text-muted">
          {i + 1}/{exercises.length}
        </span>
      </div>

      <div className="card p-4">
        <div className="eyebrow mb-2">{KIND_LABEL[ex.kind]}</div>
        {ex.kind === 'choice' && <Choice key={i} ex={ex} answer={answer as number | null} checked={checked} onPick={check} />}
        {(ex.kind === 'gap' || ex.kind === 'fix') && <TypeIn key={i} ex={ex} checked={checked} onSubmit={check} />}
        {ex.kind === 'order' && <Order key={i} ex={ex} checked={checked} onSubmit={check} />}
      </div>

      {checked && (
        <div className={`card p-4 ${ok ? 'border-ok/40' : 'border-bad/40'}`}>
          <div className={`font-semibold ${ok ? 'text-ok' : 'text-bad'}`}>{ok ? 'Correto!' : 'Quase.'}</div>
          {!ok && (
            <div className="mt-1 flex items-center gap-2 text-[15px]">
              <span>
                Resposta: <strong>{ex.kind === 'gap' ? fillGap(ex.prompt, correctText(ex)) : correctText(ex)}</strong>
              </span>
            </div>
          )}
          <Rich text={ex.explanation} className="mt-2 text-sm text-muted" />
          <div className="mt-3 flex items-center gap-2">
            <SpeakButton size="sm" text={ex.kind === 'gap' ? fillGap(ex.prompt, correctText(ex)) : ex.kind === 'choice' && /_{2,}/.test(ex.prompt) ? fillGap(ex.prompt, correctText(ex)) : correctText(ex)} />
            <button className="btn-primary ml-auto" onClick={next}>
              {i + 1 < exercises.length ? 'Próximo' : 'Ver resultado'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const KIND_LABEL: Record<Exercise['kind'], string> = {
  choice: 'Escolha a opção certa',
  gap: 'Complete a lacuna',
  order: 'Monte a frase',
  fix: 'Corrija o erro',
}

function Choice({ ex, answer, checked, onPick }: { ex: Extract<Exercise, { kind: 'choice' }>; answer: number | null; checked: boolean; onPick: (n: number) => void }) {
  return (
    <>
      <div className="mb-3 text-lg leading-snug">{ex.prompt}</div>
      <div className="space-y-2">
        {ex.options.map((o, k) => {
          // Classes de cor exclusivas: no Tailwind, duas cores de borda na mesma classe brigam pela ordem do CSS.
          const state = !checked ? 'border-line bg-card2' : k === ex.answer ? 'border-ok bg-ok/10' : k === answer ? 'border-bad bg-bad/10' : 'border-line bg-card2 text-muted'
          return (
            <button key={k} disabled={checked} onClick={() => onPick(k)} className={`block w-full rounded-xl border px-4 py-3 text-left disabled:opacity-100 ${state}`}>
              {o}
            </button>
          )
        })}
      </div>
    </>
  )
}

function TypeIn({ ex, checked, onSubmit }: { ex: Extract<Exercise, { kind: 'gap' | 'fix' }>; checked: boolean; onSubmit: (s: string) => void }) {
  const [v, setV] = useState(ex.kind === 'fix' ? ex.prompt : '')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim() && !checked) onSubmit(v)
      }}
    >
      <div className="mb-3 text-lg leading-snug">
        {ex.prompt}
        {ex.kind === 'gap' && ex.hint && <span className="ml-1 text-muted">{ex.hint}</span>}
      </div>
      {ex.kind === 'fix' ? (
        <textarea className="field min-h-20" value={v} onChange={(e) => setV(e.target.value)} disabled={checked} autoCapitalize="off" spellCheck={false} />
      ) : (
        <input className="field" value={v} onChange={(e) => setV(e.target.value)} disabled={checked} placeholder="Digite a resposta" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus />
      )}
      {!checked && (
        <button className="btn-primary mt-3 w-full" disabled={!v.trim()}>
          Conferir
        </button>
      )}
    </form>
  )
}

function Order({ ex, checked, onSubmit }: { ex: Extract<Exercise, { kind: 'order' }>; checked: boolean; onSubmit: (s: string) => void }) {
  const pool = useMemo(() => shuffle(ex.words.map((w, k) => ({ w, k }))), [ex])
  const [picked, setPicked] = useState<number[]>([])
  const sentence = picked.map((k) => ex.words[k]).join(' ')
  return (
    <>
      <div className="mb-3 min-h-14 rounded-xl border border-dashed border-line p-3 text-lg">
        {picked.length ? (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((k, idx) => (
              <button key={k} disabled={checked} onClick={() => setPicked(picked.filter((_, j) => j !== idx))} className="rounded-lg bg-gra/20 px-2.5 py-1 text-base disabled:opacity-100">
                {ex.words[k]}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-base text-dim">Toque nas palavras na ordem certa</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pool.map(({ w, k }) => (
          <button key={k} disabled={checked || picked.includes(k)} onClick={() => setPicked([...picked, k])} className="rounded-lg border border-line bg-card2 px-2.5 py-1.5 disabled:opacity-25">
            {w}
          </button>
        ))}
      </div>
      {!checked && (
        <button className="btn-primary mt-4 w-full" disabled={picked.length !== ex.words.length} onClick={() => onSubmit(sentence)}>
          Conferir
        </button>
      )}
    </>
  )
}
