// Tipos do app. O conteúdo base (src/data/*.json) segue exatamente estes formatos.

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export type Skill = 'vocabulary' | 'grammar' | 'listening' | 'writing' | 'speaking'
export const SKILLS: Skill[] = ['vocabulary', 'grammar', 'listening', 'writing', 'speaking']

/** Demandas do aluno: cada uma puxa temas, vocabulário e formatos de exercício. */
export type Goal = 'work' | 'travel' | 'exam' | 'content'

/** Temas usados para etiquetar conteúdo e personalizar a IA. */
export type Topic =
  | 'business' // reuniões, e-mails, negociação, apresentações
  | 'real-estate' // mercado imobiliário, locação, avaliação, incorporação
  | 'finance' // investimentos, contabilidade, indicadores
  | 'travel' // aeroporto, hotel, restaurante, direções
  | 'daily' // rotina, compras, saúde, small talk
  | 'tech' // tecnologia, software, IA
  | 'culture' // séries, filmes, música, livros
  | 'academic' // vocabulário acadêmico (TOEFL/IELTS)

export type ExamType = 'none' | 'toefl' | 'ielts' | 'cambridge'

export interface Profile {
  id: 'me'
  name: string
  level: Level
  goals: Goal[]
  exam: ExamType
  topics: Topic[]
  /** Contexto livre: "trabalho com consultoria imobiliária, faço calls com investidores americanos". */
  context: string
  dailyMinutes: number
  /** Idioma das explicações. */
  explainIn: 'pt' | 'en'
  accent: 'en-US' | 'en-GB'
  createdAt: string
  /** Resultado do teste de nivelamento: ponto de partida do nível estimado de cada habilidade. */
  placement?: { date: string; ratings: SkillRatings; items?: PlacementItem[] }
}

export interface Settings {
  id: 'settings'
  apiKey: string
  model: string
  voiceURI: string
  speechRate: number
}

/** Uma pergunta respondida no teste de nivelamento (para rever acertos e erros depois). */
export interface PlacementItem {
  skill: 'vocabulary' | 'grammar' | 'listening'
  level: Level
  /** O que foi perguntado: a palavra, a frase com lacuna ou a frase ouvida. */
  question: string
  /** Resposta dada ('' = "Não sei"/"Não entendi"). */
  given: string
  correct: string
  score: number // 0..1 (listening pode ser parcial)
}

// ---------- Conteúdo base ----------

/** Palavra/expressão do banco de vocabulário. */
export interface VocabItem {
  id: string // ex.: "re-lease-agreement"
  term: string // "lease agreement"
  pos: string // "noun" | "verb" | "adj" | "adv" | "phrase" | "phrasal verb" | "idiom"
  pt: string // tradução curta
  definition: string // definição simples em inglês
  example: string // frase de exemplo natural
  level: Level
  topics: Topic[]
}

/** Exercício objetivo (corrigido sem IA). */
export type Exercise =
  | {
      kind: 'choice' // múltipla escolha
      prompt: string // frase com ___ ou pergunta
      options: string[] // 3 ou 4 opções
      answer: number // índice da correta
      explanation: string // por que (no idioma de explicação padrão: PT)
    }
  | {
      kind: 'gap' // digitar a palavra que falta
      prompt: string // frase com ___ (uma lacuna)
      answers: string[] // respostas aceitas (minúsculas comparadas sem pontuação)
      hint?: string // ex.: "(go)" — verbo base
      explanation: string
    }
  | {
      kind: 'order' // ordenar palavras
      words: string[] // palavras embaralhadas
      answer: string // frase correta
      explanation: string
    }
  | {
      kind: 'fix' // encontrar e corrigir o erro
      prompt: string // frase com UM erro
      answers: string[] // versões corrigidas aceitas
      explanation: string
    }

