import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { db, getSettings } from '../db/db'

// Chamadas à Claude API direto do navegador, com a chave do próprio usuário (guardada só no aparelho).
// Uso pessoal: não há servidor intermediário.

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Melhor qualidade (padrão)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Mais barato, ótimo para o dia a dia' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'O mais barato e rápido' },
]

/** Preço em US$ por milhão de tokens (entrada, saída, leitura de cache). Escrita de cache = 1,25× a entrada. */
const PRICES: { prefix: string; input: number; output: number; cacheRead: number }[] = [
  { prefix: 'claude-opus-5-5', input: 4, output: 20, cacheRead: 0.2 },
  { prefix: 'claude-sonnet-5-5', input: 2, output: 10, cacheRead: 0.2 },
  { prefix: 'claude-haiku-5-5', input: 0.1, output: 0.5, cacheRead: 0.01 },
  // Modelos de fallback (recusas indevidas são refeitas no servidor em outro modelo).
  { prefix: 'claude-opus', input: 5, output: 25, cacheRead: 0.5 },
  { prefix: 'claude-sonnet', input: 3, output: 15, cacheRead: 0.3 },
  { prefix: 'claude-fable', input: 10, output: 50, cacheRead: 0.25 },
]

export function estimateCost(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  const p = PRICES.find((x) => model.startsWith(x.prefix)) ?? PRICES[0]
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.input * 1.25) / 1e6
}

export class AiError extends Error {}

export async function hasApiKey() {
  return Boolean((await getSettings()).apiKey)
}

async function client() {
  const s = await getSettings()
  if (!s.apiKey) throw new AiError('Cadastre sua chave da Claude API em Ajustes para usar a IA.')
  return {
    api: new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 }),
    model: s.model,
  }
}

type Effort = 'low' | 'medium' | 'high'

interface CallOpts {
  system: string
  messages: BetaMessageParam[]
  effort?: Effort
  maxTokens?: number
  /** JSON Schema da resposta (structured outputs). Sem ele, devolve texto. */
  schema?: Record<string, unknown>
  /** Nome da tarefa para o registro de custo ("Correção de writing" etc.). */
  task?: string
}

async function call({ system, messages, effort = 'medium', maxTokens = 16000, schema, task = 'IA' }: CallOpts): Promise<string> {
  const { api, model } = await client()
  // Fallback do servidor em recusas indevidas (Opus/Sonnet); o Haiku não tem.
  const fallback = model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
  try {
    const res = await api.beta.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      ...fallback,
    })
    const u = {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
      cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
    }
    void db.usage.add({ date: new Date().toISOString(), task, model: res.model, ...u, cost: estimateCost(res.model, u) })
    if (res.stop_reason === 'refusal') throw new AiError('A IA recusou este pedido. Tente reformular.')
    if (res.stop_reason === 'max_tokens') throw new AiError('A resposta ficou longa demais. Tente de novo.')
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
  } catch (e) {
    if (e instanceof AiError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da API inválida. Confira em Ajustes.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('Sua chave não tem permissão para este modelo.')
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da API atingido. Espere um pouco e tente de novo.')
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`Pedido recusado pela API: ${e.message}`)
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a internet (a IA precisa estar online).')
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da API (${e.status ?? '?'}). Tente de novo.`)
    throw e
  }
}

export async function askJson<T>(opts: CallOpts & { schema: Record<string, unknown> }): Promise<T> {
  const text = await call(opts)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiError('A IA devolveu uma resposta incompleta. Tente de novo.')
  }
}

export async function askText(opts: Omit<CallOpts, 'schema'>): Promise<string> {
  return call(opts)
}

/** Testa a chave com um pedido mínimo. */
export async function testKey(): Promise<string> {
  return askText({ system: 'Reply with one short friendly English sentence.', messages: [{ role: 'user', content: 'Say hi.' }], effort: 'low', maxTokens: 2000, task: 'Teste da chave' })
}
