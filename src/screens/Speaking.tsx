import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { PHRASES, rankFor, ROLEPLAYS, SPEAKING_PROMPTS } from '../data'
import { db, logAttempt, logMistakes } from '../db/db'
import { customRoleplay, evaluateSpeaking, roleplayReport, roleplayTurn, type ChatLine, type RoleplayReport, type RoleplayTurn, type SpeakingFeedback } from '../ai/tasks'
import { loadLearner, useProfile } from '../state/learner'
import { diffWords } from '../engine/diff'
import { speak, stop } from '../speech/tts'
import { sttSupported } from '../speech/stt'
import { IssueList, NewWords, Section } from '../components/Feedback'
import { Bar, ErrorBox, LevelPill, Loading, MicButton, NeedsKey, ScoreBadge, Screen, SpeakButton, useSpeechPrefs } from '../components/ui'
import type { Roleplay } from '../types'

function NoMicHint() {
  if (sttSupported()) return null
  return (
    <p className="text-xs text-dim">
      Este navegador não reconhece fala diretamente. Toque no campo de texto e use o <strong>microfone do teclado</strong> (ditado) para falar.
    </p>
  )
}

export function SpeakingHub() {
  const profile = useProfile()
  const custom = useLiveQuery(() => db.lessons.where('skill').equals('speaking').reverse().limit(10).toArray())
  if (!profile) return null
  const roleplays = rankFor(ROLEPLAYS, profile)
  const prompts = rankFor(SPEAKING_PROMPTS, profile).slice(0, 12)
  return (
    <Screen title="Speaking" back="/praticar">
      <Link to="/praticar/speaking/shadowing" className="card mb-3 flex items-center gap-3 p-4">
        <span className="text-2xl">🔁</span>
        <div>
          <div className="font-semibold">Ouvir e repetir (shadowing)</div>
          <div className="text-xs text-muted">Pronúncia frase a frase, com conferência palavra por palavra. Funciona sem IA.</div>
        </div>
      </Link>

      <div className="eyebrow mb-2 mt-6">Conversas com a IA</div>
      <Link to="/praticar/speaking/conversa/nova" className="card mb-2 flex items-center gap-3 border-spk/40 p-4">
        <span className="text-2xl">✨</span>
        <div>
          <div className="font-semibold">Situação sob medida</div>
          <div className="text-xs text-muted">Descreva uma situação real que você vai viver e ensaie.</div>
        </div>
      </Link>
      <div className="space-y-1.5">
        {custom
          ?.filter((c) => (c.payload as { kind?: string }).kind === 'roleplay')
          .map((c) => (
            <Link key={c.id} to={`/praticar/speaking/conversa/r-${c.id}`} className="card flex items-center gap-3 px-4 py-3">
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-xs text-dim">sua</span>
            </Link>
          ))}
        {roleplays.map((r) => (
          <Link key={r.id} to={`/praticar/speaking/conversa/${r.id}`} className="card flex items-center gap-3 px-4 py-3">
            <span className="flex-1 truncate">{r.title}</span>
            <LevelPill level={r.level} />
          </Link>
        ))}
      </div>

      <div className="eyebrow mb-2 mt-6">Responder em voz alta</div>
      <div className="space-y-1.5">
        {prompts.map((p) => (
          <Link key={p.id} to={`/praticar/speaking/resposta/${p.id}`} className="card flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 text-[15px]">{p.prompt}</span>
            {p.exam && p.exam !== 'none' && <span className="text-[10px] font-semibold text-accent">{p.exam.toUpperCase()}</span>}
            <LevelPill level={p.level} />
          </Link>
        ))}
      </div>
    </Screen>
  )
}

// ---------- Shadowing ----------

const ROUND = 8

