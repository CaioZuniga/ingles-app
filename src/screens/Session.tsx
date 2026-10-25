import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { endSession, nextStep, stepDone, useSession } from '../state/session'
import { streak } from '../engine/progress'
import { SKILL_LABEL } from '../data'
import { Icon, SkillTile } from '../components/icons'
import { Screen } from '../components/ui'
import { SKILLS } from '../types'

/** Barra fixa no topo durante a sessão guiada: passo atual, progresso e "Próximo". */
export function SessionBar() {
  const s = useSession()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const attempts = useLiveQuery(() => (s ? db.attempts.where('date').aboveOrEqual(s.startedAt).toArray() : []), [s?.startedAt])
  if (!s || s.index >= s.steps.length || pathname === '/sessao/fim' || !attempts) return null
  const step = s.steps[s.index]
  const done = stepDone(step, attempts, s.startedAt)
  const last = s.index + 1 === s.steps.length
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2">
        <button aria-label="Sair da sessão" className="text-dim" onClick={endSession}>
          ✕
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => pathname !== step.to && nav(step.to)}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Sessão · {s.index + 1} de {s.steps.length}
          </div>
          <div className="flex gap-1 pt-1">
            {s.steps.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < s.index || (i === s.index && done) ? 'bg-accent' : i === s.index ? 'bg-accent/40' : 'bg-line'}`} />
            ))}
          </div>
        </button>
        <button
          className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold ${done ? 'bg-accent text-accent-ink' : 'border border-line text-muted'}`}
          onClick={() => nav(nextStep())}
        >
          {last ? 'Concluir' : done ? 'Próximo' : 'Pular'}
          <Icon name="chevron" size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}

/** Resumo no fim da sessão. */
export function SessionEnd() {
  const s = useSession()
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const since = s?.startedAt ?? new Date().toISOString().slice(0, 10)
    const [attempts, mistakes, all] = await Promise.all([db.attempts.where('date').aboveOrEqual(since).toArray(), db.mistakes.where('date').aboveOrEqual(since).toArray(), db.attempts.toArray()])
    return { attempts, mistakes, streak: streak(all) }
  }, [s?.startedAt])
  if (!data) return null
  const { attempts } = data
  const minutes = Math.max(1, Math.round(attempts.reduce((m, a) => m + a.seconds, 0) / 60))
  const cards = attempts.filter((a) => a.activity === 'card').length
  const bySkill = SKILLS.map((k) => {
    const list = attempts.filter((a) => a.skill === k && a.activity !== 'card')
    return { k, n: list.length, avg: list.length ? list.reduce((m, a) => m + a.score, 0) / list.length : null }
  }).filter((x) => x.n)

  return (
    <Screen>
      <div className="hero -mx-4 mb-5 px-4 pt-8 pb-6 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="h1 mt-3">Sessão concluída!</h1>
        <p className="mt-1 text-muted">
          {minutes} min de estudo · sequência de {data.streak} {data.streak === 1 ? 'dia' : 'dias'}
        </p>
      </div>
      <div className="card divide-y divide-line">
        {cards > 0 && (
          <div className="flex items-center gap-3 p-4">
            <SkillTile skill="vocabulary" />
            <div className="flex-1">Vocabulary</div>
            <div className="text-sm text-muted">{cards} cartões</div>
          </div>
        )}
        {bySkill.map(({ k, n, avg }) => (
          <div key={k} className="flex items-center gap-3 p-4">
            <SkillTile skill={k} />
            <div className="flex-1">
              {SKILL_LABEL[k]} <span className="text-sm text-muted">· {n} atividade{n > 1 ? 's' : ''}</span>
            </div>
            {avg !== null && <div className="font-display text-lg font-semibold">{Math.round(avg * 100)}%</div>}
          </div>
        ))}
      </div>
      {data.mistakes.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          {data.mistakes.length} erro{data.mistakes.length > 1 ? 's foram' : ' foi'} para o seu caderno — eles voltam na revisão até você acertar.
        </p>
      )}
      <button
        className="btn-primary mt-6 w-full"
        onClick={() => {
          endSession()
          nav('/')
        }}
      >
        Voltar ao início
      </button>
    </Screen>
  )
}
