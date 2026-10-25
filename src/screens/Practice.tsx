import { Link } from 'react-router-dom'
import { useLearnerStats } from '../state/learner'
import { ratingToLevel } from '../engine/progress'
import { Screen } from '../components/ui'
import { Icon, SkillTile } from '../components/icons'
import type { Skill } from '../types'

const ITEMS: { skill: Skill; title: string; desc: string; to: string }[] = [
  { skill: 'vocabulary', title: 'Vocabulary', desc: 'Revisão espaçada e palavras novas', to: '/palavras' },
  { skill: 'grammar', title: 'Grammar', desc: '32 tópicos e aulas sob medida', to: '/praticar/gramatica' },
  { skill: 'listening', title: 'Listening', desc: 'Áudios, perguntas e ditado', to: '/praticar/listening' },
  { skill: 'writing', title: 'Writing', desc: 'Textos corrigidos pela IA', to: '/praticar/writing' },
  { skill: 'speaking', title: 'Speaking', desc: 'Repetir, responder e conversar', to: '/praticar/speaking' },
]

export function Practice() {
  const s = useLearnerStats()
  return (
    <Screen title="Praticar" eyebrow="Escolha a habilidade">
      <div className="grid grid-cols-2 gap-2.5">
        {ITEMS.map((it, i) => (
          <Link key={it.skill} to={it.to} className={`card flex flex-col gap-3 p-4 ${i === 0 ? 'col-span-2 flex-row items-center' : ''}`}>
            <SkillTile skill={it.skill} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-display text-lg font-semibold">{it.title}</div>
                {s && <span className="text-xs font-semibold text-muted">{ratingToLevel(s.ratings[it.skill]).label}</span>}
              </div>
              <div className="text-[13px] leading-snug text-muted">{it.desc}</div>
            </div>
          </Link>
        ))}
        <Link to="/tutor" className="card col-span-2 flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-fg/5">
            <Icon name="chat" />
          </span>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">Tutor</div>
            <div className="text-[13px] text-muted">Pergunte qualquer coisa sobre inglês</div>
          </div>
          <Icon name="chevron" size={18} className="text-dim" />
        </Link>
        <Link to="/erros/revisar" className="card col-span-2 flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-bad/10 text-bad">
            <Icon name="repeat" />
          </span>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">Caderno de erros</div>
            <div className="text-[13px] text-muted">{s?.dueMistakes ? `${s.dueMistakes} para revisar hoje` : 'Seus erros voltam até você acertar'}</div>
          </div>
          <Icon name="chevron" size={18} className="text-dim" />
        </Link>
      </div>
    </Screen>
  )
}
