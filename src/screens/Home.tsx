import { Link } from 'react-router-dom'
import { useLearnerStats } from '../state/learner'
import { dailyPlan, minutesToday, overallLabel, ratingToLevel, streak } from '../engine/progress'
import { today } from '../engine/srs'
import { SKILL_COLOR, SKILL_LABEL } from '../data'
import { SKILLS } from '../types'
import { Bar, Screen } from '../components/ui'

export function Home() {
  const s = useLearnerStats()
  if (!s) return null
  const { profile, attempts, cards, ratings, weaknesses } = s
  const due = cards.filter((c) => c.due <= today()).length
  const plan = dailyPlan({ profile, ratings, attempts, dueCards: due, totalCards: cards.length })
  const mins = minutesToday(attempts)
  const days = streak(attempts)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Screen>
      <div className="pt-4 pb-5">
        <div className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 className="h1 mt-1">
          {hello}
          {profile.name ? `, ${profile.name}` : ''}!
        </h1>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="Sequência" value={`${days} ${days === 1 ? 'dia' : 'dias'}`} icon="🔥" />
        <Stat label="Hoje" value={`${mins}/${profile.dailyMinutes} min`} icon="⏱" />
        <Stat label="Nível" value={attempts.length ? overallLabel(ratings) : profile.level} icon="🎯" />
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="h2">Plano de hoje</h2>
        <span className="text-xs text-muted">
          {plan.filter((p) => p.done).length}/{plan.length} feitos
        </span>
      </div>
      <div className="space-y-2">
        {plan.map((it) => (
          <Link key={it.title} to={it.to} className="card flex items-center gap-3 p-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-bg" style={{ background: SKILL_COLOR[it.skill] }}>
              {it.done ? '✓' : SKILL_LABEL[it.skill][0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${it.done ? 'text-muted line-through' : ''}`}>{it.title}</div>
              <div className="truncate text-xs text-muted">{it.why}</div>
            </div>
            <span className="text-xs text-dim">{it.minutes} min</span>
          </Link>
        ))}
      </div>

      {weaknesses.length > 0 && (
        <div className="card mt-5 p-4">
          <div className="eyebrow mb-2">Seus pontos de atenção</div>
          <div className="flex flex-wrap gap-1.5">
            {weaknesses.map((w) => (
              <Link key={w} to={`/praticar/gramatica/sugerida?foco=${encodeURIComponent(w)}`} className="chip text-sm">
                {w}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim">Toque num item para a IA criar uma aula focada nele.</p>
        </div>
      )}

      <div className="card mt-5 p-4">
        <div className="eyebrow mb-3">Nível por habilidade</div>
        <div className="space-y-2.5">
          {SKILLS.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-20 text-sm">{SKILL_LABEL[k]}</span>
              <div className="flex-1">
                <Bar value={ratings[k] / 600} color={SKILL_COLOR[k]} />
              </div>
              <span className="w-9 text-right text-sm font-semibold">{ratingToLevel(ratings[k]).label}</span>
            </div>
          ))}
        </div>
      </div>

      <Link to="/tutor" className="card mt-5 flex items-center gap-3 p-4">
        <span className="text-2xl">💬</span>
        <div>
          <div className="font-semibold">Tirar uma dúvida</div>
          <div className="text-xs text-muted">“Como digo X?”, “qual a diferença entre…?” — pergunte ao tutor.</div>
        </div>
      </Link>
    </Screen>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
    </div>
  )
}
