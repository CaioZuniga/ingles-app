import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { getSettings } from '../db/db'

// Chamadas à Claude API direto do navegador, com a chave do próprio usuário (guardada só no aparelho).
// Uso pessoal: não há servidor intermediário.

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Melhor qualidade (padrão)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Mais barato, ótimo para o dia a dia' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'O mais barato e rápido' },
]

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
}

async function call({ system, messages, effort = 'medium', maxTokens = 16000, schema }: CallOpts): Promise<string> {
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
  return askText({ system: 'Reply with one short friendly English sentence.', messages: [{ role: 'user', content: 'Say hi.' }], effort: 'low', maxTokens: 2000 })
}
