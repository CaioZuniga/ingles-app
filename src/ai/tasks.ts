import type { Exercise, Level, ListeningItem, Profile, Roleplay, Topic, VocabItem } from '../types'
import { askJson, askText } from './client'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

// Cada tarefa de IA: prompt personalizado com o perfil + pontos fracos, e resposta em JSON validado por schema.

// ---------- Helpers de schema (structured outputs exige objetos fechados e tudo "required") ----------
type S = Record<string, unknown>
const str = (description?: string): S => ({ type: 'string', ...(description ? { description } : {}) })
const num = (description?: string): S => ({ type: 'number', ...(description ? { description } : {}) })
const int = (description?: string): S => ({ type: 'integer', ...(description ? { description } : {}) })
const bool = (): S => ({ type: 'boolean' })
const arr = (items: S, description?: string): S => ({ type: 'array', items, ...(description ? { description } : {}) })
const obj = (properties: Record<string, S>): S => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const enm = (values: string[]): S => ({ type: 'string', enum: values })

// ---------- Contexto do aluno ----------
export interface LearnerContext {
  profile: Profile
  /** Etiquetas de erro mais frequentes, ex.: ["articles", "present-perfect"]. */
  weaknesses: string[]
  /** Nível estimado por habilidade, ex.: "grammar B1, listening A2+". */
  estimated: string
}

const GOAL_TEXT: Record<string, string> = {
  work: 'work/business English',
  travel: 'travel and everyday situations',
  exam: 'exam preparation',
  content: 'understanding series, podcasts, articles and books',
}

function learnerBlock({ profile: p, weaknesses, estimated }: LearnerContext): string {
  const exam = p.goals.includes('exam') && p.exam !== 'none' ? ` (target exam: ${p.exam.toUpperCase()})` : ''
  return [
    `LEARNER PROFILE`,
    `- Native language: Brazilian Portuguese. Name: ${p.name || 'the learner'}.`,
    `- Declared CEFR level: ${p.level}. Estimated per skill: ${estimated || 'not enough data yet'}.`,
    `- Goals: ${p.goals.map((g) => GOAL_TEXT[g]).join('; ')}${exam}.`,
    `- Favourite topics: ${p.topics.join(', ') || 'general'}.`,
    p.context ? `- Personal context (use it to make content relevant): ${p.context}` : '',
    `- Recurring weaknesses: ${weaknesses.length ? weaknesses.join(', ') : 'none identified yet'}.`,
    `- Preferred accent/spelling: ${p.accent === 'en-GB' ? 'British' : 'American'}.`,
    `- Explanations must be written in ${p.explainIn === 'pt' ? 'Brazilian Portuguese' : 'simple English'}; English examples stay in English.`,
  ]
    .filter(Boolean)
    .join('\n')
}

const TUTOR =
  'You are an expert, warm and demanding English teacher for an adult Brazilian learner. ' +
  'You create material that is natural, current and relevant to the learner’s real life, at the right CEFR level (slightly above it to stretch them). ' +
  'Brazilian learners’ typical errors (false friends, articles, prepositions, present perfect, “have” for age/existence, word stress) deserve special attention.'

const ERROR_TAGS =
  'Use short kebab-case error tags such as: articles, prepositions, verb-tense, present-perfect, past-simple, conditionals, word-order, ' +
  'subject-verb-agreement, plurals, false-friends, collocations, word-choice, spelling, punctuation, register, modals, gerund-infinitive, ' +
  'phrasal-verbs, pronouns, comparatives, passive, reported-speech, relative-clauses, pronunciation, fluency, cohesion, vocabulary-range.'

// ---------- Exercícios (gramática) ----------
const exerciseSchema = obj({
  kind: enm(['choice', 'gap', 'order', 'fix']),
  prompt: str('choice/gap: sentence with exactly one "___" or a question; fix: sentence with ONE error; order: empty string'),
  options: arr(str(), 'choice: 3–4 options; other kinds: empty'),
  answer_index: int('choice: 0-based index of the correct option; other kinds: 0'),
  answers: arr(str(), 'gap/fix: all acceptable answers (gap: just the missing words; fix: whole corrected sentence); order: [correct sentence]'),
  words: arr(str(), 'order: the words of the correct sentence, shuffled; other kinds: empty'),
  hint: str('optional hint such as the base verb "(go)", or empty'),
  explanation: str('one-sentence explanation in the learner’s explanation language'),
})

