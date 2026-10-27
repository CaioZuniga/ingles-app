import grammarJson from './grammar.json'
import vocabularyJson from './vocabulary.json'
import listeningJson from './listening.json'
import speakingJson from './speaking.json'
import writingJson from './writing.json'
import roleplaysJson from './roleplays.json'
import placementJson from './placement.json'
import { LEVELS, type GrammarTopic, type Level, type ListeningItem, type PlacementGrammar, type PlacementVocab, type Profile, type Roleplay, type SpeakingPhrase, type SpeakingPrompt, type Topic, type VocabItem, type WritingPrompt } from '../types'

// Banco de conteúdo offline (vem junto com o app).
export const GRAMMAR = grammarJson as GrammarTopic[]
export const VOCAB = vocabularyJson as VocabItem[]
export const LISTENING = listeningJson as ListeningItem[]
export const PHRASES = (speakingJson as { phrases: SpeakingPhrase[] }).phrases
export const SPEAKING_PROMPTS = (speakingJson as { prompts: SpeakingPrompt[] }).prompts
export const WRITING = writingJson as WritingPrompt[]
export const ROLEPLAYS = roleplaysJson as Roleplay[]
/** Itens do teste de nivelamento: temas gerais (sem perfil profissional), 4 opções. */
export const PLACEMENT = placementJson as { vocabulary: PlacementVocab[]; grammar: PlacementGrammar[] }

export const TOPIC_LABEL: Record<Topic, string> = {
  business: 'Negócios',
  'real-estate': 'Imobiliário',
  finance: 'Finanças',
  travel: 'Viagem',
  daily: 'Dia a dia',
  tech: 'Tecnologia',
  culture: 'Séries e cultura',
  academic: 'Acadêmico',
  quality: 'Garantia da qualidade',
}

const li = (l: Level) => LEVELS.indexOf(l)

/**
 * Ordena conteúdo pela relevância para o perfil: nível perto do do aluno (de um abaixo a um acima)
 * e temas de interesse primeiro. Itens fora da faixa vão para o fim, não somem.
 */
export function rankFor<T extends { level: Level; topics: Topic[]; exam?: string }>(items: T[], p: Profile, level: Level = p.level): T[] {
  const target = li(level)
  const score = (it: T) => {
    const d = li(it.level) - target
    let s = d === 0 ? 3 : d === 1 ? 2.5 : d === -1 ? 1.5 : -Math.abs(d)
    if (it.topics.some((t) => p.topics.includes(t))) s += 2
    if (it.exam && it.exam !== 'none') s += p.goals.includes('exam') && (p.exam === it.exam || p.exam === 'none') ? 1.5 : -1.5
    return s
  }
  return [...items].sort((a, b) => score(b) - score(a))
}

export const SKILL_LABEL = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
} as const

export const SKILL_COLOR = {
  vocabulary: 'var(--color-voc)',
  grammar: 'var(--color-gra)',
  listening: 'var(--color-lis)',
  writing: 'var(--color-wri)',
  speaking: 'var(--color-spk)',
} as const
