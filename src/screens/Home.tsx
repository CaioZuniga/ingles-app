import { Link, useNavigate } from 'react-router-dom'
import { useLearnerStats } from '../state/learner'
import { minutesToday, overallLabel, ratingToLevel, streak } from '../engine/progress'
import { SKILL_COLOR, SKILL_LABEL } from '../data'
import { SKILLS } from '../types'
import { startSession, useSession } from '../state/session'
import { Bar, Screen } from '../components/ui'
import { Icon, Ring, SkillTile } from '../components/icons'

export function Home() {
  const s = useLearnerStats()
  const session = useSession()
  const nav = useNavigate()
  if (!s) return null
  const { profile, attempts, ratings, weaknesses, plan } = s
  const mins = minutesToday(attempts)
  const days = streak(attempts)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const pending = plan.filter((p) => !p.done)
  const inSession = session && session.index < session.steps.length
  const showPlacement = !profile.placement && attempts.filter((a) => a.activity !== 'card').length < 15

  return (
    <Screen>
      <section className="hero -mx-4 px-4 pt-5 pb-6">
        <div className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 className="mt-1 font-display text-[32px] leading-tight font-semibold">
          {hello}
          {profile.name ? `, ${profile.name}` : ''}.
        </h1>
        <div className="mt-5 flex items-center gap-5">
          <Ring value={mins / profile.dailyMinutes} size={88} stroke={8}>
            <div>
              <div className="font-display text-2xl leading-none font-semibold">{mins}</div>
              <div className="text-[10px] text-muted">de {profile.dailyMinutes} min</div>
            </div>
          </Ring>
          <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
            <Stat icon="flame" color="var(--color-spk)" value={`${days}`} label={days === 1 ? 'dia seguido' : 'dias seguidos'} />
            <Stat icon="target" color="var(--color-gra)" value={attempts.length ? overallLabel(ratings) : profile.level} label="nível geral" />
            <Stat icon="check" color="var(--color-ok)" value={`${plan.filter((p) => p.done).length}/${plan.length}`} label="do plano" />
            <Stat icon="cards" color="var(--color-voc)" value={`${s.dueCards}`} label="para revisar" />
          </div>
        </div>
      </section>

      {showPlacement && (
        <Link to="/nivelamento" className="card mb-4 flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
            <Icon name="compass" />
          </span>
          <div className="flex-1">
            <div className="font-semibold">Faça o teste de nivelamento</div>
            <div className="text-xs text-muted">8 minutos para o app começar no nível certo de cada habilidade.</div>
          </div>
          <Icon name="chevron" size={18} className="text-dim" />
        </Link>
      )}

      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="h2">Plano de hoje</h2>
        <span className="text-xs text-muted">~{plan.reduce((m, p) => m + p.minutes, 0)} min</span>
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {plan.map((it) => (
          <Link key={it.to} to={it.to} className="flex items-center gap-3 px-4 py-3.5 active:bg-card2">
            <SkillTile skill={it.skill} done={it.done} />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-medium ${it.done ? 'text-muted line-through decoration-dim' : ''}`}>{it.title}</div>
              <div className="truncate text-xs text-muted">{it.why}</div>
            </div>
            <span className="text-xs text-dim">{it.minutes} min</span>
          </Link>
        ))}
      </div>
      {pending.length > 0 ? (
        <button
          className="btn-primary mt-3 w-full py-3.5 text-[15px]"
          onClick={() => {
            if (inSession) return nav(session.steps[session.index].to)
            const first = startSession(plan)
            if (first) nav(first)
          }}
        >
          <Icon name="play" size={16} />
          {inSession ? `Continuar sessão (${session.index + 1}/${session.steps.length})` : `Começar sessão guiada · ${pending.length} ${pending.length > 1 ? 'etapas' : 'etapa'}`}
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-ok/10 px-4 py-3 text-center text-sm text-ok">Plano de hoje completo. Quer mais? Escolha qualquer prática em Praticar.</div>
      )}

      {weaknesses.length > 0 && (
        <section className="mt-6">
          <h2 className="h2 mb-2.5">Pontos de atenção</h2>
          <div className="flex flex-wrap gap-1.5">
            {weaknesses.map((w) => (
              <Link key={w} to={`/praticar/gramatica/sugerida?foco=${encodeURIComponent(w)}`} className="chip text-sm">
                {w}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-dim">Toque num item para a IA criar uma aula focada nele.</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="h2 mb-2.5">Nível por habilidade</h2>
        <div className="card space-y-3 p-4">
          {SKILLS.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <SkillTile skill={k} size={30} />
              <span className="w-20 text-sm">{SKILL_LABEL[k]}</span>
              <div className="flex-1">
                <Bar value={ratings[k] / 600} color={SKILL_COLOR[k]} />
              </div>
              <span className="w-9 text-right text-sm font-semibold">{ratingToLevel(ratings[k]).label}</span>
            </div>
          ))}
        </div>
      </section>

      <Link to="/tutor" className="card mt-6 flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-fg/5">
          <Icon name="chat" />
        </span>
        <div className="flex-1">
          <div className="font-semibold">Tirar uma dúvida</div>
          <div className="text-xs text-muted">“Como digo X?”, “qual a diferença entre…?”</div>
        </div>
        <Icon name="chevron" size={18} className="text-dim" />
      </Link>
    </Screen>
  )
}

function Stat({ icon, color, value, label }: { icon: Parameters<typeof Icon>[0]['name']; color: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>
        <Icon name={icon} size={18} />
      </span>
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  )
}
