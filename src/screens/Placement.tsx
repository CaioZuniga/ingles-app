import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PHRASES, PLACEMENT } from '../data'
import { db, logAttempt, logMistakes } from '../db/db'
import { fillGap } from '../engine/check'
import { addWords } from '../engine/words'
import { diffWords } from '../engine/diff'
import { ratingToLevel } from '../engine/progress'
import { useActiveClock } from '../engine/clock'
import { useProfile } from '../state/learner'
import { speak, stop } from '../speech/tts'
import { Bar, Screen, SpeakButton, useSpeechPrefs } from '../components/ui'
import { Icon, SkillTile } from '../components/icons'
import { SKILL_LABEL } from '../data'
import type { Level, Mistake, PlacementItem, PlacementVocab, Profile, Skill, SkillRatings } from '../types'

// Teste de nivelamento (~8 min): vocabulário, gramática e listening, 2 itens por nível de A1 a C1.
// Nota por habilidade = 100 × soma dos acertos por nível (ex.: A1 100%, A2 100%, B1 50% → 250 = B1+).
// Writing e speaking partem da média de gramática e vocabulário (produção costuma vir um pouco abaixo).
// Como o teste vai até C1, o teto é C1+ (490): acertar tudo não prova C2.
// O conteúdo é geral (src/data/placement.json), sem perfil profissional, e toda pergunta tem 4 opções.

const TEST_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const PER_LEVEL = 2

type Q =
  | { skill: 'vocabulary'; level: Level; term: string; options: string[]; answer: string; vocab: PlacementVocab }
  | { skill: 'grammar'; level: Level; prompt: string; options: string[]; answer: string; topic: string; explanation: string }
  | { skill: 'listening'; level: Level; text: string }

const MAX_RATING = 490

const sample = <T,>(list: T[], n: number) => [...list].sort(() => Math.random() - 0.5).slice(0, n)

/** Frases de listening sem temas profissionais específicos (imóveis, finanças). */
const isGenericPhrase = (x: { topics: string[] }) => !x.topics.some((t) => t === 'real-estate' || t === 'finance')

function buildTest(): Q[] {
  const qs: Q[] = []
  for (const level of TEST_LEVELS) {
    for (const w of sample(PLACEMENT.vocabulary.filter((v) => v.level === level), PER_LEVEL))
      qs.push({ skill: 'vocabulary', level, term: w.term, options: sample([w.pt, ...w.distractors], 4), answer: w.pt, vocab: w })
  }
  for (const level of TEST_LEVELS) {
    for (const g of sample(PLACEMENT.grammar.filter((x) => x.level === level), PER_LEVEL))
      qs.push({ skill: 'grammar', level, prompt: g.prompt, options: sample(g.options, g.options.length), answer: g.options[g.answer], topic: g.topic, explanation: g.explanation })
  }
  for (const level of TEST_LEVELS) {
    for (const p of sample(PHRASES.filter((x) => x.level === level && x.text.split(' ').length >= 4 && isGenericPhrase(x)), 1)) qs.push({ skill: 'listening', level, text: p.text })
  }
  return qs
}