export function Shadowing() {
  const profile = useProfile()
  const prefs = useSpeechPrefs()
  const [round, setRound] = useState(0)
  const phrases = useMemo(() => {
    if (!profile) return []
    // Rodízio: pega os mais relevantes e embaralha um pouco a cada rodada.
    const ranked = rankFor(PHRASES, profile).slice(0, 40)
    return [...ranked].sort(() => Math.random() - 0.5).slice(0, ROUND)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.level, round])
  const [i, setI] = useState(0)
  const [heard, setHeard] = useState('')
  const [typed, setTyped] = useState('')
  const scores = useRef<number[]>([])
  const started = useRef(Date.now())
  const [finished, setFinished] = useState<number | null>(null)
  if (!profile || !phrases.length) return null
  const p = phrases[i]
  const result = heard ? diffWords(p.text, heard) : null

  const next = async () => {
    scores.current[i] = result?.score ?? 0
    setHeard('')
    setTyped('')
    if (i + 1 < phrases.length) setI(i + 1)
    else {
      const avg = scores.current.reduce((a, b) => a + b, 0) / phrases.length
      await logAttempt({ skill: 'speaking', activity: 'shadowing', level: profile.level, score: avg, seconds: Math.round((Date.now() - started.current) / 1000), errorTags: avg < 0.7 ? ['pronunciation'] : [] })
      setFinished(avg)
    }
  }

  if (finished !== null)
    return (
      <Screen title="Shadowing" eyebrow="Speaking" back="/praticar/speaking">
        <div className="card p-6 text-center">
          <div className="font-display text-5xl font-semibold">{Math.round(finished * 100)}%</div>
          <div className="mt-2 text-muted">das palavras reconhecidas corretamente</div>
          <button
            className="btn-primary mt-5 w-full"
            onClick={() => {
              setFinished(null)
              setI(0)
              scores.current = []
              started.current = Date.now()
              setRound(round + 1)
            }}
          >
            Mais {ROUND} frases
          </button>
        </div>
      </Screen>
    )

  return (
    <Screen title="Shadowing" eyebrow="Speaking" back="/praticar/speaking" right={<span className="mt-2 text-sm text-muted">{i + 1}/{phrases.length}</span>}>
      <div className="mb-4">
        <Bar value={i / phrases.length} color="var(--color-spk)" />
      </div>
      <div className="card p-5">
        <div className="font-display text-2xl leading-snug font-semibold">{p.text}</div>
        <div className="mt-2 text-muted">{p.pt}</div>
        {p.tip && <div className="mt-3 rounded-xl bg-card2 p-3 text-sm">💡 {p.tip}</div>}
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => speak(p.text, prefs)}>
            🔊 Ouvir
          </button>
          <button className="btn-ghost flex-1" onClick={() => speak(p.text, { ...prefs, rate: prefs.rate * 0.65 })}>
            🐢 Devagar
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <MicButton onResult={setHeard} />
        <NoMicHint />
        {!sttSupported() && (
          <div className="flex w-full gap-2">
            <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Dite aqui com o microfone do teclado" lang="en" />
            <button className="btn-ghost" onClick={() => setHeard(typed)}>
              OK
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="card mt-4 p-4">
          <div className="eyebrow mb-2">Entendi: “{heard}”</div>
          <div className="text-lg">
            {result.tokens.map((t, k) => (
              <span key={k} className={t.ok ? 'text-ok' : 'text-bad underline decoration-wavy'}>
                {t.word}{' '}
              </span>
            ))}
          </div>
          <div className="mt-2 text-sm text-muted">{result.score >= 0.9 ? 'Perfeito!' : result.score >= 0.7 ? 'Bom! Repita as palavras em vermelho.' : 'Ouça de novo, devagar, e tente outra vez.'}</div>
        </div>
      )}
      <button className="btn-primary mt-4 w-full" onClick={next}>
        {heard ? 'Próxima frase' : 'Pular'}
      </button>
    </Screen>
  )
}

// ---------- Responder em voz alta ----------

