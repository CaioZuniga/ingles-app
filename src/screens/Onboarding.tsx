import { useState } from 'react'
import { db } from '../db/db'
import { TOPIC_LABEL } from '../data'
import { LEVELS, type ExamType, type Goal, type Level, type Profile, type Topic } from '../types'

// Cadastro inicial: nível, demandas, temas e contexto pessoal. Tudo pode ser mudado depois em Ajustes.

export const LEVEL_DESC: Record<Level, string> = {
  A1: 'Iniciante — frases muito simples',
  A2: 'Básico — situações do dia a dia',
  B1: 'Intermediário — me viro, com erros',
  B2: 'Intermediário avançado — converso bem',
  C1: 'Avançado — fluente com pequenos deslizes',
  C2: 'Proficiente — quase nativo',
}

export const GOAL_INFO: Record<Goal, { label: string; desc: string }> = {
  work: { label: 'Trabalho / negócios', desc: 'Reuniões, e-mails, apresentações' },
  travel: { label: 'Viagem / dia a dia', desc: 'Conversação prática' },
  exam: { label: 'Prova / certificação', desc: 'TOEFL, IELTS, Cambridge' },
  content: { label: 'Conteúdo / leitura', desc: 'Séries, podcasts, livros' },
}

export function ProfileForm({ initial, onSave, cta }: { initial: Profile; onSave: (p: Profile) => void; cta: string }) {
  const [p, setP] = useState(initial)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((cur) => ({ ...cur, [k]: v }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="space-y-6">
      <label className="block">
        <div className="eyebrow mb-2">Seu nome</div>
        <input className="field" value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Como quer ser chamado" />
      </label>

      <div>
        <div className="eyebrow mb-2">Seu nível hoje</div>
        <div className="space-y-1.5">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => set('level', l)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${p.level === l ? 'border-accent bg-accent/10' : 'border-line bg-card'}`}>
              <span className="w-8 font-display font-semibold">{l}</span>
              <span className="text-sm text-muted">{LEVEL_DESC[l]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Não precisa acertar: o app recalcula seu nível em cada habilidade conforme você pratica.</p>
      </div>

      <div>
        <div className="eyebrow mb-2">Para que você quer inglês?</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GOAL_INFO) as Goal[]).map((g) => (
            <button key={g} onClick={() => set('goals', toggle(p.goals, g))} className={`rounded-xl border p-3 text-left ${p.goals.includes(g) ? 'border-accent bg-accent/10' : 'border-line bg-card'}`}>
              <div className="font-semibold">{GOAL_INFO[g].label}</div>
              <div className="text-xs text-muted">{GOAL_INFO[g].desc}</div>
            </button>
          ))}
        </div>
      </div>

      {p.goals.includes('exam') && (
        <div>
          <div className="eyebrow mb-2">Qual prova?</div>
          <div className="flex flex-wrap gap-2">
            {(['toefl', 'ielts', 'cambridge', 'none'] as ExamType[]).map((e) => (
              <button key={e} onClick={() => set('exam', e)} className={p.exam === e ? 'chip-on' : 'chip'}>
                {e === 'none' ? 'Ainda não sei' : e.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="eyebrow mb-2">Temas que te interessam</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => (
            <button key={t} onClick={() => set('topics', toggle(p.topics, t))} className={p.topics.includes(t) ? 'chip-on' : 'chip'}>
              {TOPIC_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <div className="eyebrow mb-2">Conte sua situação (a IA usa isso)</div>
        <textarea
          className="field min-h-24"
          value={p.context}
          onChange={(e) => set('context', e.target.value)}
          placeholder="Ex.: trabalho com consultoria imobiliária, faço calls com investidores dos EUA e quero viajar para Londres em março."
        />
      </label>

      <div>
        <div className="eyebrow mb-2">Minutos por dia</div>
        <div className="flex flex-wrap gap-2">
          {[10, 15, 20, 30, 45, 60].map((m) => (
            <button key={m} onClick={() => set('dailyMinutes', m)} className={p.dailyMinutes === m ? 'chip-on' : 'chip'}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="eyebrow mb-2">Explicações em</div>
          <div className="flex gap-2">
            {(['pt', 'en'] as const).map((l) => (
              <button key={l} onClick={() => set('explainIn', l)} className={p.explainIn === l ? 'chip-on' : 'chip'}>
                {l === 'pt' ? 'Português' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-2">Sotaque</div>
          <div className="flex gap-2">
            {(['en-US', 'en-GB'] as const).map((a) => (
              <button key={a} onClick={() => set('accent', a)} className={p.accent === a ? 'chip-on' : 'chip'}>
                {a === 'en-US' ? '🇺🇸 US' : '🇬🇧 UK'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="btn-primary w-full" disabled={!p.goals.length} onClick={() => onSave(p)}>
        {cta}
      </button>
    </div>
  )
}

export function Onboarding() {
  const blank: Profile = {
    id: 'me',
    name: '',
    level: 'B1',
    goals: [],
    exam: 'none',
    topics: [],
    context: '',
    dailyMinutes: 20,
    explainIn: 'pt',
    accent: 'en-US',
    createdAt: new Date().toISOString(),
  }
  return (
    <div className="mx-auto max-w-xl px-4 pb-12 safe-top">
      <div className="pt-6 pb-6">
        <div className="eyebrow">Fluent</div>
        <h1 className="h1 mt-1">Inglês sob medida para você</h1>
        <p className="mt-2 text-muted">Responda rapidinho: o app monta o plano diário, escolhe conteúdo e ajusta a IA a partir disso.</p>
      </div>
      <ProfileForm initial={blank} cta="Começar" onSave={(p) => db.profile.put({ ...p, createdAt: new Date().toISOString() })} />
    </div>
  )
}