export interface GrammarTopic {
  id: string // ex.: "present-perfect-vs-past"
  title: string // "Present perfect vs. past simple"
  level: Level
  /** Explicação curta em português (markdown simples: **negrito**, listas com "- "). */
  explanation: string
  /** Exemplos em inglês com tradução: "I have lived here for 5 years. — Moro aqui há 5 anos." */
  examples: string[]
  exercises: Exercise[]
}

export interface ListeningQuestion {
  question: string
  options: string[]
  answer: number
}

export interface ListeningItem {
  id: string
  title: string
  level: Level
  topics: Topic[]
  /** Monólogo ou diálogo. Diálogo: linhas "A: ..." / "B: ..." (vozes alternadas no TTS). */
  kind: 'monologue' | 'dialogue'
  transcript: string
  questions: ListeningQuestion[]
  /** Frases curtas do texto para ditado. */
  dictation: string[]
}

export interface SpeakingPhrase {
  id: string
  text: string // frase para ouvir e repetir (shadowing)
  pt: string
  level: Level
  topics: Topic[]
  /** Dica de pronúncia em PT, opcional ("th" de "think": língua entre os dentes). */
  tip?: string
}

export interface SpeakingPrompt {
  id: string
  prompt: string // "Describe a property you would recommend to a foreign investor."
  level: Level
  topics: Topic[]
  /** Exame cujo formato o prompt imita, se houver. */
  exam?: ExamType
  seconds: number // tempo sugerido de fala
}

export interface WritingPrompt {
  id: string
  title: string
  prompt: string // enunciado em inglês
  level: Level
  topics: Topic[]
  exam?: ExamType
  minWords: number
  /** Formato: e-mail, ensaio, mensagem, resumo… */
  genre: 'email' | 'essay' | 'message' | 'summary' | 'report' | 'story' | 'review'
}

export interface Roleplay {
  id: string
  title: string
  /** Situação apresentada ao aluno (PT). */
  setup: string
  /** Papel da IA (EN), usado no prompt do sistema. */
  aiRole: string
  /** Objetivo do aluno (PT). */
  goal: string
  level: Level
  topics: Topic[]
  /** Primeira fala da IA. */
  opener: string
}

// ---------- Progresso ----------

/** Cartão de repetição espaçada (SM-2) de um item de vocabulário. */
export interface Card {
  id: string // = VocabItem.id, ou "ai-..." para palavras salvas de aulas
  term: string
  pt: string
  example: string
  definition: string
  ease: number
  interval: number // dias
  reps: number
  lapses: number
  due: string // ISO date (yyyy-mm-dd)
  addedAt: string
  source: 'bank' | 'ai' | 'user'
}

/** Resultado de uma atividade, base das estatísticas e da personalização. */
export interface Attempt {
  id?: number
  date: string // ISO datetime
  skill: Skill
  activity: string // "grammar:present-perfect-vs-past", "writing:wp-12", "card"…
  score: number // 0..1
  /** Nível do conteúdo praticado (base do ajuste de nível estimado). */
  level: Level
  seconds: number
  /** Etiquetas de erro (ex.: "articles", "prepositions", "past-simple") para achar pontos fracos. */
  errorTags: string[]
  detail?: string
}

/** Erro registrado para revisão (vindo de exercícios ou correções da IA). */
export interface Mistake {
  id?: number
  date: string
  skill: Skill
  tag: string
  wrong: string
  right: string
  note: string
  reviewed: boolean
  /** Caixa de Leitner (0–4): sobe a cada acerto na revisão; ao passar da 4 o erro é dado como aprendido. */
  box?: number
  due?: string // yyyy-mm-dd
}

/** Registro de uso da Claude API (tokens e custo estimado em US$). */
export interface AiUsage {
  id?: number
  date: string
  task: string
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

/** Conteúdo gerado pela IA guardado para reuso offline. */
export interface SavedLesson {
  id?: number
  date: string
  skill: Skill
  title: string
  payload: unknown
}

/** Habilidade estimada (0–600: A1=0..100, A2=100..200 … C2=500..600). */
export type SkillRatings = Record<Skill, number>