export function scoreTest(results: { skill: Skill; level: Level; score: number }[]): SkillRatings {
  const per = (skill: Skill) =>
    TEST_LEVELS.reduce((sum, level) => {
      const r = results.filter((x) => x.skill === skill && x.level === level)
      return sum + (r.length ? r.reduce((m, x) => m + x.score, 0) / r.length : 0) * 100
    }, 0)
  const cap = (v: number) => Math.min(MAX_RATING, v)
  const vocabulary = cap(per('vocabulary'))
  const grammar = cap(per('grammar'))
  const listening = cap(per('listening'))
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
  const items = useRef<PlacementItem[]>([])
  const clock = useActiveClock()
  const [result, setResult] = useState<NonNullable<Profile['placement']> | null>(null)
  // Próxima pergunta ou saída: o áudio da pergunta anterior para.
  useEffect(() => {
    stop()
  }, [i, stage])
  useEffect(() => () => stop(), [])
  if (!profile) return null
  const q = test[i]

  const answer = async (score: number, given: string) => {
    items.current.push({
      skill: q.skill,
      level: q.level,
      question: q.skill === 'vocabulary' ? q.term : q.skill === 'grammar' ? q.prompt : q.text,
      given,
      correct: q.skill === 'listening' ? q.text : q.answer,
      score,
    })
    setTyped('')
    setPlays(0)
    if (i + 1 < test.length) return setI(i + 1)
    const r = scoreTest(items.current)
    const avg = (r.vocabulary + r.grammar + r.listening) / 3
    const placement = { date: new Date().toISOString(), ratings: r, items: items.current }
    await db.profile.put({ ...profile, level: ratingToLevel(avg).level, placement })
    await logAttempt({ skill: 'grammar', activity: 'placement', level: ratingToLevel(avg).level, score: avg / 600, seconds: clock.seconds(), errorTags: [] })
    await learnFromMistakes(test, items.current)
    setResult(placement)
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
              clock.restart()
              setStage('test')
            }}
          >
            Começar
          </button>
        </div>
      </Screen>
    )

  if (stage === 'done' && result)
    return (
      <Screen title="Seu nível" eyebrow="Resultado do nivelamento">
        <PlacementReport placement={result} />
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
              <button key={o} className="block w-full rounded-xl border border-line bg-card2 px-4 py-3 text-left" onClick={() => answer(o === q.answer ? 1 : 0, o)}>
                {o}
              </button>
            ))}
            <button className="block w-full rounded-xl px-4 py-3 text-left text-muted" onClick={() => answer(0, '')}>
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
              <button className="btn-ghost flex-1" onClick={() => answer(0, '')}>
                Não entendi
              </button>
              <button className="btn-primary flex-1" disabled={!typed.trim() || !plays} onClick={() => answer(diffWords(q.text, typed).score, typed.trim())}>
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}

/** Palavras que você não sabia vão para o baralho; erros de gramática e de listening, para o caderno de erros. */
async function learnFromMistakes(test: Q[], items: PlacementItem[]) {
  const vocab = test.flatMap((q, k) => (q.skill === 'vocabulary' && items[k].score < 1 ? [q.vocab] : []))
  await addWords(vocab, 'bank', vocab.map((v) => v.id))
  await logMistakes(
    test.flatMap((q, k): Omit<Mistake, 'id' | 'date' | 'reviewed'>[] => {
      const it = items[k]
      if (q.skill === 'grammar' && it.score < 1)
        return [{ skill: 'grammar' as const, tag: q.topic, wrong: fillGap(q.prompt, it.given || '…'), right: fillGap(q.prompt, q.answer), note: q.explanation }]
      if (q.skill === 'listening' && it.score < 0.8)
        return [{ skill: 'listening' as const, tag: 'listening-detail', wrong: it.given || '(não entendi)', right: q.text, note: 'Frase do teste de nivelamento' }]
      return []
    }),
  )
}

const REPORT_SKILLS = ['vocabulary', 'grammar', 'listening'] as const
const isHit = (it: PlacementItem) => it.score >= (it.skill === 'listening' ? 0.8 : 1)

