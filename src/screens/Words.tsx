import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, logAttempt } from '../db/db'
import { rankFor, TOPIC_LABEL, VOCAB } from '../data'
import { isMature, previewInterval, review, today, type Grade } from '../engine/srs'
import { addWords } from '../engine/words'
import { generateVocab } from '../ai/tasks'
import { loadLearner, useProfile } from '../state/learner'
import { ErrorBox, LevelPill, Loading, NeedsKey, Screen, SpeakButton } from '../components/ui'
import type { Card, Topic, VocabItem } from '../types'

const NEW_PER_BATCH = 8

export function Words() {
  const profile = useProfile()
  const cards = useLiveQuery(() => db.cards.toArray())
  if (!profile || !cards) return null
  const due = cards.filter((c) => c.due <= today()).length
  const mature = cards.filter(isMature).length
  return (
    <Screen title="Palavras" eyebrow="Vocabulary">
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Box label="Para revisar" value={due} />
        <Box label="No baralho" value={cards.length} />
        <Box label="Aprendidas" value={mature} />
      </div>
      <Link to="/palavras/revisar" className="btn-primary mb-3 w-full">
        {due ? `Revisar agora (${due})` : 'Aprender palavras novas'}
      </Link>
      <Link to="/palavras/explorar" className="btn-ghost mb-6 w-full">
        Explorar banco, adicionar e sugestões da IA
      </Link>
      {cards.length > 0 && (
        <>
          <div className="eyebrow mb-2">Minhas palavras</div>
          <div className="space-y-1.5">
            {[...cards]
              .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
              .slice(0, 60)
              .map((c) => (
                <div key={c.id} className="card flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.term}</div>
                    <div className="truncate text-xs text-muted">{c.pt}</div>
                  </div>
                  <span className="text-[11px] text-dim">{c.due <= today() ? 'hoje' : new Date(c.due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <SpeakButton size="sm" text={c.term} />
                </div>
              ))}
          </div>
        </>
      )}
    </Screen>
  )
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

/** Escolhe palavras novas do banco para quem ainda não tem revisões. */
async function addNewBatch(profile: NonNullable<ReturnType<typeof useProfile>>) {
  const have = new Set((await db.cards.toArray()).map((c) => c.id))
  const pick = rankFor(VOCAB, profile).filter((v) => !have.has(v.id)).slice(0, NEW_PER_BATCH)
  await addWords(pick, 'bank', pick.map((v) => v.id))
}

export function WordReview() {
  const profile = useProfile()
  const queue = useLiveQuery(() => db.cards.where('due').belowOrEqual(today()).toArray())
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState<'en-pt' | 'pt-en'>('en-pt')
  const [doneCount, setDoneCount] = useState(0)
  const shown = useRef(Date.now())
  const [failed, setFailed] = useState<string[]>([])
  // Os que errei nesta sessão voltam para o fim da fila.
  const ordered = useMemo(
    () => (queue ? [...queue].sort((a, b) => failed.indexOf(a.id) - failed.indexOf(b.id) || a.due.localeCompare(b.due) || a.reps - b.reps) : []),
    [queue, failed],
  )
  if (!profile || !queue) return null
  const card = ordered[0]

  const grade = async (g: Grade, c: Card) => {
    const next = review(c, g)
    await db.cards.put(next)
    if (g === 0) setFailed([...failed.filter((x) => x !== c.id), c.id])
    await logAttempt({ skill: 'vocabulary', activity: 'card', level: profile.level, score: g === 0 ? 0 : g === 1 ? 0.6 : 1, seconds: Math.min(60, Math.round((Date.now() - shown.current) / 1000)), errorTags: g === 0 ? ['vocabulary-range'] : [] })
    setFlipped(false)
    setDoneCount(doneCount + 1)
    shown.current = Date.now()
  }

  return (
    <Screen title="Revisão" eyebrow="Vocabulary" back="/palavras" right={<span className="mt-2 text-sm text-muted">{queue.length} restantes</span>}>
      {!card ? (
        <div className="card p-6 text-center">
          <div className="text-4xl">🎉</div>
          <div className="mt-2 font-semibold">{doneCount ? `${doneCount} revisões feitas!` : 'Nada para revisar agora.'}</div>
          <p className="mt-1 text-sm text-muted">Quer aprender mais {NEW_PER_BATCH} palavras do seu nível e dos seus temas?</p>
          <button className="btn-primary mt-4 w-full" onClick={() => addNewBatch(profile)}>
            Adicionar {NEW_PER_BATCH} palavras novas
          </button>
          <Link to="/palavras/explorar" className="btn-ghost mt-2 w-full">
            Escolher eu mesmo
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end gap-1 text-xs">
            {(['en-pt', 'pt-en'] as const).map((m) => (
              <button key={m} className={mode === m ? 'chip-on py-1' : 'chip py-1'} onClick={() => setMode(m)}>
                {m === 'en-pt' ? 'EN → PT' : 'PT → EN'}
              </button>
            ))}
          </div>
          <div role="button" tabIndex={0} className="card block min-h-72 w-full cursor-pointer p-6 text-center" onClick={() => setFlipped(true)}>
            {mode === 'en-pt' || flipped ? (
              <div className="flex items-center justify-center gap-2">
                <div className="font-display text-3xl font-semibold">{card.term}</div>
                <SpeakButton text={card.term} size="sm" />
              </div>
            ) : (
              <div className="font-display text-2xl font-semibold">{card.pt}</div>
            )}
            {flipped ? (
              <div className="mt-5 space-y-3 text-left">
                {mode === 'en-pt' && <div className="text-center text-xl text-accent">{card.pt}</div>}
                <div className="text-sm text-muted">{card.definition}</div>
                <div className="flex items-start gap-2 rounded-xl bg-card2 p-3">
                  <span className="flex-1 italic">{card.example}</span>
                  <SpeakButton text={card.example} size="sm" />
                </div>
              </div>
            ) : (
              <div className="mt-10 text-sm text-dim">{mode === 'en-pt' ? 'Lembra o significado? Toque para ver.' : 'Como se diz em inglês? Fale ou pense, depois toque.'}</div>
            )}
          </div>
          {flipped && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(
                [
                  [0, 'Errei', 'text-bad'],
                  [1, 'Difícil', 'text-accent'],
                  [2, 'Bom', 'text-ok'],
                  [3, 'Fácil', 'text-lis'],
                ] as const
              ).map(([g, label, color]) => (
                <button key={g} className="btn-ghost flex-col gap-0 px-1 py-2.5" onClick={() => grade(g, card)}>
                  <span className={`text-sm ${color}`}>{label}</span>
                  <span className="text-[10px] font-normal text-dim">{previewInterval(card, g)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Screen>
  )
}

export function WordBrowse() {
  const profile = useProfile()
  const cards = useLiveQuery(() => db.cards.toArray())
  const [topic, setTopic] = useState<Topic | 'mine'>('mine')
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState('')
  const [ai, setAi] = useState<VocabItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState({ term: '', pt: '', example: '' })

  const list = useMemo(() => {
    if (!profile) return []
    const base = topic === 'mine' ? rankFor(VOCAB, profile).slice(0, 80) : VOCAB.filter((v) => v.topics.includes(topic))
    const s = q.trim().toLowerCase()
    return s ? VOCAB.filter((v) => v.term.toLowerCase().includes(s) || v.pt.toLowerCase().includes(s)) : base
  }, [profile, topic, q])

  if (!profile || !cards) return null
  const have = new Set(cards.map((c) => c.term.toLowerCase()))

  const suggest = async () => {
    setBusy(true)
    setError('')
    try {
      setAi(await generateVocab(await loadLearner(), theme || profile.context || profile.topics.join(', '), cards.map((c) => c.term)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Explorar" eyebrow="Vocabulary" back="/palavras">
      <section className="card mb-5 p-4">
        <div className="eyebrow mb-2">Sugestões da IA para você</div>
        <NeedsKey>
          <div className="flex gap-2">
            <input className="field" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Tema: ex. reunião com investidor" />
            <button className="btn-primary shrink-0" onClick={suggest} disabled={busy}>
              Sugerir
            </button>
          </div>
          {busy && <div className="mt-3"><Loading text="Escolhendo palavras…" /></div>}
          {error && <div className="mt-3"><ErrorBox error={error} onRetry={suggest} /></div>}
          {ai && (
            <div className="mt-3 space-y-1.5">
              {ai.map((v) => (
                <WordRow key={v.id} v={v} added={have.has(v.term.toLowerCase())} onAdd={() => addWords([v], 'ai')} />
              ))}
              <button className="btn-ghost w-full text-sm" onClick={() => addWords(ai, 'ai')}>
                Adicionar todas
              </button>
            </div>
          )}
        </NeedsKey>
      </section>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button className={topic === 'mine' ? 'chip-on shrink-0' : 'chip shrink-0'} onClick={() => setTopic('mine')}>
          Para você
        </button>
        {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => (
          <button key={t} className={topic === t ? 'chip-on shrink-0' : 'chip shrink-0'} onClick={() => setTopic(t)}>
            {TOPIC_LABEL[t]}
          </button>
        ))}
      </div>
      <input className="field mb-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no banco (inglês ou português)" />
      <div className="space-y-1.5">
        {list.map((v) => (
          <WordRow key={v.id} v={v} added={have.has(v.term.toLowerCase())} onAdd={() => addWords([v], 'bank', [v.id])} />
        ))}
      </div>

      <section className="card mt-6 p-4">
        <div className="eyebrow mb-2">Adicionar palavra minha</div>
        <div className="space-y-2">
          <input className="field" value={manual.term} onChange={(e) => setManual({ ...manual, term: e.target.value })} placeholder="Palavra ou expressão em inglês" autoCapitalize="off" />
          <input className="field" value={manual.pt} onChange={(e) => setManual({ ...manual, pt: e.target.value })} placeholder="Tradução" />
          <input className="field" value={manual.example} onChange={(e) => setManual({ ...manual, example: e.target.value })} placeholder="Frase de exemplo (opcional)" />
          <button
            className="btn-primary w-full"
            disabled={!manual.term.trim() || !manual.pt.trim()}
            onClick={async () => {
              await addWords([{ term: manual.term.trim(), pt: manual.pt.trim(), example: manual.example.trim(), definition: '' }], 'user')
              setManual({ term: '', pt: '', example: '' })
            }}
          >
            Adicionar
          </button>
        </div>
      </section>
    </Screen>
  )
}

function WordRow({ v, added, onAdd }: { v: VocabItem; added: boolean; onAdd: () => void }) {
  return (
    <div className="card flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{v.term}</span>
          <LevelPill level={v.level} />
        </div>
        <div className="text-sm text-muted">{v.pt}</div>
        <div className="mt-1 text-sm italic text-dim">{v.example}</div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <SpeakButton size="sm" text={v.term} />
        <button onClick={onAdd} disabled={added} className={`h-8 w-8 rounded-full border text-lg ${added ? 'border-ok text-ok' : 'border-line bg-card2'}`} aria-label="Adicionar">
          {added ? '✓' : '+'}
        </button>
      </div>
    </div>
  )
}