interface RawExercise {
  kind: Exercise['kind']
  prompt: string
  options: string[]
  answer_index: number
  answers: string[]
  words: string[]
  hint: string
  explanation: string
}

export function toExercise(r: RawExercise): Exercise | null {
  switch (r.kind) {
    case 'choice':
      return r.options.length >= 2 && r.answer_index < r.options.length
        ? { kind: 'choice', prompt: r.prompt, options: r.options, answer: r.answer_index, explanation: r.explanation }
        : null
    case 'gap':
      return r.answers.length && /_{2,}/.test(r.prompt)
        ? { kind: 'gap', prompt: r.prompt, answers: r.answers, hint: r.hint || undefined, explanation: r.explanation }
        : null
    case 'fix':
      return r.answers.length ? { kind: 'fix', prompt: r.prompt, answers: r.answers, explanation: r.explanation } : null
    case 'order':
      return r.answers[0] && r.words.length > 2 ? { kind: 'order', words: r.words, answer: r.answers[0], explanation: r.explanation } : null
  }
}

export interface AiGrammarLesson {
  title: string
  tag: string
  explanation: string
  examples: string[]
  exercises: Exercise[]
}

export async function generateGrammarLesson(ctx: LearnerContext, focus: string): Promise<AiGrammarLesson> {
  const raw = await askJson<Omit<AiGrammarLesson, 'exercises'> & { exercises: RawExercise[] }>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}`,
    messages: [
      {
        role: 'user',
        content:
          `Create a short grammar lesson. Focus: ${focus || 'pick the most useful point for this learner given their weaknesses and level'}.\n` +
          `- explanation: 100–200 words, practical, show the typical mistake of Brazilians and the fix. Use **bold** and lines starting with "- ".\n` +
          `- examples: 4 sentences "English — tradução" set in the learner’s real context.\n` +
          `- exercises: 10, mixing kinds (4 choice, 3 gap, 1–2 order, 1–2 fix), progressively harder, unambiguous, contexts drawn from the learner’s goals.\n` +
          `- tag: a kebab-case error tag for this grammar point.`,
      },
    ],
    schema: obj({ title: str(), tag: str(), explanation: str(), examples: arr(str()), exercises: arr(exerciseSchema) }),
  })
  return { ...raw, exercises: raw.exercises.map(toExercise).filter((e): e is Exercise => e !== null) }
}

// ---------- Listening ----------
export async function generateListening(ctx: LearnerContext, topic: Topic | string, level: Level, kind: 'monologue' | 'dialogue'): Promise<ListeningItem> {
  const r = await askJson<Omit<ListeningItem, 'id' | 'level' | 'topics' | 'kind'>>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}`,
    messages: [
      {
        role: 'user',
        content:
          `Write a listening text at CEFR ${level} about "${topic}", as a ${kind === 'dialogue' ? 'dialogue between two people, every line starting with "A: " or "B: " and lines separated by \\n' : 'monologue (voicemail, podcast excerpt, briefing, announcement or lecture)'}.\n` +
          `It will be read aloud by text-to-speech: natural spoken English with contractions, ${level <= 'A2' ? '80–120' : level <= 'B2' ? '140–200' : '200–260'} words, no stage directions.\n` +
          `Then 4 multiple-choice questions (detail, inference, attitude/purpose; 4 options each; vary the correct index) and 3 dictation sentences copied verbatim from the text (6–14 words, without speaker prefix).`,
      },
    ],
    schema: obj({
      title: str(),
      transcript: str(),
      questions: arr(obj({ question: str(), options: arr(str()), answer: int() })),
      dictation: arr(str()),
    }),
  })
  return { ...r, id: `ai-${Date.now()}`, level, topics: [], kind }
}