/** Resultado do nivelamento: nível por habilidade e, ao tocar, cada pergunta com a sua resposta e a correta. */
export function PlacementReport({ placement }: { placement: NonNullable<Profile['placement']> }) {
  const { ratings, items = [] } = placement
  const [open, setOpen] = useState<Skill | null>(items.length ? 'vocabulary' : null)
  return (
    <>
      <div className="hero -mx-4 mb-4 px-4 py-6 text-center">
        <div className="font-display text-6xl font-semibold">{ratingToLevel((ratings.vocabulary + ratings.grammar + ratings.listening) / 3).label}</div>
        <div className="mt-1 text-muted">nível geral estimado · {new Date(placement.date).toLocaleDateString('pt-BR')}</div>
      </div>
      <div className="space-y-2.5">
        {REPORT_SKILLS.map((k) => {
          const list = items.filter((x) => x.skill === k)
          const hits = list.filter(isHit).length
          const isOpen = open === k
          return (
            <div key={k} className="card overflow-hidden">
              <button className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-100" onClick={() => setOpen(isOpen ? null : k)} disabled={!list.length}>
                <SkillTile skill={k} />
                <div className="flex-1">
                  <div>{SKILL_LABEL[k]}</div>
                  {list.length > 0 && (
                    <div className="text-xs text-muted">
                      {hits} de {list.length} certas · toque para {isOpen ? 'fechar' : 'ver'}
                    </div>
                  )}
                </div>
                <div className="font-display text-xl font-semibold">{ratingToLevel(ratings[k]).label}</div>
                {list.length > 0 && <Icon name="chevron" size={16} className={`text-dim transition ${isOpen ? 'rotate-90' : ''}`} />}
              </button>
              {isOpen && (
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((it, n) => (
                    <ReportRow key={n} it={it} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        <div className="card divide-y divide-line">
          {(['writing', 'speaking'] as const).map((k) => (
            <div key={k} className="flex items-center gap-3 p-4">
              <SkillTile skill={k} />
              <div className="flex-1">
                {SKILL_LABEL[k]}
                <div className="text-xs text-dim">estimado pela gramática e vocabulário; ajusta quando você praticar</div>
              </div>
              <div className="font-display text-xl font-semibold">{ratingToLevel(ratings[k]).label}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        As palavras que você errou entraram no seu baralho, e os erros de gramática e listening no caderno de erros. O plano do dia já usa esses níveis, que continuam se ajustando a cada atividade.
      </p>
    </>
  )
}

function ReportRow({ it }: { it: PlacementItem }) {
  const ok = isHit(it)
  const partial = !ok && it.score > 0
  const mark = ok ? { c: 'text-ok', s: '✓' } : partial ? { c: 'text-accent', s: '~' } : { c: 'text-bad', s: '✗' }
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className={`w-4 shrink-0 pt-0.5 font-bold ${mark.c}`}>{mark.s}</span>
      <div className="min-w-0 flex-1 text-[15px]">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="rounded bg-card2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{it.level}</span>
          {it.skill === 'vocabulary' && <span className="font-semibold">{it.question}</span>}
        </div>
        {it.skill === 'grammar' && <div className="mb-1">{it.question}</div>}
        {it.skill === 'listening' ? (
          <>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {diffWords(it.correct, it.given).tokens.map((t, k) => (
                  <span key={k} className={t.ok ? 'text-ok' : 'text-bad underline'}>
                    {t.word}{' '}
                  </span>
                ))}
              </div>
              <SpeakButton size="sm" text={it.correct} />
            </div>
            <div className="mt-0.5 text-sm text-muted">Você escreveu: {it.given || '— (não entendi)'}</div>
          </>
        ) : ok ? (
          <div className="text-sm text-ok">{it.correct}</div>
        ) : (
          <div className="text-sm">
            <span className="text-bad">{it.given ? <span className="line-through">{it.given}</span> : 'Não sei'}</span>
            <span className="mx-1.5 text-dim">→</span>
            <span className="text-ok">{it.correct}</span>
          </div>
        )}
      </div>
    </li>
  )
}

/** Rever o último nivelamento (Ajustes). */
export function PlacementResultScreen() {
  const profile = useProfile()
  if (!profile) return null
  return (
    <Screen title="Seu nível" eyebrow="Último nivelamento" back="/ajustes">
      {profile.placement ? (
        <>
          <PlacementReport placement={profile.placement} />
          <Link to="/nivelamento" className="btn-ghost mt-5 w-full">
            Refazer o teste
          </Link>
        </>
      ) : (
        <Link to="/nivelamento" className="btn-primary w-full">
          Fazer o teste de nivelamento
        </Link>
      )}
    </Screen>
  )
}
