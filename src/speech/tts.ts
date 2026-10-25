// Leitura em voz alta com as vozes do próprio aparelho (Web Speech API): grátis e offline na maioria dos celulares.

let voicesCache: SpeechSynthesisVoice[] = []

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve((voicesCache = now))
  return new Promise((resolve) => {
    const done = () => resolve((voicesCache = speechSynthesis.getVoices()))
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return voicesCache.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/** Vozes de melhor qualidade primeiro (as "Enhanced/Premium/Natural/Google" soam bem melhores). */
function rank(v: SpeechSynthesisVoice, accent: string): number {
  let s = 0
  if (v.lang.replace('_', '-') === accent) s += 10
  if (/premium|enhanced|natural|neural/i.test(v.name)) s += 6
  if (/google/i.test(v.name)) s += 4
  if (/samantha|daniel|karen|moira|serena|ava|zoe|evan|nathan/i.test(v.name)) s += 3
  if (v.localService) s += 1
  return s
}

export function pickVoices(accent: string, preferredURI?: string): SpeechSynthesisVoice[] {
  const list = [...englishVoices()].sort((a, b) => rank(b, accent) - rank(a, accent))
  const pref = list.find((v) => v.voiceURI === preferredURI)
  return pref ? [pref, ...list.filter((v) => v !== pref)] : list
}

export interface SpeakOpts {
  rate?: number
  accent?: string
  voiceURI?: string
  /** Voz alternativa (diálogos: falante B). */
  alt?: boolean
}

export function stop() {
  if (ttsSupported()) speechSynthesis.cancel()
}

export function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const voices = pickVoices(opts.accent ?? 'en-US', opts.voiceURI)
    const v = opts.alt ? (voices.find((x, i) => i > 0 && x.name !== voices[0]?.name) ?? voices[0]) : voices[0]
    if (v) u.voice = v
    u.lang = v?.lang ?? opts.accent ?? 'en-US'
    u.rate = opts.rate ?? 0.95
    if (opts.alt && voices.length < 2) u.pitch = 0.8 // sem segunda voz: muda o tom para distinguir
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}

/** Lê um texto inteiro; em diálogos ("A: ..."/"B: ...") alterna as vozes. Devolve uma função para parar. */
export async function speakScript(transcript: string, opts: SpeakOpts & { onLine?: (i: number) => void } = {}) {
  stop()
  const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean)
  let cancelled = false
  const cancel = () => {
    cancelled = true
    stop()
  }
  const run = async () => {
    for (let i = 0; i < lines.length && !cancelled; i++) {
      const m = /^([AB]):\s*(.*)$/.exec(lines[i])
      opts.onLine?.(i)
      await speak(m ? m[2] : lines[i], { ...opts, alt: m?.[1] === 'B' })
    }
    opts.onLine?.(-1)
  }
  return { cancel, done: run() }
}
