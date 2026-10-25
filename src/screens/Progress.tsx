import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { useLearnerStats } from '../state/learner'
import { minutesToday, ratingToLevel, streak } from '../engine/progress'
import { isMature, today } from '../engine/srs'
import { SKILL_COLOR, SKILL_LABEL } from '../data'
import { SKILLS, type Skill } from '../types'
import { Bar, Screen, SpeakButton } from '../components/ui'

export function ProgressScreen() {
  const s = useLearnerStats()
  const [showAll, setShowAll] = useState(false)
  if (!s) return null
  const { attempts, mistakes, cards, ratings, weaknesses } = s

  // Últimos 14 dias: minutos por dia.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = today(d)
    const mins = attempts.filter((a) => today(new Date(a.date)) === key).reduce((sum, a) => sum + a.seconds, 0) / 60
    return { key, mins, label: d.toLocaleDateString('pt-BR', { weekday: 'narrow' }) }
  })
  const maxMin = Math.max(10, ...days.map((d) => d.mins))
  const totalMin = Math.round(attempts.reduce((sum, a) => sum + a.seconds, 0) / 60)
  const perSkill = (k: Skill) => attempts.filter((a) => a.skill === k && a.activity !== 'card')
  const pending = mistakes.filter((m) => !m.reviewed).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Screen title="Progresso">
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Tile label="Sequência" value={`${streak(attempts)}d`} />
        <Tile label="Hoje" value={`${minutesToday(attempts)} min`} />
        <Tile label="Total" value={totalMin >= 60 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}` : `${totalMin} min`} />
      </div>

      <div className="card mb-4 p-4">
        <div className="eyebrow mb-3">Últimos 14 dias</div>
        <div className="flex h-24 items-end gap-1">
          {days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-accent/80" style={{ height: `${(d.mins / maxMin) * 80}px`, minHeight: d.mins ? 3 : 0 }} title={`${Math.round(d.mins)} min`} />
              <span className="text-[10px] text-dim">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-4 p-4">
        <div className="eyebrow mb-3">Nível estimado por habilidade</div>
        <div className="space-y-3.5">
          {SKILLS.map((k) => {
            const n = k === 'vocabulary' ? cards.length : perSkill(k).length
            return (
              <div key={k}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{SKILL_LABEL[k]}</span>
                  <span>
                    <strong>{ratingToLevel(ratings[k]).label}</strong>{' '}
                    <span className="text-xs text-dim">
                      · {n} {k === 'vocabulary' ? 'palavras' : 'atividades'}
                    </span>
                  </span>
                </div>
                <Bar value={ratings[k] / 600} color={SKILL_COLOR[k]} />
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-dim">Sobe quando você acerta conteúdo do seu nível ou acima; desce quando erra conteúdo mais fácil. Vocabulário: {cards.filter(isMature).length} palavras já firmes.</p>
      </div>

      {weaknesses.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="eyebrow mb-2">Pontos fracos (a IA foca neles)</div>
          <div className="flex flex-wrap gap-1.5">
            {weaknesses.map((w) => (
              <span key={w} className="chip text-sm">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="h2">Caderno de erros</h2>
        <span className="text-xs text-muted">{pending.length} em aberto</span>
      </div>
      {pending.length > 0 && (
        <Link to="/erros/revisar" className="btn-primary mb-3 w-full">
          Revisar erros agora
        </Link>
      )}
      {pending.length === 0 ? (
        <div className="card p-4 text-sm text-muted">Os erros dos exercícios e das correções da IA aparecem aqui para você revisar.</div>
      ) : (
        <div className="space-y-2">
          {(showAll ? pending : pending.slice(0, 15)).map((m) => (
            <div key={m.id} className="card p-3.5">
              <div className="text-[15px]">
                <span className="text-bad line-through decoration-bad/60">{m.wrong}</span>
                <span className="mx-1.5 text-dim">→</span>
                <span className="text-ok">{m.right}</span>
              </div>
              {m.note && <div className="mt-1 text-sm text-muted">{m.note}</div>}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-dim">
                  {SKILL_LABEL[m.skill]} · {m.tag}
                </span>
                <span className="ml-auto" />
                <SpeakButton size="sm" text={m.right} />
                <button className="rounded-full border border-line bg-card2 px-3 py-1.5 text-xs" onClick={() => db.mistakes.update(m.id!, { reviewed: true })}>
                  ✓ Entendi
                </button>
              </div>
            </div>
          ))}
          {pending.length > 15 && !showAll && (
            <button className="btn-ghost w-full text-sm" onClick={() => setShowAll(true)}>
              Ver todos ({pending.length})
            </button>
          )}
        </div>
      )}
    </Screen>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="font-display text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}
