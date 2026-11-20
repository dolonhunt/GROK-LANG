import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Message } from './types'

interface ChatownDB extends DBSchema {
  messages: {
    key: string
    value: Message
    indexes: { 'by-ts': number }
  }
  settings: {
    key: string
    value: { key: string; value: unknown }
  }
}

const DB_NAME = 'chatown-bridge'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<ChatownDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ChatownDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' })
          store.createIndex('by-ts', 'ts')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export async function loadMessages(): Promise<Message[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('messages', 'by-ts')
  return all
}

export async function saveMessage(msg: Message): Promise<void> {
  const db = await getDb()
  await db.put('messages', msg)
}

export async function clearMessages(): Promise<void> {
  const db = await getDb()
  await db.clear('messages')
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb()
  const row = await db.get('settings', key)
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('settings', { key, value })
}