export function SpeakingPromptScreen() {
  const { id } = useParams()
  const p = SPEAKING_PROMPTS.find((x) => x.id === id)
  const profile = useProfile()
  const [text, setText] = useState('')
  const [live, setLive] = useState('')
  const [t0, setT0] = useState<number | null>(null)
  const [secs, setSecs] = useState(0)
  const [fb, setFb] = useState<SpeakingFeedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (t0 === null) return
    const h = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 500)
    return () => clearInterval(h)
  }, [t0])

  if (!p || !profile) return <Screen title="Não encontrado" back="/praticar/speaking">{null}</Screen>
  const exam = p.exam && p.exam !== 'none' ? p.exam : undefined

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const f = await evaluateSpeaking(await loadLearner(), p.prompt, text, secs || p.seconds, exam)
      setFb(f)
      await logAttempt({ skill: 'speaking', activity: `speaking:${p.id}`, level: p.level, score: Math.max(0, Math.min(1, f.score / 100)), seconds: secs, errorTags: [...new Set(f.issues.map((x) => x.tag))] })
      await logMistakes(f.issues.map((x) => ({ skill: 'speaking' as const, tag: x.tag, wrong: x.wrong, right: x.right, note: x.note })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Responder" eyebrow={`Speaking · ${p.level}${exam ? ' · ' + exam.toUpperCase() : ''}`} back="/praticar/speaking">
      <div className="card p-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 text-lg leading-snug">{p.prompt}</div>
          <SpeakButton text={p.prompt} size="sm" />
        </div>
        <div className="mt-2 text-xs text-dim">Fale por cerca de {p.seconds} segundos.</div>
      </div>

      {fb ? (
        <div className="mt-4 space-y-3">
          <div className="card flex items-center gap-4 p-4">
            <ScoreBadge score={fb.score} />
            <div>
              <div className="font-semibold">Nível estimado: {fb.cefr}</div>
              <div className="mt-1 text-sm text-muted">{fb.summary}</div>
            </div>
          </div>
          <Section title="Fluência">
            <div className="text-sm">{fb.fluency}</div>
          </Section>
          <Section title="O que você disse">
            <div className="text-sm text-muted italic">{text}</div>
          </Section>
          <Section title={`Ajustes (${fb.issues.length})`}>
            <IssueList issues={fb.issues} />
          </Section>
          <Section title="Uma resposta mais natural">
            <div className="text-[15px] leading-relaxed">{fb.better}</div>
            <div className="mt-3">
              <SpeakButton text={fb.better} label="Ouvir e repetir" size="sm" />
            </div>
          </Section>
          {fb.pronunciationWatch.length > 0 && (
            <Section title="Atenção na pronúncia">
              <ul className="space-y-1.5 text-sm">
                {fb.pronunciationWatch.map((w, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <SpeakButton size="sm" text={w.split(/\s[—–-]\s/)[0]} />
                    {w}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Expressões úteis">
            <NewWords words={fb.newWords} />
          </Section>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              setFb(null)
              setText('')
              setSecs(0)
            }}
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <MicButton
              continuous
              onInterim={(t) => {
                if (t0 === null) setT0(Date.now())
                setLive(t)
              }}
              onResult={(t) => {
                setText((prev) => (prev ? prev + ' ' : '') + t)
                setLive('')
                setT0(null)
              }}
            />
            <div className="font-display text-2xl">{secs}s</div>
          </div>
          <NoMicHint />
          <textarea
            className="field min-h-36"
            value={live ? (text ? text + ' ' : '') + live : text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => t0 === null && !text && setT0(Date.now())}
            placeholder="Sua fala aparece aqui (dá para corrigir erros do reconhecimento antes de enviar)."
            lang="en"
          />
          <NeedsKey>
            {busy && <Loading text="Avaliando sua resposta…" />}
            {error && <ErrorBox error={error} onRetry={submit} />}
            {!busy && (
              <button className="btn-primary w-full" disabled={text.trim().split(/\s+/).length < 5} onClick={submit}>
                Avaliar com IA
              </button>
            )}
          </NeedsKey>
        </div>
      )}
    </Screen>
  )
}

// ---------- Conversa (roleplay) ----------

interface Msg extends ChatLine {
  correction?: RoleplayTurn['correction']
}

export function RoleplayScreen() {
  const { id = '' } = useParams()
  const rp = useLiveQuery(async (): Promise<Roleplay | null> => {
    if (id === 'nova') return null
    if (id.startsWith('r-')) {
      const l = await db.lessons.get(Number(id.slice(2)))
      return ((l?.payload as { roleplay?: Roleplay })?.roleplay as Roleplay) ?? null
    }
    return ROLEPLAYS.find((r) => r.id === id) ?? null
  }, [id])
  if (id === 'nova') return <NewRoleplay />
  if (rp === undefined) return null
  if (!rp) return <Screen title="Conversa não encontrada" back="/praticar/speaking">{null}</Screen>
  return <Conversation key={rp.id} rp={rp} />
}

function NewRoleplay() {
  const nav = useNavigate()
  const profile = useProfile()
  const [situation, setSituation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!profile) return null
  const make = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await customRoleplay(await loadLearner(), situation)
      const roleplay: Roleplay = { ...r, id: `custom-${Date.now()}`, level: profile.level, topics: [] }
      const lid = await db.lessons.add({ date: new Date().toISOString(), skill: 'speaking', title: r.title, payload: { kind: 'roleplay', roleplay } })
      nav(`/praticar/speaking/conversa/r-${lid}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Screen title="Situação sob medida" eyebrow="Speaking · IA" back="/praticar/speaking">
      <NeedsKey>
        <div className="space-y-4">
          <textarea
            className="field min-h-32"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Ex.: amanhã tenho call com um fundo americano para apresentar um galpão logístico em Cajamar; eles vão perguntar sobre vacância e cap rate."
          />
          {busy && <Loading text="Preparando a cena…" />}
          {error && <ErrorBox error={error} onRetry={make} />}
          {!busy && (
            <button className="btn-primary w-full" disabled={situation.trim().length < 10} onClick={make}>
              Começar conversa
            </button>
          )}
        </div>
      </NeedsKey>
    </Screen>
  )
}

function Conversation({ rp }: { rp: Roleplay }) {
  const prefs = useSpeechPrefs()
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'ai', text: rp.opener }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voice, setVoice] = useState(true)
  const [report, setReport] = useState<RoleplayReport | null>(null)
  const [ending, setEnding] = useState(false)
  const [started] = useState(Date.now())
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])
  useEffect(() => () => stop(), [])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    const history: Msg[] = [...msgs, { who: 'me', text: t }]
    setMsgs(history)
    setDraft('')
    setBusy(true)
    setError('')
    try {
      const turn = await roleplayTurn(await loadLearner(), rp, history)
      const withCorr = history.map((m, i) => (i === history.length - 1 ? { ...m, correction: turn.correction } : m))
      setMsgs([...withCorr, { who: 'ai', text: turn.reply }])
      if (turn.correction.has) await logMistakes([{ skill: 'speaking', tag: turn.correction.tag || 'naturalness', wrong: turn.correction.original, right: turn.correction.better, note: turn.correction.note }])
      if (voice) void speak(turn.reply, prefs)
      if (turn.finished) void finish([...withCorr, { who: 'ai', text: turn.reply }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const finish = async (lines = msgs) => {
    if (lines.filter((m) => m.who === 'me').length < 2) return
    stop()
    setEnding(true)
    setError('')
    try {
      const r = await roleplayReport(await loadLearner(), rp.title, lines)
      setReport(r)
      const tags = [...new Set(lines.filter((m) => m.correction?.has).map((m) => m.correction!.tag))]
      await logAttempt({ skill: 'speaking', activity: `roleplay:${rp.id}`, level: rp.level, score: Math.max(0, Math.min(1, r.score / 100)), seconds: Math.round((Date.now() - started) / 1000), errorTags: tags })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnding(false)
    }
  }

  const myTurns = msgs.filter((m) => m.who === 'me').length

  return (
    <Screen
      title={rp.title}
      eyebrow="Conversa"
      back="/praticar/speaking"
      right={
        <button className="mt-1 rounded-full border border-line bg-card px-3 py-1.5 text-xs" onClick={() => setVoice(!voice)}>
          {voice ? '🔊 voz' : '🔇 mudo'}
        </button>
      }
    >
      <div className="card mb-4 p-4 text-sm">
        <div className="text-muted">{rp.setup}</div>
        <div className="mt-2">
          <strong>Seu objetivo:</strong> {rp.goal}
        </div>
      </div>

      <NeedsKey>
        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.who === 'me' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${m.who === 'me' ? 'rounded-br-md bg-spk/20' : 'rounded-bl-md bg-card2'}`}>
                {m.text}
                {m.who === 'ai' && (
                  <button className="ml-2 align-middle text-xs text-muted" onClick={() => speak(m.text, prefs)} aria-label="Ouvir">
                    🔊
                  </button>
                )}
              </div>
              {m.correction?.has && (
                <div className="mt-1 max-w-[85%] rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
                  <span className="text-muted line-through">{m.correction.original}</span> → <span className="text-accent">{m.correction.better}</span>
                  <div className="mt-0.5 text-muted">{m.correction.note}</div>
                </div>
              )}
            </div>
          ))}
          {busy && <div className="text-sm text-muted">digitando…</div>}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mt-3">
            <ErrorBox error={error} />
          </div>
        )}

        {report ? (
          <div className="mt-5 space-y-3">
            <div className="card flex items-center gap-4 p-4">
              <ScoreBadge score={report.score} />
              <div className="text-sm text-muted">{report.summary}</div>
            </div>
            <Section title="Foi bem">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {report.wentWell.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
            <Section title="Para melhorar">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {report.improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
            <Section title="Expressões que cabiam aqui">
              <NewWords words={report.newWords} />
            </Section>
          </div>
        ) : ending ? (
          <div className="mt-4">
            <Loading text="Preparando sua avaliação…" />
          </div>
        ) : (
          <div className="sticky bottom-20 mt-5 rounded-2xl border border-line bg-bg/95 p-3 backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                className="field max-h-32 min-h-12 flex-1 py-2.5"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={sttSupported() ? 'Fale no microfone ou digite' : 'Digite ou use o microfone do teclado'}
                lang="en"
              />
              <button className="btn-primary h-12 px-4" disabled={!draft.trim() || busy} onClick={() => send(draft)}>
                ➤
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <MicButton disabled={busy} onInterim={setDraft} onResult={(t) => void send(t)} />
              <button className="btn-ghost py-2 text-sm" disabled={myTurns < 2 || busy} onClick={() => finish()}>
                Encerrar e avaliar
              </button>
            </div>
          </div>
        )}
      </NeedsKey>
    </Screen>
  )
}
