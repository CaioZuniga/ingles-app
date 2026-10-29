import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, logAttempt } from '../db/db'
import { addDays, today } from '../engine/srs'
import { sameText } from '../engine/check'
import { diffWords } from '../engine/diff'
import { useProfile } from '../state/learner'
import { SKILL_LABEL } from '../data'
import { Bar, Screen, SpeakButton } from '../components/ui'
import type { Mistake } from '../types'

// Revisão do caderno de erros em caixas de Leitner: acertou, o erro volta em 1, 3, 7, 14 e 30 dias;
// errou, volta amanhã do zero. Depois da 5ª caixa é dado como aprendido.

const INTERVALS = [1, 3, 7, 14, 30]
const PER_ROUND = 10

export function gradeMistake(m: Mistake, ok: boolean, on = today()): Mistake {
  const box = ok ? (m.box ?? 0) + 1 : 0
  return { ...m, box, due: addDays(on, ok ? INTERVALS[Math.min(box - 1, INTERVALS.length - 1)] : 1), reviewed: box >= INTERVALS.length }
}

/** Frase do erro tem "cara" de frase (dá para pedir a correção digitada) ou é só uma palavra solta (vira escolha). */
const sentenceLike = (m: Mistake) => m.wrong.split(/\s+/).length >= 3 && m.right.split(/\s+/).length >= 3

export function MistakeReview() {
  const profile = useProfile()
  const due = useLiveQuery(() => db.mistakes.where('due').belowOrEqual(today()).filter((m) => !m.reviewed).toArray())
  const [queue, setQueue] = useState<Mistake[] | null>(null)
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const hits = useRef(0)
  const started = useRef(Date.now())

  // Congela a rodada ao abrir (a lista "due" muda enquanto você responde).
  const round = useMemo(() => queue ?? (due ? [...due].sort((a, b) => (a.box ?? 0) - (b.box ?? 0) || a.date.localeCompare(b.date)).slice(0, PER_ROUND) : null), [queue, due])
  if (round && !queue && round.length) setQueue(round)
  const m = round?.[i]
  const options = useMemo(() => (m ? (Math.random() < 0.5 ? [m.wrong, m.right] : [m.right, m.wrong]) : []), [m])

  if (!profile || !round) return null
  if (!round.length)
    return (
      <Screen title="Caderno de erros" back="/progresso">
        <div className="card p-6 text-center">
          <div className="text-4xl">✨</div>
          <div className="mt-2 font-semibold">Nenhum erro para revisar hoje.</div>
          <p className="mt-1 text-sm text-muted">Os erros dos exercícios e das correções da IA entram aqui e voltam no dia certo.</p>
          <Link to="/progresso" className="btn-ghost mt-4 w-full">
            Ver caderno completo
          </Link>
        </div>
      </Screen>
    )

  const finished = i >= round.length
  if (finished)
    return (
      <Screen title="Caderno de erros" back="/">
        <div className="card p-6 text-center">
          <div className="font-display text-5xl font-semibold">
            {hits.current}/{round.length}
          </div>
          <div className="mt-2 text-muted">acertos. Os que você errou voltam amanhã.</div>
          <Link to="/" className="btn-primary mt-5 w-full">
            Concluir
          </Link>
        </div>
      </Screen>
    )

  const typeMode = sentenceLike(m!)
  const checked = answer !== null
  const ok = checked && (typeMode ? sameText(answer, m!.right) || diffWords(m!.right, answer).score >= 0.9 : answer === m!.right)

  const submit = async (a: string) => {
    const correct = typeMode ? sameText(a, m!.right) || diffWords(m!.right, a).score >= 0.9 : a === m!.right
    setAnswer(a)
    if (correct) hits.current++
    await db.mistakes.put(gradeMistake(m!, correct))
    if (i + 1 === round.length)
      await logAttempt({ skill: 'grammar', activity: 'mistakes', level: profile.level, score: (hits.current + 0) / round.length, seconds: Math.round((Date.now() - started.current) / 1000), errorTags: [] })
  }

  const next = () => {
    setI(i + 1)
    setAnswer(null)
    setTyped('')
  }

  return (
    <Screen title="Caderno de erros" eyebrow="Revisão" back="/" right={<span className="mt-2 text-sm text-muted">{i + 1}/{round.length}</span>}>
      <div className="mb-4">
        <Bar value={(i + (checked ? 1 : 0)) / round.length} />
      </div>
      <div className="card p-4">
        <div className="eyebrow mb-1">
          {SKILL_LABEL[m!.skill]} · {m!.tag}
        </div>
        {typeMode ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 text-muted">
              <span>Reescreva corretamente:</span>
              {m!.skill === 'listening' && <SpeakButton size="sm" text={m!.right} label="Ouvir de novo" />}
            </div>
            <div className="mb-3 rounded-xl bg-card2 p-3 text-lg">{m!.wrong}</div>
            <textarea className="field min-h-20" value={typed} disabled={checked} onChange={(e) => setTyped(e.target.value)} placeholder="Versão corrigida" autoCapitalize="off" spellCheck={false} lang="en" />
            {!checked && (
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setTyped(m!.wrong)}>
                  Copiar a frase
                </button>
                <button className="btn-primary flex-1" disabled={!typed.trim()} onClick={() => submit(typed)}>
                  Conferir
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 text-muted">Qual é a forma certa?</div>
            <div className="space-y-2">
              {options.map((o) => {
                const state = !checked ? 'border-line bg-card2' : o === m!.right ? 'border-ok bg-ok/10' : o === answer ? 'border-bad bg-bad/10' : 'border-line bg-card2 text-muted'
                return (
                  <button key={o} disabled={checked} onClick={() => submit(o)} className={`block w-full rounded-xl border px-4 py-3 text-left text-lg disabled:opacity-100 ${state}`}>
                    {o}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      {checked && (
        <div className={`card mt-4 p-4 ${ok ? 'border-ok/40' : 'border-bad/40'}`}>
          <div className={`font-semibold ${ok ? 'text-ok' : 'text-bad'}`}>{ok ? 'Isso! Volta mais tarde para fixar.' : 'Ainda não — volta amanhã.'}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] text-ok">{m!.right}</span>
            <SpeakButton size="sm" text={m!.right} />
          </div>
          {m!.note && <div className="mt-2 text-sm text-muted">{m!.note}</div>}
          <button className="btn-primary mt-3 w-full" onClick={next}>
            {i + 1 < round.length ? 'Próximo' : 'Ver resultado'}
          </button>
        </div>
      )}
    </Screen>
  )
}
