import { Link } from 'react-router-dom'
import { SKILL_COLOR } from '../data'
import { Screen } from '../components/ui'
import type { Skill } from '../types'

const ITEMS: { skill: Skill; title: string; desc: string; to: string }[] = [
  { skill: 'vocabulary', title: 'Vocabulary', desc: 'Revisão espaçada, palavras novas e sugestões da IA', to: '/palavras' },
  { skill: 'grammar', title: 'Grammar', desc: '30+ tópicos com exercícios e aulas sob medida', to: '/praticar/gramatica' },
  { skill: 'listening', title: 'Listening', desc: 'Áudios com perguntas e ditado; a IA cria novos', to: '/praticar/listening' },
  { skill: 'writing', title: 'Writing', desc: 'E-mails, textos e redações de prova corrigidos', to: '/praticar/writing' },
  { skill: 'speaking', title: 'Speaking', desc: 'Repetição, respostas faladas e conversas com a IA', to: '/praticar/speaking' },
]

export function Practice() {
  return (
    <Screen title="Praticar" eyebrow="Escolha a habilidade">
      <div className="space-y-2.5">
        {ITEMS.map((it) => (
          <Link key={it.skill} to={it.to} className="card flex items-center gap-4 p-4">
            <span className="h-12 w-1.5 rounded-full" style={{ background: SKILL_COLOR[it.skill] }} />
            <div className="flex-1">
              <div className="font-display text-lg font-semibold">{it.title}</div>
              <div className="text-sm text-muted">{it.desc}</div>
            </div>
            <span className="text-dim">›</span>
          </Link>
        ))}
        <Link to="/tutor" className="card flex items-center gap-4 p-4">
          <span className="h-12 w-1.5 rounded-full bg-fg/40" />
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">Tutor</div>
            <div className="text-sm text-muted">Pergunte qualquer coisa sobre inglês</div>
          </div>
          <span className="text-dim">›</span>
        </Link>
      </div>
    </Screen>
  )
}
