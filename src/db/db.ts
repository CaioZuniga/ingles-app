import Dexie, { type EntityTable } from 'dexie'
import type { AiUsage, Attempt, Card, Mistake, Profile, SavedLesson, Settings } from '../types'
import { today } from '../engine/srs'

// Banco local (IndexedDB). Tudo fica só neste aparelho; o backup exporta para JSON.
export const db = new Dexie('ingles-app') as Dexie & {
  profile: EntityTable<Profile, 'id'>
  settings: EntityTable<Settings, 'id'>
  cards: EntityTable<Card, 'id'>
  attempts: EntityTable<Attempt, 'id'>
  mistakes: EntityTable<Mistake, 'id'>
  lessons: EntityTable<SavedLesson, 'id'>
  usage: EntityTable<AiUsage, 'id'>
}

db.version(1).stores({
  profile: 'id',
  settings: 'id',
  cards: 'id, due, source',
  attempts: '++id, date, skill, activity',
  mistakes: '++id, date, skill, tag, reviewed',
  lessons: '++id, date, skill',
})

// v2: erros entram em repetição espaçada (due) e o uso da IA passa a ser registrado.
db.version(2)
  .stores({ mistakes: '++id, date, skill, tag, reviewed, due', usage: '++id, date' })
  .upgrade((tx) =>
    tx
      .table('mistakes')
      .toCollection()
      .modify((m: Mistake) => {
        m.box = m.reviewed ? 5 : 0
        m.due = today()
      }),
  )

export const DEFAULT_MODEL = 'claude-opus-5-5'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  apiKey: '',
  model: DEFAULT_MODEL,
  voiceURI: '',
  speechRate: 0.95,
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

export async function logAttempt(a: Omit<Attempt, 'id' | 'date'>) {
  await db.attempts.add({ ...a, date: new Date().toISOString() })
}

export async function logMistakes(items: Omit<Mistake, 'id' | 'date' | 'reviewed'>[]) {
  if (!items.length) return
  const date = new Date().toISOString()
  await db.mistakes.bulkAdd(items.map((m) => ({ ...m, date, reviewed: false, box: 0, due: today() })))
}

export interface Backup {
  app: 'ingles-app'
  version: 1
  exportedAt: string
  profile: Profile[]
  cards: Card[]
  attempts: Attempt[]
  mistakes: Mistake[]
  lessons: SavedLesson[]
}

/** A chave da API não entra no backup. */
export async function exportBackup(): Promise<Backup> {
  const [profile, cards, attempts, mistakes, lessons] = await Promise.all([
    db.profile.toArray(),
    db.cards.toArray(),
    db.attempts.toArray(),
    db.mistakes.toArray(),
    db.lessons.toArray(),
  ])
  return { app: 'ingles-app', version: 1, exportedAt: new Date().toISOString(), profile, cards, attempts, mistakes, lessons }
}

export async function importBackup(data: Backup) {
  if (data?.app !== 'ingles-app') throw new Error('Arquivo não é um backup deste app.')
  await db.transaction('rw', [db.profile, db.cards, db.attempts, db.mistakes, db.lessons], async () => {
    await Promise.all([db.profile.clear(), db.cards.clear(), db.attempts.clear(), db.mistakes.clear(), db.lessons.clear()])
    await db.profile.bulkPut(data.profile)
    await db.cards.bulkPut(data.cards)
    await db.attempts.bulkPut(data.attempts)
    await db.mistakes.bulkPut(data.mistakes)
    await db.lessons.bulkPut(data.lessons)
  })
}