// ---------- Vocabulário ----------
export async function generateVocab(ctx: LearnerContext, theme: string, known: string[]): Promise<VocabItem[]> {
  const r = await askJson<{ items: Omit<VocabItem, 'id' | 'topics'>[] }>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}`,
    messages: [
      {
        role: 'user',
        content:
          `Suggest 12 high-value words, collocations, phrasal verbs or idioms for this learner about: "${theme}".\n` +
          `Prefer what a professional would really use. Avoid these terms the learner already has: ${known.slice(0, 300).join(', ') || 'none'}.\n` +
          `pt: short Brazilian Portuguese translation; definition: simple English ≤15 words; example: natural sentence ≤18 words in the learner’s context; level: CEFR.`,
      },
    ],
    schema: obj({
      items: arr(obj({ term: str(), pos: str(), pt: str(), definition: str(), example: str(), level: enm(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) })),
    }),
  })
  const stamp = Date.now()
  return r.items.map((it, i) => ({ ...it, id: `ai-${stamp}-${i}`, topics: [] }))
}

// ---------- Writing ----------
export interface Issue {
  wrong: string
  right: string
  tag: string
  note: string
}
export interface NewWord {
  term: string
  pt: string
  definition: string
  example: string
}
export interface WritingFeedback {
  score: number
  cefr: string
  summary: string
  corrected: string
  improved: string
  issues: Issue[]
  strengths: string[]
  newWords: NewWord[]
  examBand: string
}

const issueSchema = obj({ wrong: str('exact excerpt with the problem'), right: str('corrected excerpt'), tag: str('kebab-case error tag'), note: str('short explanation') })
const newWordSchema = obj({ term: str(), pt: str(), definition: str(), example: str() })

export async function correctWriting(ctx: LearnerContext, task: string, text: string, exam?: string): Promise<WritingFeedback> {
  return askJson<WritingFeedback>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}\n\n${ERROR_TAGS}`,
    messages: [
      {
        role: 'user',
        content:
          `Correct this piece of writing.\n\nTASK:\n${task}\n\nLEARNER TEXT:\n${text}\n\n` +
          `Return:\n- score 0–100 (task achievement, coherence, grammar, vocabulary, register);\n- cefr: estimated level of this text;\n` +
          `- summary: 2–4 sentences of feedback;\n- corrected: the learner’s text with only the errors fixed (keep their ideas and style);\n` +
          `- improved: a model version a level above, same content;\n- issues: up to 12 most important problems, one per error, ordered by importance;\n` +
          `- strengths: 1–3 short items;\n- newWords: 3–6 useful expressions from the improved version worth memorising;\n` +
          `- examBand: ${exam ? `estimated ${exam.toUpperCase()} band/score with one-line justification` : 'empty string'}.`,
      },
    ],
    schema: obj({
      score: num(),
      cefr: str(),
      summary: str(),
      corrected: str(),
      improved: str(),
      issues: arr(issueSchema),
      strengths: arr(str()),
      newWords: arr(newWordSchema),
      examBand: str(),
    }),
  })
}

// ---------- Speaking (resposta livre) ----------
export interface SpeakingFeedback {
  score: number
  cefr: string
  summary: string
  fluency: string
  issues: Issue[]
  better: string
  newWords: NewWord[]
  pronunciationWatch: string[]
}

