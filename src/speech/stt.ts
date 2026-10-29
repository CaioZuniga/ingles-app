// Reconhecimento de fala do navegador (Chrome no Android; Safari no iPhone).
// Onde não houver suporte, as telas oferecem digitar ou usar o microfone do teclado.

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type Ctor = new () => Recognition

function ctor(): Ctor | undefined {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const sttSupported = () => typeof window !== 'undefined' && Boolean(ctor())

export interface Listener {
  stop(): void
}

export interface ListenOpts {
  lang: string
  /** Continua ouvindo até chamar stop() (respostas longas). */
  continuous?: boolean
  onText: (text: string, final: boolean) => void
  onEnd: (error?: string) => void
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permissão do microfone negada. Libere nas configurações do navegador.',
  'service-not-allowed': 'O reconhecimento de voz não está disponível neste modo. Tente pelo navegador ou use o microfone do teclado.',
  'no-speech': 'Não ouvi nada. Tente de novo, mais perto do microfone.',
  network: 'O reconhecimento de voz precisa de internet neste aparelho.',
  'audio-capture': 'Nenhum microfone encontrado.',
}

export function listen(opts: ListenOpts): Listener {
  const C = ctor()
  if (!C) {
    opts.onEnd('Reconhecimento de voz indisponível neste navegador.')
    return { stop() {} }
  }
  const r = new C()
  r.lang = opts.lang
  r.continuous = Boolean(opts.continuous)
  r.interimResults = true
  // Texto das sessões anteriores (o Chrome reinicia o reconhecimento após silêncio) e da sessão atual.
  // A sessão atual é remontada a partir de todos os resultados: juntar só os trechos novos duplicava palavras.
  const join = (a: string, b: string) => [a, b].filter(Boolean).join(' ')
  let before = ''
  let session = ''
  let stopped = false
  let error: string | undefined
  r.onresult = (e) => {
    const parts: string[] = []
    let allFinal = true
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i]
      parts.push(res[0].transcript.trim())
      if (!res.isFinal) allFinal = false
    }
    session = parts.filter(Boolean).join(' ')
    opts.onText(join(before, session), allFinal)
  }
  r.onerror = (e) => {
    if (e.error !== 'aborted') error = ERRORS[e.error] ?? `Erro no reconhecimento de voz (${e.error}).`
  }
  r.onend = () => {
    before = join(before, session)
    session = ''
    // Em modo contínuo o Chrome às vezes encerra sozinho após silêncio: reinicia até o usuário parar.
    if (opts.continuous && !stopped && !error) {
      try {
        r.start()
        return
      } catch {
        /* cai no encerramento normal */
      }
    }
    opts.onEnd(error)
  }
  try {
    r.start()
  } catch {
    opts.onEnd('Não foi possível iniciar o microfone.')
  }
  return {
    stop() {
      stopped = true
      r.stop()
    },
  }
}
