import { useEffect, useRef, useState } from 'react'
import { askTutor, type ChatLine } from '../ai/tasks'
import { loadLearner } from '../state/learner'
import { ErrorBox, NeedsKey, Rich, Screen } from '../components/ui'

const STARTERS = [
  'Qual a diferença entre “since” e “for”?',
  'Como digo “vacância” e “cap rate” numa call?',
  'Quando uso “the” antes de nomes de lugares?',
  'Como soar mais educado num e-mail cobrando um cliente?',
]

export function Tutor() {
  const [lines, setLines] = useState<ChatLine[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, busy])

  const send = async (q: string) => {
    if (!q.trim() || busy) return
    const next: ChatLine[] = [...lines, { who: 'me', text: q.trim() }]
    setLines(next)
    setDraft('')
    setBusy(true)
    setError('')
    try {
      setLines([...next, { who: 'ai', text: await askTutor(await loadLearner(), next) }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Tutor" eyebrow="Dúvidas de inglês" back>
      <NeedsKey>
        {!lines.length && (
          <div className="space-y-2">
            {STARTERS.map((s) => (
              <button key={s} className="card block w-full px-4 py-3 text-left text-[15px]" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {lines.map((l, i) =>
            l.who === 'me' ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5">
                {l.text}
              </div>
            ) : (
              <div key={i} className="card p-4">
                <Rich text={l.text} />
              </div>
            ),
          )}
          {busy && <div className="text-sm text-muted">pensando…</div>}
          {error && <ErrorBox error={error} />}
          <div ref={endRef} />
        </div>
        <form
          className="sticky bottom-20 mt-4 flex gap-2 rounded-2xl border border-line bg-bg/95 p-2 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
        >
          <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pergunte em português ou inglês" />
          <button className="btn-primary px-4" disabled={!draft.trim() || busy}>
            ➤
          </button>
        </form>
      </NeedsKey>
    </Screen>
  )
}
