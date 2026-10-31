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

/**
 * Ordem das vozes: sotaque certo, depois vozes do próprio aparelho (respondem na hora) e, entre elas, as de melhor qualidade.
 * Vozes online (ex.: "Google US English" e "… Online (Natural)" no Chrome/Edge do computador) soam bem, mas cada
 * reprodução passa pela internet e pode atrasar; ficam disponíveis para escolher em Ajustes.
 */
function rank(v: SpeechSynthesisVoice, accent: string): number {
  let s = 0
  if (v.lang.replace('_', '-') === accent) s += 10
  if (v.localService) s += 8
  if (/premium|enhanced|natural|neural/i.test(v.name)) s += 4
  if (/google/i.test(v.name)) s += 2
  if (/samantha|daniel|karen|moira|serena|ava|zoe|evan|nathan|aria|jenny|guy/i.test(v.name)) s += 3
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

// Cada stop() abre uma nova "geração": leituras em andamento (speakScript) veem que ficaram velhas e param,
// em vez de seguir para a próxima linha depois de a frase atual ser cancelada.
let generation = 0

export function stop() {
  generation++
  if (ttsSupported()) speechSynthesis.cancel()
}

// Referência viva da fala atual: sem ela o Chrome às vezes descarta a fala da memória e ela não toca nem termina.
let current: SpeechSynthesisUtterance | null = null

/**
 * Fala um texto. Robusta às falhas conhecidas da Web Speech API:
 * - tocar de novo interrompe o anterior (senão o navegador enfileira e o novo atrasa);
 * - o Chrome às vezes descarta uma fala pedida logo após cancelar: espera um instante;
 * - voz online que falha (rede) ou fala que não começa em 2,5 s: tenta mais uma vez com uma voz do aparelho.
 */
export function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  const busy = speechSynthesis.speaking || speechSynthesis.pending
  if (busy) speechSynthesis.cancel()
  if (speechSynthesis.paused) speechSynthesis.resume()
  const mine = generation
  const voices = pickVoices(opts.accent ?? 'en-US', opts.voiceURI)
  const first = opts.alt ? (voices.find((x, i) => i > 0 && x.name !== voices[0]?.name) ?? voices[0]) : voices[0]
  const backup = voices.find((v) => v.localService && v !== first) ?? first

  return new Promise((resolve) => {
    let settled = false
    let retried = false
    let active: SpeechSynthesisUtterance | null = null // tentativa em curso desta chamada
    let watch: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(watch)
      if (current === active) current = null
      active = null
      resolve()
    }
    const attempt = (voice: SpeechSynthesisVoice | undefined, delay: number) => {
      const u = new SpeechSynthesisUtterance(text)
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? opts.accent ?? 'en-US'
      u.rate = opts.rate ?? 0.95
      if (opts.alt && voices.length < 2) u.pitch = 0.8 // sem segunda voz: muda o tom para distinguir
      let started = false
      u.onstart = () => (started = true)
      u.onend = () => active === u && finish()
      u.onerror = (e) => {
        if (active !== u) return
        if (e.error === 'interrupted' || e.error === 'canceled' || generation !== mine) finish()
        else retry()
      }
      const go = () => {
        if (settled || generation !== mine) return finish()
        active = current = u
        speechSynthesis.speak(u)
        watch = setTimeout(() => {
          if (active === u && !started && !speechSynthesis.speaking) retry()
        }, 2500)
      }
      if (delay) setTimeout(go, delay)
      else go()
    }
    const retry = () => {
      clearTimeout(watch)
      if (retried || generation !== mine) return finish()
      retried = true
      active = null // a tentativa abandonada não encerra mais nada
      speechSynthesis.cancel()
      attempt(backup, 120)
    }
    attempt(first, busy ? 60 : 0)
  })
}

/** Lê um texto inteiro; em diálogos ("A: ..."/"B: ...") alterna as vozes. Devolve uma função para parar. */
export async function speakScript(transcript: string, opts: SpeakOpts & { onLine?: (i: number) => void; from?: number } = {}) {
  stop()
  const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean)
  const mine = generation
  const cancel = () => {
    if (generation === mine) stop()
  }
  const run = async () => {
    for (let i = opts.from ?? 0; i < lines.length && generation === mine; i++) {
      const m = /^([AB]):\s*(.*)$/.exec(lines[i])
      opts.onLine?.(i)
      await speak(m ? m[2] : lines[i], { ...opts, alt: m?.[1] === 'B' })
    }
    opts.onLine?.(-1)
  }
  return { cancel, done: run() }
}
