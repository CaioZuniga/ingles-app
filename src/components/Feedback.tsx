import { useState } from 'react'
import type { Issue, NewWord } from '../ai/tasks'
import { addWords } from '../engine/words'
import { SpeakButton } from './ui'

// Blocos de feedback da IA reaproveitados em writing, speaking e roleplay.

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <div className="text-sm text-ok">Nenhum erro importante. Muito bem!</div>
  return (
    <ul className="space-y-2.5">
      {issues.map((it, i) => (
        <li key={i} className="rounded-xl bg-card2 p-3">
          <div className="text-[15px]">
            <span className="text-bad line-through decoration-bad/60">{it.wrong}</span>
            <span className="mx-1.5 text-dim">→</span>
            <span className="text-ok">{it.right}</span>
          </div>
          <div className="mt-1 text-sm text-muted">{it.note}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-dim">{it.tag}</div>
        </li>
      ))}
    </ul>
  )
}

export function NewWords({ words }: { words: NewWord[] }) {
  const [saved, setSaved] = useState<number | null>(null)
  if (!words.length) return null
  return (
    <div>
      <ul className="space-y-2">
        {words.map((w, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-card2 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {w.term} <span className="font-normal text-muted">— {w.pt}</span>
              </div>
              <div className="text-sm text-muted italic">{w.example}</div>
            </div>
            <SpeakButton size="sm" text={w.term} />
          </li>
        ))}
      </ul>
      <button className="btn-ghost mt-3 w-full text-sm" disabled={saved !== null} onClick={async () => setSaved(await addWords(words, 'ai'))}>
        {saved === null ? '＋ Salvar nas minhas palavras' : saved ? `${saved} palavra${saved > 1 ? 's' : ''} salva${saved > 1 ? 's' : ''} para revisão` : 'Já estavam salvas'}
      </button>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="eyebrow mb-2.5">{title}</div>
      {children}
    </section>
  )
}