export async function evaluateSpeaking(ctx: LearnerContext, prompt: string, transcript: string, seconds: number, exam?: string): Promise<SpeakingFeedback> {
  return askJson<SpeakingFeedback>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}\n\n${ERROR_TAGS}`,
    messages: [
      {
        role: 'user',
        content:
          `The learner answered this speaking prompt aloud in ${Math.round(seconds)} seconds. Below is an automatic speech-to-text transcript ` +
          `(it may lack punctuation and contain recognition mistakes — do not penalise obvious transcription artefacts).\n\n` +
          `PROMPT: ${prompt}\n\nTRANSCRIPT: ${transcript}\n\n` +
          `Return score 0–100, cefr estimate, summary (2–3 sentences), fluency (comment on length, words per minute ≈ ${seconds ? Math.round((transcript.split(/\s+/).length / seconds) * 60) : 0}, hesitation, connectors), ` +
          `issues (up to 8 grammar/vocabulary problems), better (a natural model answer of similar length a level above), ` +
          `newWords (3–5 expressions), pronunciationWatch (2–4 words from their answer that Brazilians usually mispronounce, each "word — dica em português")` +
          (exam ? `. Also mention the estimated ${exam.toUpperCase()} band inside summary.` : '.'),
      },
    ],
    schema: obj({
      score: num(),
      cefr: str(),
      summary: str(),
      fluency: str(),
      issues: arr(issueSchema),
      better: str(),
      newWords: arr(newWordSchema),
      pronunciationWatch: arr(str()),
    }),
  })
}

// ---------- Roleplay (conversa) ----------
export interface RoleplayTurn {
  reply: string
  correction: { has: boolean; original: string; better: string; note: string; tag: string }
  finished: boolean
}

export interface ChatLine {
  who: 'ai' | 'me'
  text: string
}

export async function roleplayTurn(ctx: LearnerContext, rp: Pick<Roleplay, 'aiRole' | 'goal' | 'title'>, lines: ChatLine[]): Promise<RoleplayTurn> {
  // Histórico como turnos alternados; a primeira fala da IA vai como contexto no sistema.
  const [first, ...rest] = lines
  const messages: BetaMessageParam[] = rest.map((l) => ({ role: l.who === 'ai' ? 'assistant' : 'user', content: l.text }))
  // A resposta da IA é JSON; nas falas anteriores dela mandamos só o texto falado.
  return askJson<RoleplayTurn>({
    system:
      `${TUTOR}\n\n${learnerBlock(ctx)}\n\nROLEPLAY "${rp.title}". You play: ${rp.aiRole}\n` +
      `The learner’s goal (in Portuguese): ${rp.goal}\nYour first line was: "${first?.text ?? ''}"\n\n` +
      `Stay in character. Reply in 1–3 short spoken sentences adapted to the learner’s level, and keep the conversation moving with a question or a new turn of events. ` +
      `In "correction", look ONLY at the learner’s last message: if it has a real grammar/vocabulary/naturalness problem set has=true with the original excerpt, a better way to say it, a short note in the learner’s explanation language and an error tag; otherwise has=false and empty strings. ` +
      `Set finished=true only when the scenario has reached a natural end (after at least 6 learner turns) — then make "reply" a closing line.`,
    messages,
    effort: 'low',
    schema: obj({
      reply: str(),
      correction: obj({ has: bool(), original: str(), better: str(), note: str(), tag: str() }),
      finished: bool(),
    }),
  })
}

export interface RoleplayReport {
  score: number
  summary: string
  wentWell: string[]
  improve: string[]
  newWords: NewWord[]
}

export async function roleplayReport(ctx: LearnerContext, title: string, lines: ChatLine[]): Promise<RoleplayReport> {
  return askJson<RoleplayReport>({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}`,
    messages: [
      {
        role: 'user',
        content:
          `Evaluate the learner in this roleplay ("${title}"). Transcript (learner = ME):\n\n` +
          lines.map((l) => `${l.who === 'ai' ? 'PARTNER' : 'ME'}: ${l.text}`).join('\n') +
          `\n\nReturn score 0–100, summary (2–3 sentences), wentWell (2–3), improve (2–4 concrete points), newWords (3–5 expressions they could have used).`,
      },
    ],
    schema: obj({ score: num(), summary: str(), wentWell: arr(str()), improve: arr(str()), newWords: arr(newWordSchema) }),
  })
}

/** Cria um roleplay sob medida a partir de uma situação descrita pelo aluno. */
export async function customRoleplay(ctx: LearnerContext, situation: string): Promise<Omit<Roleplay, 'id' | 'level' | 'topics'>> {
  return askJson({
    system: `${TUTOR}\n\n${learnerBlock(ctx)}`,
    messages: [
      {
        role: 'user',
        content:
          `The learner wants to practise this real situation: "${situation}". Design a roleplay: title (English, short), setup (Portuguese, 1–2 sentences), ` +
          `aiRole (English: the character you will play, personality, what they want, how to behave), goal (Portuguese: what the learner must achieve), opener (your first line, English).`,
      },
    ],
    effort: 'low',
    schema: obj({ title: str(), setup: str(), aiRole: str(), goal: str(), opener: str() }),
  })
}

// ---------- Tutor livre ----------
export async function askTutor(ctx: LearnerContext, history: ChatLine[]): Promise<string> {
  return askText({
    system:
      `${TUTOR}\n\n${learnerBlock(ctx)}\n\nAnswer the learner’s questions about English (grammar, vocabulary, translation, how to say something, pronunciation, culture). ` +
      `Be concise and practical: short explanation + 2–4 examples. Use plain text with **bold** and "- " lists only.`,
    messages: history.map((l) => ({ role: l.who === 'ai' ? 'assistant' : 'user', content: l.text })),
    effort: 'low',
  })
}
